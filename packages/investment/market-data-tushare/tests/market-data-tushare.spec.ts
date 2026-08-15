/**
 * The Tushare provider against a stubbed endpoint: what it sends, how it reads
 * the venue's units back, and every way one call can be refused.
 */
import { Context } from '@deepseek-ai/cordis'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import MarketDataRuntime from '@deepseek-ai/dsh-market-data'
import type { MarketDataProvider } from '@deepseek-ai/dsh-market-data'
import { callTushare, figure, text } from '../src/api.ts'
import {
  Config,
  DEFAULT_BASE_URL,
  DEFAULT_ROSTER_TTL_MINUTES,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_TOKEN_ENV,
  PROVIDER_ID,
  SUPPORTED_MARKETS,
  apply,
  createTushareProvider,
  inject,
  name,
} from '../src/index.ts'

const CATL = { market: 'SZSE', symbol: '300750' } as const
const MOUTAI = { market: 'SSE', symbol: '600519' } as const

/** One `daily` row as Tushare writes it: newest first, volume in lots. */
function dailyRow(tradeDate: string, close: number, preClose: number, lots: number) {
  return [tradeDate, close - 1, close + 2, close - 3, close, preClose, 1.23, lots]
}

const DAILY_COLUMNS = ['trade_date', 'open', 'high', 'low', 'close', 'pre_close', 'pct_chg', 'vol']

/** A successful Tushare envelope over the given columns and rows. */
function ok(fields: string[], items: unknown[][]) {
  return { code: 0, msg: null, data: { fields, items } }
}

/** One recorded call: the interface asked for and the parameters it carried. */
interface Sent {
  api_name: string
  token: string
  params: Record<string, string>
  fields: string
}

/**
 * Stub `fetch` with one queue of bodies per interface, and record what was
 * sent in the order it was sent. Routed rather than a single queue because the
 * provider issues the bar and roster reads concurrently, so their arrival
 * order is not the test's to fix — while `sent` still shows what that order was.
 */
function stubFetch(routes: Record<string, unknown[]>): { sent: Sent[] } {
  const sent: Sent[] = []
  vi.stubGlobal('fetch', (_url: string, init: { body: string }) => {
    const call = JSON.parse(init.body) as Sent
    sent.push(call)
    const body = routes[call.api_name]?.shift()
    if (body === undefined) throw new Error(`unexpected ${call.api_name} call`)
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) })
  })
  return { sent }
}

/** Stub `fetch` so every call answers with one body; for the transport tests. */
function stubBody(body: unknown): { sent: Sent[] } {
  const sent: Sent[] = []
  vi.stubGlobal('fetch', (_url: string, init: { body: string }) => {
    sent.push(JSON.parse(init.body) as Sent)
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) })
  })
  return { sent }
}

/** The endpoint the transport tests call through. */
const ENDPOINT = { baseURL: DEFAULT_BASE_URL, token: 'tok', timeoutMs: 1000 }

/** A provider whose token is present and whose bars are as-traded. */
function provider(overrides: Partial<Parameters<typeof createTushareProvider>[0]> = {}): MarketDataProvider {
  return createTushareProvider({
    resolveToken: () => Promise.resolve('tok'),
    baseURL: DEFAULT_BASE_URL,
    adjustment: 'none',
    rosterTtlMs: 60_000,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    ...overrides,
  })
}

