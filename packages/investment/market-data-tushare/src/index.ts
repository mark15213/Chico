/**
 * Market-data Service Provider backed by the Tushare Pro API: end-of-day bars
 * and the listing roster for the mainland venues.
 *
 * Tushare serves end-of-day data, so every quote here is a session close
 * rather than a live price — `session` is always `closed` and `asOf` is the
 * venue's closing instant. A surface that needs an intraday tick needs a
 * different provider; this one is honest about what it has.
 *
 * Two facts about the feed shape this package. Tushare has no lookup endpoint,
 * so `search` matches locally over the full listing roster, which is fetched
 * once and held for a configured interval. And restatement for corporate
 * actions is a separate interface at a higher entitlement than the bars
 * themselves, so `adjustment` defaults to `none` and an account that cannot
 * reach the factors keeps working until it asks for restated prices.
 * @module @deepseek-ai/dsh-market-data-tushare
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import type {
  InstrumentMatch,
  InstrumentRef,
  InstrumentSearchRequest,
  InstrumentSearchResult,
  Market,
  MarketDataProvider,
  PriceBar,
  PriceHistory,
  PriceHistoryRequest,
  Quote,
  QuoteRequest,
} from '@deepseek-ai/dsh-market-data'
import { MarketDataError } from '@deepseek-ai/dsh-market-data'
import type { TushareEndpoint, TushareRow } from './api.ts'
import { callTushare, figure, providerUnavailable, text } from './api.ts'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'market-data-tushare'

/** Services required before the provider can register. */
export const inject = ['marketData', 'credentials']

/** Registry id this provider claims. */
export const PROVIDER_ID = 'tushare'

/** Credential reference naming the Tushare account token. */
export const DEFAULT_TOKEN_ENV = 'TUSHARE_TOKEN'

/** Public Tushare Pro endpoint. */
export const DEFAULT_BASE_URL = 'https://api.tushare.pro'

/**
 * How long the listing roster is held before it is fetched again. Half a day:
 * listings change at most once a trading day, and the roster is one call that
 * every search and every quote reads.
 */
export const DEFAULT_ROSTER_TTL_MINUTES = 720

/** Wall-clock budget for one Tushare call. */
export const DEFAULT_TIMEOUT_MS = 15_000

/**
 * Venues this provider serves. Tushare reaches Hong Kong and the US through
 * separate interfaces at higher entitlements; until one of those is
 * implemented, a name listed there is refused rather than answered wrongly.
 */
export const SUPPORTED_MARKETS: readonly Market[] = ['SSE', 'SZSE', 'BSE']

/** Tushare's `ts_code` suffix for each venue this provider serves. */
const SUFFIX_BY_MARKET: Partial<Record<Market, string>> = { SSE: 'SH', SZSE: 'SZ', BSE: 'BJ' }

/** The venue each `ts_code` suffix names, for reading the roster back. */
const MARKET_BY_SUFFIX: Readonly<Record<string, Market>> = { SH: 'SSE', SZ: 'SZSE', BJ: 'BSE' }

/** Currency the mainland venues price in; a venue fact, not a deployment choice. */
const VENUE_CURRENCY = 'CNY'

/** Time zone whose calendar day is the venue's trading date. */
const VENUE_TIME_ZONE = 'Asia/Shanghai'

/** Time-of-day the mainland session ends, as a UTC instant suffix (15:00 CST). */
const VENUE_CLOSE_SUFFIX = 'T07:00:00.000Z'

/**
 * Calendar days requested per trading session wanted. The mainland venues
 * trade about 243 of 365 days, and the closures cluster into the Spring
 * Festival and National Day weeks rather than spreading evenly, so the ratio
 * carries margin above the plain 1.5.
 */
const CALENDAR_DAYS_PER_SESSION = 1.75

/** Days added to every window so a short request still clears one long holiday. */
const WINDOW_FLOOR_DAYS = 14

/** Tushare reports volume in lots; a mainland lot is 100 shares. */
const SHARES_PER_LOT = 100

/** The `daily` columns this provider reads. */
const DAILY_FIELDS = ['trade_date', 'open', 'high', 'low', 'close', 'pre_close', 'pct_chg', 'vol'] as const

/** The `stock_basic` columns this provider reads. */
const ROSTER_FIELDS = ['ts_code', 'name'] as const

/** The `adj_factor` columns this provider reads. */
const FACTOR_FIELDS = ['trade_date', 'adj_factor'] as const

