/**
 * Market-data tools over the real seam and the deterministic fixture provider:
 * registration and enablement, model-facing output, argument validation,
 * presentation purity, and the structured failure when no provider is usable.
 */
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import InvariantRegistry from '@deepseek-ai/dsh-invariants'
import MarketDataRuntime from '@deepseek-ai/dsh-market-data'
import { apply as applyFixture, Config as FixtureConfig, inject as fixtureInject } from '@deepseek-ai/dsh-market-data-fixture'
import {
  apply, Config, DEFAULT_HISTORY_SESSIONS, formatHistory, formatQuote, historyMetaFromResult,
  historyMetaFromValue, inject, MARKETS, parseSymbol, presentHistoryResult,
} from '../src/index.ts'
import * as ToolInvariant from '../src/invariant.ts'

/** Boot the tools over a real seam, optionally with the fixture provider. */
async function bench(options: { provider?: boolean; config?: Config } = {}) {
  const { provider = true, config = {} } = options
  const ctx = new Context()
  const sections: { name: string; text: string }[] = []
  const tools = new Map<string, { definition: unknown; execute: (args: never, exec: never) => Promise<unknown> }>()
  ctx.provide('tools', {
    register: (definition: { name: string; execute: (args: never, exec: never) => Promise<unknown> }) => {
      tools.set(definition.name, { definition, execute: definition.execute })
      return () => tools.delete(definition.name)
    },
  } as never)
  ctx.provide('systemPrompt', {
    section: (section: { name: string; text: string }) => { sections.push(section) },
  } as never)
  await ctx.plugin(MarketDataRuntime, { maxHistorySessions: 500 }).await()
  if (provider) {
    await ctx.plugin({ name: 'fixture', inject: [...fixtureInject], apply: applyFixture, Config: FixtureConfig }, {}).await()
  }
  const fiber = ctx.plugin({ name: 'tools', inject: [...inject], apply, Config }, config)
  await fiber.await()
  return { ctx, fiber, tools, sections }
}

/**
 * Invoke a registered tool the way the registry would: schema-validated args
 * plus an execution carrying the caller-owned signal the contract requires.
 */
async function call(
  tools: Map<string, { execute: (args: never, exec: never) => Promise<unknown> }>,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const tool = tools.get(name)
  if (tool === undefined) throw new Error(`tool ${name} is not registered`)
  return tool.execute(args as never, { signal: new AbortController().signal } as never)
}

describe('market-data tool registration', () => {
  it('registers both tools and one prompt section by default', async () => {
    const { tools, sections } = await bench()

    expect([...tools.keys()].sort()).toEqual(['market_history', 'market_quote'])
    expect(sections.map(one => one.name)).toEqual(['tool:market_data'])
  })

  it('registers only what config enables', async () => {
    const quoteOnly = await bench({ config: { history: false } })
    expect([...quoteOnly.tools.keys()]).toEqual(['market_quote'])

    const historyOnly = await bench({ config: { quote: false } })
    expect([...historyOnly.tools.keys()]).toEqual(['market_history'])
  })

  it('declares the services it binds', () => {
    expect(inject).toEqual(['tools', 'marketData', 'systemPrompt'])
  })

  it('accepts exactly the seam\'s venues', () => {
    expect(MARKETS).toEqual(['SSE', 'SZSE', 'BSE', 'HKEX', 'NASDAQ', 'NYSE'])
  })
})

describe('market_quote execution', () => {
  it('returns the canonical quote value including its observation time', async () => {
    const { tools } = await bench()
    const value = await call(tools, 'market_quote', { market: 'SZSE', symbol: '300750' }) as Record<string, unknown>

    expect(value.name).toBe('宁德时代')
    expect(value.currency).toBe('CNY')
    expect(value.asOf).toBe('2026-08-14T07:00:00.000Z')
    expect(value.session).toBe('closed')
    expect(typeof value.changePercent).toBe('number')
  })

  it('surfaces the seam refusal when no provider is registered', async () => {
    const { tools } = await bench({ provider: false })

    await expect(call(tools, 'market_quote', { market: 'SZSE', symbol: '300750' })).rejects
      .toThrow(expect.objectContaining({ code: 'MARKET_DATA_PROVIDER_UNAVAILABLE' }))
  })

  it('surfaces an unknown instrument as the provider\'s structured refusal', async () => {
    const { tools } = await bench()

    await expect(call(tools, 'market_quote', { market: 'NYSE', symbol: 'NOPE' })).rejects
      .toThrow(expect.objectContaining({ code: 'MARKET_DATA_UNKNOWN_INSTRUMENT' }))
  })
})

describe('market_history execution', () => {
  it('defaults the session count when the model omits one', async () => {
    const { tools } = await bench()
    const value = await call(tools, 'market_history', { market: 'SZSE', symbol: '300750' }) as { bars: unknown[] }

    expect(value.bars).toHaveLength(DEFAULT_HISTORY_SESSIONS)
  })

  it('honors an explicit session count and reports the adjustment', async () => {
    const { tools } = await bench()
    const value = await call(tools, 'market_history', { market: 'SSE', symbol: '600519', sessions: 5 }) as
      { bars: { date: string }[]; adjustment: string }

    expect(value.bars).toHaveLength(5)
    expect(value.adjustment).toBe('none')
    // Oldest first, so the range reads forward in time.
    expect(value.bars[0]!.date < value.bars[4]!.date).toBe(true)
  })

  it('honors a configured default session count', async () => {
    const { tools } = await bench({ config: { defaultHistorySessions: 3 } })
    const value = await call(tools, 'market_history', { market: 'SZSE', symbol: '300274' }) as { bars: unknown[] }

    expect(value.bars).toHaveLength(3)
  })

  it('refuses a range above the seam ceiling rather than trimming it', async () => {
    const { tools } = await bench()

    await expect(call(tools, 'market_history', { market: 'SZSE', symbol: '300750', sessions: 501 })).rejects
      .toThrow(expect.objectContaining({ code: 'MARKET_DATA_HISTORY_RANGE_REFUSED' }))
  })
})