/** The roster body; a fresh copy per test, since the stub shifts through it. */
function roster() {
  return ok(['ts_code', 'name'], [
    ['300750.SZ', '宁德时代'],
    ['300274.SZ', '阳光电源'],
    ['600519.SH', '贵州茅台'],
    ['430047.BJ', '诺思兰德'],
    // A venue this provider does not read is skipped rather than refused.
    ['00700.HK', '腾讯控股'],
    // A code with no venue suffix at all is skipped the same way.
    ['NOSUFFIX', '无后缀'],
  ])
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-08-14T02:00:00.000Z'))
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('tushare transport', () => {
  it('posts the interface, token, params, and joined fields to the endpoint', async () => {
    const { sent } = stubBody(ok(['a'], [[1]]))

    await callTushare(ENDPOINT, { apiName: 'daily', params: { ts_code: '300750.SZ' }, fields: ['a', 'b'] })
    expect(sent[0]).toEqual({
      api_name: 'daily',
      token: 'tok',
      params: { ts_code: '300750.SZ' },
      fields: 'a,b',
    })
  })

  it('decodes column arrays into named rows', async () => {
    stubBody(ok(['x', 'y'], [[1, 'one'], [2, 'two']]))

    const rows = await callTushare(ENDPOINT, { apiName: 'daily', params: {}, fields: [] })
    expect(rows).toEqual([{ x: 1, y: 'one' }, { x: 2, y: 'two' }])
  })

  it('reads a null payload as no rows, which is how a match-nothing call answers', async () => {
    stubBody({ code: 0, msg: null, data: null })

    await expect(callTushare(ENDPOINT, { apiName: 'daily', params: {}, fields: [] })).resolves.toEqual([])
  })

  it.each([
    ['no column header', { code: 0, data: { fields: 'not-an-array', items: [] } }],
    ['a non-string column name', { code: 0, data: { fields: [1], items: [] } }],
    ['no rows', { code: 0, data: { fields: ['a'], items: 'not-an-array' } }],
    ['a row that is not an array', { code: 0, data: { fields: ['a'], items: ['nope'] } }],
  ])('refuses a body with %s', async (_label, body) => {
    stubBody(body)

    await expect(callTushare(ENDPOINT, { apiName: 'daily', params: {}, fields: [] }))
      .rejects.toThrow(expect.objectContaining({ code: 'MARKET_DATA_PROVIDER_UNAVAILABLE' }))
  })

  it('refuses a non-zero code, quoting the reason Tushare gave', async () => {
    stubBody({ code: 2002, msg: '抱歉，您没有访问该接口的权限', data: null })

    await expect(callTushare(ENDPOINT, { apiName: 'adj_factor', params: {}, fields: [] }))
      .rejects.toThrow(/adj_factor refused \(code 2002\): 抱歉，您没有访问该接口的权限/)
  })

  it('refuses a non-zero code that carried no reason', async () => {
    stubBody({ code: 40203, data: null })

    await expect(callTushare(ENDPOINT, { apiName: 'daily', params: {}, fields: [] }))
      .rejects.toThrow(/no reason given/)
  })

  it('refuses a non-200 status', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve({ ok: false, status: 502, json: () => Promise.resolve({}) }))

    await expect(callTushare(ENDPOINT, { apiName: 'daily', params: {}, fields: [] }))
      .rejects.toThrow(/returned HTTP 502/)
  })

  it('reports a transport failure as this provider being unusable', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new Error('ECONNREFUSED')))

    await expect(callTushare(ENDPOINT, { apiName: 'daily', params: {}, fields: [] }))
      .rejects.toThrow(/could not be reached: Error: ECONNREFUSED/)
  })

  it('reports its own time budget running out as a timeout', async () => {
    vi.stubGlobal('fetch', (_url: string, init: { signal: AbortSignal }) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => { reject(new Error('aborted')) })
      }))

    const call = callTushare(
      { baseURL: DEFAULT_BASE_URL, token: 'tok', timeoutMs: 50 },
      { apiName: 'daily', params: {}, fields: [] },
    )
    const assertion = expect(call).rejects.toThrow(/daily timed out after 50ms/)
    await vi.advanceTimersByTimeAsync(60)
    await assertion
  })

  it('hands the caller its own cancellation back untranslated', async () => {
    vi.stubGlobal('fetch', (_url: string, init: { signal: AbortSignal }) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => { reject(new Error('caller went away')) })
      }))
    const controller = new AbortController()

    const call = callTushare(
      { baseURL: DEFAULT_BASE_URL, token: 'tok', timeoutMs: 10_000 },
      { apiName: 'daily', params: {}, fields: [] },
      controller.signal,
    )
    const assertion = expect(call).rejects.toThrow('caller went away')
    controller.abort()
    await assertion
  })
})

