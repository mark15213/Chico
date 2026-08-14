/**
 * Market-data seam: provider registration and disposal, execution-time
 * selection under every configured/auto/ambiguous branch, and the history
 * ceiling that refuses rather than trims.
 */
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import InvariantRegistry from '@deepseek-ai/dsh-invariants'
import MarketDataRuntime, { MarketDataError } from '../src/index.ts'
import type { MarketDataProvider, PriceHistory, Quote } from '../src/index.ts'
import * as MarketDataInvariant from '../src/invariant.ts'

const instrument = { market: 'SZSE', symbol: '300750' } as const

const quote: Quote = {
  instrument,
  name: '宁德时代',
  currency: 'CNY',
  last: 212.3,
  previousClose: 228.28,
  changePercent: -7,
  volume: 41_200_000,
  asOf: '2026-08-14T07:00:00.000Z',
  session: 'closed',
}

const history: PriceHistory = {
  instrument,
  bars: [{ date: '2026-08-13', open: 226, high: 231, low: 225, close: 228.28, volume: 30_100_000 }],
  adjustment: 'backward',
}

/**
 * A provider whose id, availability, and responses the test controls. The
 * mocks are also reachable through `calls` so assertions read them as plain
 * values rather than as methods detached from their receiver.
 */
type StubProvider = MarketDataProvider & {
  calls: { quote: ReturnType<typeof vi.fn>; priceHistory: ReturnType<typeof vi.fn> }
}

function stubProvider(id: string, available = true): StubProvider {
  const calls = {
    quote: vi.fn(async () => quote),
    priceHistory: vi.fn(async () => history),
  }
  return { id, available: () => available, ...calls, calls }
}

/** Boot the seam with the given config over a bare context. */
async function bench(config: Partial<{ provider: string; maxHistorySessions: number }> = {}) {
  const ctx = new Context()
  await ctx.plugin(MarketDataRuntime, { maxHistorySessions: 500, ...config }).await()
  return ctx
}

describe('market-data provider registry', () => {
  it('registers a provider and serves both operations through it', async () => {
    const ctx = await bench()
    const provider = stubProvider('fixture')
    ctx.marketData.registerProvider(provider)

    expect(await ctx.marketData.quote({ instrument })).toBe(quote)
    expect(await ctx.marketData.priceHistory({ instrument, sessions: 60 })).toBe(history)
    expect(provider.calls.quote).toHaveBeenCalledWith({ instrument }, undefined)
    expect(provider.calls.priceHistory).toHaveBeenCalledWith({ instrument, sessions: 60 }, undefined)
  })

  it('forwards the caller cancellation signal to the provider', async () => {
    const ctx = await bench()
    const provider = stubProvider('fixture')
    ctx.marketData.registerProvider(provider)
    const signal = new AbortController().signal

    await ctx.marketData.quote({ instrument }, signal)
    await ctx.marketData.priceHistory({ instrument, sessions: 5 }, signal)
    expect(provider.calls.quote).toHaveBeenCalledWith({ instrument }, signal)
    expect(provider.calls.priceHistory).toHaveBeenCalledWith({ instrument, sessions: 5 }, signal)
  })

  it('rejects a duplicate provider id without disturbing the registered one', async () => {
    const ctx = await bench()
    ctx.marketData.registerProvider(stubProvider('fixture'))

    expect(() => ctx.marketData.registerProvider(stubProvider('fixture')))
      .toThrow(expect.objectContaining({ code: 'MARKET_DATA_DUPLICATE_PROVIDER' }))
    expect(await ctx.marketData.quote({ instrument })).toBe(quote)
  })

  it('unregisters through the returned disposer', async () => {
    const ctx = await bench()
    const dispose = ctx.marketData.registerProvider(stubProvider('fixture'))
    dispose()

    await expect(ctx.marketData.quote({ instrument })).rejects
      .toThrow(expect.objectContaining({ code: 'MARKET_DATA_PROVIDER_UNAVAILABLE' }))
  })
})

describe('market-data provider selection', () => {
  it('auto-selects the single usable provider regardless of registration order', async () => {
    const ctx = await bench()
    ctx.marketData.registerProvider(stubProvider('unusable', false))
    ctx.marketData.registerProvider(stubProvider('usable'))

    expect(await ctx.marketData.quote({ instrument })).toBe(quote)
  })

  it('refuses to guess between two usable providers', async () => {
    const ctx = await bench()
    ctx.marketData.registerProvider(stubProvider('a'))
    ctx.marketData.registerProvider(stubProvider('b'))

    await expect(ctx.marketData.quote({ instrument })).rejects
      .toThrow(expect.objectContaining({ code: 'MARKET_DATA_PROVIDER_AMBIGUOUS' }))
  })

  it('honors a configured id even when another provider is usable', async () => {
    const ctx = await bench({ provider: 'chosen' })
    const chosen = stubProvider('chosen')
    ctx.marketData.registerProvider(stubProvider('other'))
    ctx.marketData.registerProvider(chosen)

    await ctx.marketData.quote({ instrument })
    expect(chosen.calls.quote).toHaveBeenCalled()
  })

  it('reports a configured id that is not registered', async () => {
    const ctx = await bench({ provider: 'absent' })
    ctx.marketData.registerProvider(stubProvider('present'))

    await expect(ctx.marketData.quote({ instrument })).rejects
      .toThrow(expect.objectContaining({ code: 'MARKET_DATA_PROVIDER_CONFIGURED_MISSING' }))
  })

  it('reports a configured id that is registered but unavailable', async () => {
    const ctx = await bench({ provider: 'dark' })
    ctx.marketData.registerProvider(stubProvider('dark', false))

    await expect(ctx.marketData.quote({ instrument })).rejects
      .toThrow(expect.objectContaining({ code: 'MARKET_DATA_PROVIDER_CONFIGURED_UNAVAILABLE' }))
  })
})

describe('market-data history ceiling', () => {
  it('refuses a range above the ceiling rather than trimming it', async () => {
    const ctx = await bench({ maxHistorySessions: 60 })
    const provider = stubProvider('fixture')
    ctx.marketData.registerProvider(provider)

    await expect(ctx.marketData.priceHistory({ instrument, sessions: 61 })).rejects
      .toThrow(expect.objectContaining({ code: 'MARKET_DATA_HISTORY_RANGE_REFUSED' }))
    // A refused range never reaches the provider, so no partial answer exists.
    expect(provider.calls.priceHistory).not.toHaveBeenCalled()
  })

  it('serves a range exactly at the ceiling', async () => {
    const ctx = await bench({ maxHistorySessions: 60 })
    ctx.marketData.registerProvider(stubProvider('fixture'))

    expect(await ctx.marketData.priceHistory({ instrument, sessions: 60 })).toBe(history)
  })
})

describe('MarketDataError', () => {
  it('carries its code and a distinguishable name', () => {
    const error = new MarketDataError('nope', 'MARKET_DATA_UNKNOWN_INSTRUMENT')
    expect(error.code).toBe('MARKET_DATA_UNKNOWN_INSTRUMENT')
    expect(error.name).toBe('MarketDataError')
    expect(error).toBeInstanceOf(Error)
  })
})

describe('market-data invariant companion', () => {
  it('reserves package ownership under its declared companion name', async () => {
    const ctx = new Context()
    await ctx.plugin(InvariantRegistry, { enabled: true })
    const fiber = ctx.plugin(MarketDataInvariant)
    await fiber.await()

    expect(MarketDataInvariant.name).toBe('market-data-invariant')
    expect(MarketDataInvariant.inject).toEqual(['invariants'])
    await fiber.dispose()
  })
})