describe('argument validation', () => {
  it('rejects a blank symbol the schema cannot exclude', () => {
    expect(() => parseSymbol('   ')).toThrow('symbol must be a non-empty string')
    expect(parseSymbol('  300750  ')).toBe('300750')
  })

  it('trims a padded symbol before it reaches the seam', async () => {
    const { tools } = await bench()
    const value = await call(tools, 'market_quote', { market: 'SZSE', symbol: ' 300750 ' }) as { name: string }

    expect(value.name).toBe('宁德时代')
  })
})

describe('model-facing formatting', () => {
  it('leads a quote with the instrument and states its as-of instant', () => {
    const text = formatQuote({ market: 'SZSE', symbol: '300750' }, {
      name: '宁德时代',
      currency: 'CNY',
      last: 212.3,
      previousClose: 228.28,
      changePercent: -7,
      volume: 41_200_000,
      asOf: '2026-08-14T07:00:00.000Z',
      session: 'closed',
    })

    expect(text).toContain('宁德时代 (SZSE:300750)')
    expect(text).toContain('Last 212.3 CNY (-7% vs previous close 228.28)')
    expect(text).toContain('As of 2026-08-14T07:00:00.000Z; venue closed.')
  })

  it('marks a positive change explicitly so the sign is never ambiguous', () => {
    const text = formatQuote({ market: 'SSE', symbol: '600519' }, {
      name: '贵州茅台',
      currency: 'CNY',
      last: 101,
      previousClose: 100,
      changePercent: 1,
      volume: 1,
      asOf: '2026-08-14T07:00:00.000Z',
      session: 'open',
    })

    expect(text).toContain('(+1% vs previous close 100)')
  })

  it('names the adjustment in the history header', () => {
    const text = formatHistory({ market: 'SZSE', symbol: '300750' }, {
      bars: [{ date: '2026-08-14', open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 }],
      adjustment: 'backward',
    })

    expect(text).toContain('SZSE:300750 — 1 sessions, backward adjustment')
    expect(text).toContain('2026-08-14  open 1  high 2  low 0.5  close 1.5  volume 10')
  })

  it('says so plainly when a provider returns no sessions', () => {
    const text = formatHistory({ market: 'SZSE', symbol: '300750' }, {
      bars: [],
      adjustment: 'none',
    })

    expect(text).toContain('(no sessions returned)')
  })
})

describe('price-series presentation', () => {
  const bars = [{ date: '2026-08-14', open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 }]

  it('projects bars into replayable meta and reads them back', () => {
    const meta = historyMetaFromValue({ bars, adjustment: 'backward' })

    expect(historyMetaFromResult(meta)).toEqual({ bars, adjustment: 'backward' })
  })

  it('renders a price-series card carrying the adjustment', () => {
    const view = presentHistoryResult(
      { market: 'SZSE', symbol: '300750' },
      { isError: false, meta: historyMetaFromValue({ bars, adjustment: 'none' }) } as never,
    )

    expect(view).toEqual({
      card: 'price-series',
      title: 'History SZSE:300750',
      label: 'SZSE:300750',
      bars,
      adjustment: 'none',
    })
  })

  it('falls back to the generic card on an errored call', () => {
    const view = presentHistoryResult(
      { market: 'SZSE', symbol: '300750' },
      { isError: true, meta: historyMetaFromValue({ bars, adjustment: 'none' }) } as never,
    )

    expect(view).toEqual({ card: 'generic', title: 'History SZSE:300750' })
  })

  it.each([
    ['absent', undefined],
    ['a non-object', 'nope'],
    ['an array', []],
    ['bars that are not bars', { bars: [{ date: '2026-08-14' }], adjustment: 'none' }],
    ['bars that are not an array', { bars: 'many', adjustment: 'none' }],
    ['an unknown adjustment', { bars: [], adjustment: 'sideways' }],
  ])('falls back to the generic card when meta is %s', (_label, meta) => {
    expect(historyMetaFromResult(meta)).toBeUndefined()
    expect(presentHistoryResult({ market: 'SZSE', symbol: '300750' }, { isError: false, meta } as never))
      .toEqual({ card: 'generic', title: 'History SZSE:300750' })
  })
})

describe('tool-market-data invariant companion', () => {
  it('reserves package ownership under its declared companion name', async () => {
    const ctx = new Context()
    await ctx.plugin(InvariantRegistry, { enabled: true })
    const fiber = ctx.plugin(ToolInvariant)
    await fiber.await()

    expect(ToolInvariant.name).toBe('tool-market-data-invariant')
    expect(ToolInvariant.inject).toEqual(['invariants'])
    await fiber.dispose()
  })
})