describe('tushare column readers', () => {
  it('reads text and finite numbers', () => {
    expect(text({ a: 'x' }, 'a')).toBe('x')
    expect(figure({ a: 1.5 }, 'a')).toBe(1.5)
  })

  it.each([
    ['a missing column', {}],
    ['a number where text was wanted', { a: 1 }],
  ])('refuses text from %s', (_label, row) => {
    expect(() => text(row, 'a')).toThrow(/column "a" was not text/)
  })

  it.each([
    ['a missing column', {}],
    ['a null the venue left blank', { a: null }],
    ['a non-finite value', { a: Number.NaN }],
  ])('refuses a figure from %s', (_label, row) => {
    expect(() => figure(row, 'a')).toThrow(/column "a" was not a finite number/)
  })
})

describe('tushare provider identity and availability', () => {
  it('claims its registry id and serves only the mainland venues', () => {
    expect(provider().id).toBe(PROVIDER_ID)
    expect(SUPPORTED_MARKETS).toEqual(['SSE', 'SZSE', 'BSE'])
  })

  it.each([
    ['absent', undefined],
    ['stored blank', ''],
  ])('is unusable while the token is %s', async (_label, token) => {
    await expect(provider({ resolveToken: () => Promise.resolve(token) }).available()).resolves.toBe(false)
  })

  it('is usable once a token resolves', async () => {
    await expect(provider().available()).resolves.toBe(true)
  })

  it('re-reads the token per operation, so one stored later needs no restart', async () => {
    const store: { token: string | undefined } = { token: undefined }
    const usable = provider({ resolveToken: () => Promise.resolve(store.token) })

    await expect(usable.available()).resolves.toBe(false)
    store.token = 'arrived'
    await expect(usable.available()).resolves.toBe(true)
  })

  it('refuses an operation before calling out while no token is configured', async () => {
    const { sent } = stubFetch({})

    await expect(provider({ resolveToken: () => Promise.resolve(undefined) })
      .quote({ instrument: CATL })).rejects.toThrow(/no account token is configured/)
    expect(sent).toEqual([])
  })
})

describe('tushare venue coverage', () => {
  it.each([
    ['SSE', '600519.SH'],
    ['SZSE', '300750.SZ'],
    ['BSE', '430047.BJ'],
  ])('addresses %s listings by their ts_code suffix', async (market, code) => {
    const { sent } = stubFetch({
      daily: [ok(DAILY_COLUMNS, [dailyRow('20260814', 10, 9, 100)])],
      stock_basic: [roster()],
    })

    await provider().quote({ instrument: { market: market as 'SSE', symbol: code.split('.')[0] as string } })
    expect(sent[0]?.params.ts_code).toBe(code)
  })

  it.each(['HKEX', 'NASDAQ', 'NYSE'] as const)('refuses %s without spending a call', async (market) => {
    const { sent } = stubFetch({})

    await expect(provider().quote({ instrument: { market, symbol: '00700' } }))
      .rejects.toThrow(expect.objectContaining({ code: 'MARKET_DATA_VENUE_UNSUPPORTED' }))
    expect(sent).toEqual([])
  })
})