/** Plugin config: the token reference, the endpoint, and how prices are stated. */
export interface Config {
  /** Credential reference holding the account token. Defaults to `TUSHARE_TOKEN`. */
  tokenEnv?: string
  /** Tushare Pro endpoint. Defaults to the public one. */
  baseURL?: string
  /**
   * Corporate-action basis for the bars this provider returns. `none` is
   * as-traded and needs only the bar interface; the two restating values also
   * read the adjustment-factor interface, which Tushare gates behind a higher
   * point threshold than the bars, so an account below it must leave this at
   * `none`. Defaults to `none`.
   */
  adjustment?: 'none' | 'backward' | 'forward'
  /** How long the listing roster is held. Defaults to 720. */
  rosterTtlMinutes?: number
  /** Wall-clock budget for one Tushare call. Defaults to 15000. */
  timeoutMs?: number
}

export const Config: z<Config> = z.object({
  tokenEnv: z.string().role('credential-ref').default(DEFAULT_TOKEN_ENV),
  baseURL: z.string().default(DEFAULT_BASE_URL),
  adjustment: z.union(['none', 'backward', 'forward']).default('none'),
  rosterTtlMinutes: z.natural().min(1).default(DEFAULT_ROSTER_TTL_MINUTES),
  timeoutMs: z.natural().min(1).default(DEFAULT_TIMEOUT_MS),
})

/** Everything the provider needs that is not a Cordis context. */
export interface TushareProviderOptions {
  /**
   * Read the current account token. Called per operation rather than captured,
   * so a token stored after startup reaches the next request without a restart.
   */
  readonly resolveToken: () => Promise<string | undefined>
  /** Tushare Pro endpoint. */
  readonly baseURL: string
  /** Corporate-action basis for returned bars. */
  readonly adjustment: 'none' | 'backward' | 'forward'
  /** How long the listing roster is held, in milliseconds. */
  readonly rosterTtlMs: number
  /** Wall-clock budget for one Tushare call. */
  readonly timeoutMs: number
}

/** The refusal for a venue this provider does not reach. */
function venueUnsupported(market: Market): MarketDataError {
  return new MarketDataError(
    `tushare serves ${SUPPORTED_MARKETS.join(', ')}; ${market} is not one of them`,
    'MARKET_DATA_VENUE_UNSUPPORTED',
  )
}

/** The refusal for a code the venue does not list. */
function unknownInstrument(instrument: InstrumentRef): MarketDataError {
  return new MarketDataError(
    `tushare has no sessions for ${instrument.market}:${instrument.symbol}`,
    'MARKET_DATA_UNKNOWN_INSTRUMENT',
  )
}

/**
 * Tushare's identifier for one instrument, such as `600519.SH`.
 * @param instrument - the venue and code to address.
 * @returns the `ts_code`.
 * @throws {@link MarketDataError} `MARKET_DATA_VENUE_UNSUPPORTED` off the served venues.
 */
function tsCode(instrument: InstrumentRef): string {
  const suffix = SUFFIX_BY_MARKET[instrument.market]
  if (suffix === undefined) throw venueUnsupported(instrument.market)
  return `${instrument.symbol}.${suffix}`
}

/**
 * Read one roster row's `ts_code` back into an instrument, or nothing when the
 * suffix names a venue this provider does not serve. Tushare's roster carries
 * only mainland listings today; an unrecognized suffix is skipped rather than
 * refused, because one unfamiliar row must not cost the reader the whole list.
 */
function instrumentOf(code: string): InstrumentRef | undefined {
  const dot = code.lastIndexOf('.')
  if (dot < 0) return undefined
  const market = MARKET_BY_SUFFIX[code.slice(dot + 1)]
  return market === undefined ? undefined : { market, symbol: code.slice(0, dot) }
}

/** Today's trading date at the venue, as Tushare writes dates (`YYYYMMDD`). */
function venueToday(): string {
  // `en-CA` renders a calendar date as YYYY-MM-DD, which is the compact format
  // minus its separators.
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: VENUE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return formatter.format(new Date()).replaceAll('-', '')
}

/** The compact date `days` before `compact`, on the plain calendar. */
function daysBefore(compact: string, days: number): string {
  const date = new Date(`${isoDate(compact)}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() - days)
  return date.toISOString().slice(0, 10).replaceAll('-', '')
}

/** `YYYYMMDD` as the ISO calendar date `YYYY-MM-DD`. */
function isoDate(compact: string): string {
  return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`
}

/**
 * The Tushare date window covering a wanted number of trading sessions, ending
 * today. Resolved once per operation and passed to every interface the
 * operation calls, so a request that straddles midnight cannot ask two
 * interfaces about two different days. The window may still fall short across
 * an unusually long closure, which the seam allows: a provider may return
 * fewer sessions than asked for.
 * @param sessions - how many trading sessions the caller wants.
 * @returns the `start_date` and `end_date` parameters, as Tushare writes dates.
 */
function dateWindow(sessions: number): { start_date: string; end_date: string } {
  const end = venueToday()
  const days = Math.ceil(sessions * CALENDAR_DAYS_PER_SESSION) + WINDOW_FLOOR_DAYS
  return { start_date: daysBefore(end, days), end_date: end }
}

/** Round to four decimals; enough for a restated price without float noise. */
function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000
}