describe('tushare quotes', () => {
  it('reads the venue units back: lots into shares, and the close as the last price', async () => {
    stubFetch({
      daily: [ok(DAILY_COLUMNS, [dailyRow('20260814', 212.3, 210.0, 301_000), dailyRow('20260813', 210.0, 208.0, 250_000)])],
      stock_basic: [roster()],
    })

    const quote = await provider().quote({ instrument: CATL })
    expect(quote).toEqual({
      instrument: CATL,
      name: '宁德时代',
      currency: 'CNY',
      last: 212.3,
      previousClose: 210.0,
      changePercent: 1.23,
      // 301_000 lots at 100 shares each.
      volume: 30_100_000,
      asOf: '2026-08-14T07:00:00.000Z',
      session: 'closed',
    })
  })

  it('takes the newest session whatever order the server returned', async () => {
    stubFetch({
      daily: [ok(DAILY_COLUMNS, [dailyRow('20260812', 200, 199, 10), dailyRow('20260814', 212.3, 210, 20)])],
      stock_basic: [roster()],
    })

    expect((await provider().quote({ instrument: CATL })).last).toBe(212.3)
  })

  it('asks for a window rather than one date, so a holiday week still answers', async () => {
    const { sent } = stubFetch({
      daily: [ok(DAILY_COLUMNS, [dailyRow('20260807', 10, 9, 1)])],
      stock_basic: [roster()],
    })

    const quote = await provider().quote({ instrument: CATL })
    expect(sent[0]?.params).toMatchObject({ start_date: '20260729', end_date: '20260814' })
    // The instant is the session the venue actually priced, not today.
    expect(quote.asOf).toBe('2026-08-07T07:00:00.000Z')
  })

  it('refuses a code the venue has no sessions for', async () => {
    stubFetch({
      daily: [ok(DAILY_COLUMNS, [])],
      stock_basic: [roster()],
    })

    await expect(provider().quote({ instrument: { market: 'SZSE', symbol: '000000' } }))
      .rejects.toThrow(expect.objectContaining({ code: 'MARKET_DATA_UNKNOWN_INSTRUMENT' }))
  })

  it('names an instrument the roster no longer lists by its code', async () => {
    stubFetch({
      daily: [ok(DAILY_COLUMNS, [dailyRow('20260814', 10, 9, 1)])],
      stock_basic: [roster()],
    })

    expect((await provider().quote({ instrument: { market: 'SZSE', symbol: '000001' } })).name)
      .toBe('SZSE:000001')
  })
})

describe('tushare price history', () => {
  it('returns as-traded bars oldest first, trimmed to the sessions asked for', async () => {
    stubFetch({
      daily: [ok(DAILY_COLUMNS, [
        dailyRow('20260814', 212.3, 210, 30),
        dailyRow('20260813', 210.0, 208, 20),
        dailyRow('20260812', 208.0, 207, 10),
      ])],
    })

    const history = await provider().priceHistory({ instrument: CATL, sessions: 2 })
    expect(history.adjustment).toBe('none')
    expect(history.bars.map(bar => bar.date)).toEqual(['2026-08-13', '2026-08-14'])
    expect(history.bars[0]).toEqual({
      date: '2026-08-13', open: 209, high: 212, low: 207, close: 210, volume: 2000,
    })
  })

  it('sizes the window from the sessions wanted', async () => {
    const { sent } = stubFetch({
      daily: [ok(DAILY_COLUMNS, [])],
    })

    await provider().priceHistory({ instrument: CATL, sessions: 60 })
    // 60 sessions at 1.75 calendar days each plus the 14-day holiday floor is
    // 119 days back, which covers about 79 trading days.
    expect(sent[0]?.params).toMatchObject({ start_date: '20260417', end_date: '20260814' })
  })

  it('leaves the factor interface alone while the bars are as-traded', async () => {
    const { sent } = stubFetch({
      daily: [ok(DAILY_COLUMNS, [dailyRow('20260814', 10, 9, 1)])],
    })

    await provider().priceHistory({ instrument: CATL, sessions: 1 })
    expect(sent.map(call => call.api_name)).toEqual(['daily'])
  })

  it('restates history onto today basis when asked to look backward', async () => {
    stubFetch({
      daily: [ok(DAILY_COLUMNS, [dailyRow('20260814', 100, 99, 1), dailyRow('20260813', 50, 49, 1)])],
      adj_factor: [ok(['trade_date', 'adj_factor'], [['20260814', 2], ['20260813', 1]])],
    })

    const history = await provider({ adjustment: 'backward' }).priceHistory({ instrument: CATL, sessions: 2 })
    expect(history.adjustment).toBe('backward')
    // The older bar is scaled by its factor over the newest one; the newest is
    // already on today's basis and keeps its traded close.
    expect(history.bars.map(bar => bar.close)).toEqual([25, 100])
    // The adjustment describes prices, so volume stays as traded.
    expect(history.bars.map(bar => bar.volume)).toEqual([100, 100])
  })

  it('restates onto the first bar basis when asked to look forward', async () => {
    stubFetch({
      daily: [ok(DAILY_COLUMNS, [dailyRow('20260814', 100, 99, 1), dailyRow('20260813', 50, 49, 1)])],
      adj_factor: [ok(['trade_date', 'adj_factor'], [['20260814', 2], ['20260813', 1]])],
    })

    const history = await provider({ adjustment: 'forward' }).priceHistory({ instrument: CATL, sessions: 2 })
    expect(history.bars.map(bar => bar.close)).toEqual([50, 200])
  })

  it('asks the factor interface about the same window as the bars', async () => {
    const { sent } = stubFetch({
      daily: [ok(DAILY_COLUMNS, [dailyRow('20260814', 100, 99, 1)])],
      adj_factor: [ok(['trade_date', 'adj_factor'], [['20260814', 1]])],
    })

    await provider({ adjustment: 'backward' }).priceHistory({ instrument: CATL, sessions: 30 })
    expect(sent[1]?.api_name).toBe('adj_factor')
    expect(sent[1]?.params).toEqual(sent[0]?.params)
  })

  it('answers an empty window without a basis to restate onto', async () => {
    stubFetch({
      daily: [ok(DAILY_COLUMNS, [])],
      adj_factor: [ok(['trade_date', 'adj_factor'], [])],
    })

    const history = await provider({ adjustment: 'backward' }).priceHistory({ instrument: CATL, sessions: 5 })
    expect(history.bars).toEqual([])
  })

  it.each([
    ['no factor for the basis session', [['20260813', 1]]],
    ['a zero factor for the basis session', [['20260814', 0], ['20260813', 1]]],
  ])('refuses to restate with %s', async (_label, factors) => {
    stubFetch({
      daily: [ok(DAILY_COLUMNS, [dailyRow('20260814', 100, 99, 1), dailyRow('20260813', 50, 49, 1)])],
      adj_factor: [ok(['trade_date', 'adj_factor'], factors)],
    })

    await expect(provider({ adjustment: 'backward' }).priceHistory({ instrument: CATL, sessions: 2 }))
      .rejects.toThrow(/no usable factor for 2026-08-14/)
  })

  it('refuses to restate a bar the factor interface skipped', async () => {
    stubFetch({
      daily: [ok(DAILY_COLUMNS, [dailyRow('20260814', 100, 99, 1), dailyRow('20260813', 50, 49, 1)])],
      adj_factor: [ok(['trade_date', 'adj_factor'], [['20260814', 2]])],
    })

    await expect(provider({ adjustment: 'backward' }).priceHistory({ instrument: CATL, sessions: 2 }))
      .rejects.toThrow(/no factor for 2026-08-13/)
  })
})

describe('tushare instrument lookup', () => {
  it('matches a code from its start and a name anywhere in it', async () => {
    stubFetch({ stock_basic: [roster()] })
    const source = provider()

    expect(await source.search({ query: '3007', limit: 10 }))
      .toEqual({ matches: [{ instrument: CATL, name: '宁德时代' }] })
    expect((await source.search({ query: '茅台', limit: 10 })).matches)
      .toEqual([{ instrument: MOUTAI, name: '贵州茅台' }])
  })

  it.each([
    ['a venue it does not read', '00700', '腾讯控股'],
    ['a code with no venue suffix', 'NOSUFFIX', '无后缀'],
  ])('drops roster rows for %s', async (_label, code, listedName) => {
    stubFetch({ stock_basic: [roster(), roster()] })
    const source = provider()

    // Both the code and the name are on the roster the API returned, so an
    // empty answer here is the row being dropped rather than a query that missed.
    expect((await source.search({ query: code, limit: 20 })).matches).toEqual([])
    expect((await source.search({ query: listedName, limit: 20 })).matches).toEqual([])
  })

  it('honours the caller limit', async () => {
    stubFetch({ stock_basic: [roster(), roster()] })
    const source = provider()

    // Both Shenzhen listings answer this prefix.
    expect((await source.search({ query: '300', limit: 10 })).matches).toHaveLength(2)
    expect((await source.search({ query: '300', limit: 1 })).matches).toHaveLength(1)
  })

  it('answers a blank query without touching the roster', async () => {
    const { sent } = stubFetch({})

    await expect(provider().search({ query: '   ', limit: 10 })).resolves.toEqual({ matches: [] })
    expect(sent).toEqual([])
  })

  it('answers a query that names nothing with no matches', async () => {
    stubFetch({ stock_basic: [roster()] })

    expect((await provider().search({ query: 'ZZZZ', limit: 10 })).matches).toEqual([])
  })
})