/** One `daily` row as a bar, with volume converted from lots to shares. */
function barOf(row: TushareRow): PriceBar {
  return {
    date: isoDate(text(row, 'trade_date')),
    open: figure(row, 'open'),
    high: figure(row, 'high'),
    low: figure(row, 'low'),
    close: figure(row, 'close'),
    volume: figure(row, 'vol') * SHARES_PER_LOT,
  }
}

/**
 * The listing roster, fetched once and held. Concurrent readers share one
 * fetch: a watchlist prices every row at once and each of those quotes needs a
 * name, so without this the first glance would download the roster once per
 * followed name.
 */
class InstrumentRoster {
  private cached: readonly InstrumentMatch[] | undefined
  private expiresAt = 0
  private inflight: Promise<readonly InstrumentMatch[]> | undefined

  /**
   * @param load - fetch the whole roster.
   * @param ttlMs - how long a fetched roster stays current.
   */
  constructor(
    private readonly load: () => Promise<readonly InstrumentMatch[]>,
    private readonly ttlMs: number,
  ) {}

  /**
   * The current roster, fetching it when absent or stale.
   *
   * The caller's cancellation is deliberately not forwarded: the fetch is
   * shared, so honouring one reader's abort would cancel it for every reader
   * waiting on the same promise. The per-call time budget bounds it instead.
   * @returns every listing the venue currently carries.
   */
  async read(): Promise<readonly InstrumentMatch[]> {
    const cached = this.cached
    if (cached !== undefined && Date.now() < this.expiresAt) return cached
    this.inflight ??= this.load().then(
      (entries) => {
        this.cached = entries
        this.expiresAt = Date.now() + this.ttlMs
        this.inflight = undefined
        return entries
      },
      (error: unknown) => {
        // A failed fetch must not be remembered as in-flight, or every later
        // read would await a promise that already rejected.
        this.inflight = undefined
        throw error
      },
    )
    return this.inflight
  }
}

/** Whether one listing answers an upper-cased query. */
function matchesQuery(entry: InstrumentMatch, query: string): boolean {
  return entry.instrument.symbol.startsWith(query)
    || entry.name.toLocaleUpperCase().includes(query)
}

/**
 * Restate bars onto one corporate-action basis using Tushare's factors.
 *
 * The two directions are named for what they move rather than for the Chinese
 * convention: `backward` restates history onto today's basis (前复权) and
 * `forward` restates onto the first bar's basis (后复权). Volume is left as
 * traded, because the adjustment the seam records describes the prices.
 * @param bars - as-traded bars in ascending date order.
 * @param factors - adjustment factor by trading date.
 * @param adjustment - which basis to restate onto.
 * @returns the restated bars, in the same order.
 * @throws {@link MarketDataError} when a bar has no factor for its date.
 */
function restate(
  bars: readonly PriceBar[],
  factors: ReadonlyMap<string, number>,
  adjustment: 'backward' | 'forward',
): PriceBar[] {
  const basisBar = adjustment === 'backward' ? bars.at(-1) : bars[0]
  // No bars means no basis and nothing to restate; the empty answer is already
  // correct, so it returns before the lookup that would have no date to use.
  if (basisBar === undefined) return []
  const basis = factors.get(basisBar.date)
  if (basis === undefined || basis === 0) {
    throw providerUnavailable(`adj_factor carried no usable factor for ${basisBar.date}`)
  }
  return bars.map((bar) => {
    const factor = factors.get(bar.date)
    if (factor === undefined) throw providerUnavailable(`adj_factor carried no factor for ${bar.date}`)
    const scale = factor / basis
    return {
      date: bar.date,
      open: round4(bar.open * scale),
      high: round4(bar.high * scale),
      low: round4(bar.low * scale),
      close: round4(bar.close * scale),
      volume: bar.volume,
    }
  })
}

/**
 * Build the Tushare provider. Exported for tests that exercise it without a
 * Cordis context.
 * @param options - the token source, the endpoint, and how prices are stated.
 * @returns the provider, usable while a token resolves.
 */