describe('tushare roster caching', () => {
  it('fetches the roster once for concurrent readers', async () => {
    const { sent } = stubFetch({
      daily: [ok(DAILY_COLUMNS, [dailyRow('20260814', 10, 9, 1)]), ok(DAILY_COLUMNS, [dailyRow('20260814', 20, 19, 1)])],
      stock_basic: [roster()],
    })
    const source = provider()

    await Promise.all([source.quote({ instrument: CATL }), source.quote({ instrument: MOUTAI })])
    expect(sent.filter(call => call.api_name === 'stock_basic')).toHaveLength(1)
  })

  it('serves later reads from the held roster until it expires', async () => {
    const { sent } = stubFetch({ stock_basic: [roster(), roster()] })
    const source = provider({ rosterTtlMs: 60_000 })

    await source.search({ query: '茅台', limit: 5 })
    vi.advanceTimersByTime(59_000)
    await source.search({ query: '茅台', limit: 5 })
    expect(sent).toHaveLength(1)

    vi.advanceTimersByTime(2_000)
    await source.search({ query: '茅台', limit: 5 })
    expect(sent).toHaveLength(2)
  })

  it('does not remember a failed roster fetch as one still in flight', async () => {
    const { sent } = stubFetch({ stock_basic: [{ code: 2002, msg: '没有权限', data: null }, roster()] })
    const source = provider()

    await expect(source.search({ query: '茅台', limit: 5 })).rejects.toThrow(/没有权限/)
    // The retry reaches the API rather than awaiting the promise that rejected.
    expect((await source.search({ query: '茅台', limit: 5 })).matches).toHaveLength(1)
    expect(sent).toHaveLength(2)
  })
})

describe('market-data-tushare plugin', () => {
  it('registers the provider on the seam with the token the credential plane holds', async () => {
    stubFetch({
      daily: [ok(DAILY_COLUMNS, [dailyRow('20260814', 212.3, 210, 301_000)])],
      stock_basic: [roster()],
    })
    const resolved: string[] = []
    const ctx = new Context()
    ctx.provide('credentials', {
      resolve: (ref: string) => {
        resolved.push(ref)
        return Promise.resolve({ value: 'tok', source: 'test' })
      },
    } as never)
    await ctx.plugin(MarketDataRuntime, { maxHistorySessions: 500, maxSearchMatches: 20 }).await()
    await ctx.plugin({ name, inject: [...inject], apply, Config }, {}).await()

    const quote = await ctx.marketData.quote({ instrument: CATL })
    expect(quote.name).toBe('宁德时代')
    expect(resolved).toContain(DEFAULT_TOKEN_ENV)
  })

  it('unregisters the provider when its fiber is disposed', async () => {
    const ctx = new Context()
    ctx.provide('credentials', { resolve: () => Promise.resolve(undefined) } as never)
    await ctx.plugin(MarketDataRuntime, { maxHistorySessions: 500, maxSearchMatches: 20 }).await()
    const fiber = ctx.plugin({ name, inject: [...inject], apply, Config }, {})
    await fiber.await()

    await fiber.dispose()
    await expect(ctx.marketData.quote({ instrument: CATL }))
      .rejects.toThrow(expect.objectContaining({ code: 'MARKET_DATA_PROVIDER_UNAVAILABLE' }))
  })

  it('carries its defaults in the schema, so a configuration surface can render them', () => {
    expect(new Config({})).toEqual({
      tokenEnv: DEFAULT_TOKEN_ENV,
      baseURL: DEFAULT_BASE_URL,
      adjustment: 'none',
      rosterTtlMinutes: DEFAULT_ROSTER_TTL_MINUTES,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    })
  })
})