export function createTushareProvider(options: TushareProviderOptions): MarketDataProvider {
  /** The endpoint for one operation, refusing before the call when unconfigured. */
  const endpoint = async (): Promise<TushareEndpoint> => {
    const token = await options.resolveToken()
    if (token === undefined || token.length === 0) {
      throw providerUnavailable('no account token is configured')
    }
    return { baseURL: options.baseURL, token, timeoutMs: options.timeoutMs }
  }

  const roster = new InstrumentRoster(async () => {
    const rows = await callTushare(
      await endpoint(),
      { apiName: 'stock_basic', params: { list_status: 'L' }, fields: [...ROSTER_FIELDS] },
    )
    return rows.flatMap((row) => {
      const instrument = instrumentOf(text(row, 'ts_code'))
      return instrument === undefined ? [] : [{ instrument, name: text(row, 'name') }]
    })
  }, options.rosterTtlMs)

  /** Read `daily` over one window, oldest session first. */
  const dailyRows = async (
    code: string,
    window: { start_date: string; end_date: string },
    signal?: AbortSignal,
  ): Promise<TushareRow[]> => {
    const rows = await callTushare(
      await endpoint(),
      { apiName: 'daily', params: { ts_code: code, ...window }, fields: [...DAILY_FIELDS] },
      signal,
    )
    // Tushare returns newest first; the seam's order is the venue's own, and
    // sorting here means the answer never depends on the server keeping to it.
    return rows.sort((left, right) => text(left, 'trade_date').localeCompare(text(right, 'trade_date')))
  }

  return {
    id: PROVIDER_ID,
    available: async () => {
      const token = await options.resolveToken()
      return token !== undefined && token.length > 0
    },
    search: async (request: InstrumentSearchRequest): Promise<InstrumentSearchResult> => {
      const query = request.query.trim().toLocaleUpperCase()
      if (query.length === 0) return { matches: [] }
      const entries = await roster.read()
      // Roster order, which is the venue's listing order: Tushare returns no
      // relevance signal, and inventing a ranking would present a guess as one.
      return { matches: entries.filter(entry => matchesQuery(entry, query)).slice(0, request.limit) }
    },
    quote: async (request: QuoteRequest, signal?: AbortSignal): Promise<Quote> => {
      const { instrument } = request
      // Resolved before any network work, so an unserved venue costs no call.
      const code = tsCode(instrument)
      // One session is wanted, but the window covers a closure so a request
      // made during a holiday week still finds the last real session.
      const [rows, entries] = await Promise.all([
        dailyRows(code, dateWindow(1), signal),
        roster.read(),
      ])
      const latest = rows.at(-1)
      if (latest === undefined) throw unknownInstrument(instrument)
      const listed = entries.find(entry =>
        entry.instrument.market === instrument.market && entry.instrument.symbol === instrument.symbol)
      const date = isoDate(text(latest, 'trade_date'))
      return {
        instrument,
        // A name absent from the roster is a listing that stopped being
        // current between the roster fetch and now; the code still identifies
        // it, and refusing the quote over a missing label would help nobody.
        name: listed?.name ?? `${instrument.market}:${instrument.symbol}`,
        currency: VENUE_CURRENCY,
        last: figure(latest, 'close'),
        previousClose: figure(latest, 'pre_close'),
        changePercent: figure(latest, 'pct_chg'),
        volume: figure(latest, 'vol') * SHARES_PER_LOT,
        // Tushare dates a session without timing it, so the instant is the
        // venue's own close on that date.
        asOf: `${date}${VENUE_CLOSE_SUFFIX}`,
        // End-of-day data is never a live session, whatever the wall clock says.
        session: 'closed',
      }
    },
    priceHistory: async (request: PriceHistoryRequest, signal?: AbortSignal): Promise<PriceHistory> => {
      const { instrument, sessions } = request
      const code = tsCode(instrument)
      const window = dateWindow(sessions)
      const asTraded = (await dailyRows(code, window, signal)).map(barOf).slice(-sessions)
      if (options.adjustment === 'none') {
        return { instrument, bars: asTraded, adjustment: 'none' }
      }
      const rows = await callTushare(
        await endpoint(),
        { apiName: 'adj_factor', params: { ts_code: code, ...window }, fields: [...FACTOR_FIELDS] },
        signal,
      )
      const factors = new Map(rows.map(row => [isoDate(text(row, 'trade_date')), figure(row, 'adj_factor')]))
      return { instrument, bars: restate(asTraded, factors, options.adjustment), adjustment: options.adjustment }
    },
  }
}

/**
 * Register the Tushare provider on `ctx.marketData`; the registration is
 * effect-scoped and unregisters on plugin dispose.
 * @param ctx - context carrying the market-data seam and the credential plane.
 * @param config - the resolved plugin config.
 */
export function apply(ctx: Context, config: Config): void {
  // schemastery (Config) has already filled every defaulted field.
  const resolved = config as Required<Config>
  const tokenRef = credentialRef(resolved.tokenEnv)
  ctx.effect(
    () => ctx.marketData.registerProvider(createTushareProvider({
      resolveToken: async () => (await ctx.credentials.resolve(tokenRef))?.value,
      baseURL: resolved.baseURL,
      adjustment: resolved.adjustment,
      rosterTtlMs: resolved.rosterTtlMinutes * 60_000,
      timeoutMs: resolved.timeoutMs,
    })),
    'market-data-tushare: provider',
  )
}
