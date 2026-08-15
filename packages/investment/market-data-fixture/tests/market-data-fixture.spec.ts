/**
 * Fixture provider: determinism across constructions, registration on the
 * seam, weekend-skipping trading dates, and the unknown-instrument refusal.
 */
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import InvariantRegistry from '@deepseek-ai/dsh-invariants'
import MarketDataRuntime from '@deepseek-ai/dsh-market-data'
import { apply, Config, createFixtureProvider, DEFAULT_ANCHOR_DATE, inject, PROVIDER_ID } from '../src/index.ts'
import * as FixtureInvariant from '../src/invariant.ts'

const known = { market: 'SZSE', symbol: '300750' } as const
const unknown = { market: 'NYSE', symbol: 'NOPE' } as const

describe('fixture provider values', () => {
  it('returns identical values across independent constructions', async () => {
    const first = createFixtureProvider(DEFAULT_ANCHOR_DATE)
    const second = createFixtureProvider(DEFAULT_ANCHOR_DATE)

    expect(await first.quote({ instrument: known })).toEqual(await second.quote({ instrument: known }))
    expect(await first.priceHistory({ instrument: known, sessions: 30 }))
      .toEqual(await second.priceHistory({ instrument: known, sessions: 30 }))
  })

  it('prices the anchor session against the one before it', async () => {
    const provider = createFixtureProvider(DEFAULT_ANCHOR_DATE)
    const quote = await provider.quote({ instrument: known })
    const bars = await provider.priceHistory({ instrument: known, sessions: 2 })

    expect(quote.asOf).toBe(`${DEFAULT_ANCHOR_DATE}T07:00:00.000Z`)
    expect(quote.session).toBe('closed')
    expect(quote.name).toBe('宁德时代')
    expect(quote.currency).toBe('CNY')
    // The last bar is the anchor session and the one before it is the reference.
    expect(quote.last).toBe(bars.bars[1]?.close)
    expect(quote.previousClose).toBe(bars.bars[0]?.close)
  })

  it('returns bars oldest first, one per session, skipping weekends', async () => {
    const provider = createFixtureProvider('2026-08-14')
    const { bars, adjustment } = await provider.priceHistory({ instrument: known, sessions: 5 })

    expect(adjustment).toBe('none')
    // 2026-08-14 is a Friday, so the five sessions run back through Monday.
    expect(bars.map(one => one.date)).toEqual([
      '2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13', '2026-08-14',
    ])
  })

  it('keeps every bar internally consistent', async () => {
    const provider = createFixtureProvider(DEFAULT_ANCHOR_DATE)
    const { bars } = await provider.priceHistory({ instrument: known, sessions: 40 })

    expect(bars).toHaveLength(40)
    for (const one of bars) {
      expect(one.high).toBeGreaterThanOrEqual(Math.max(one.open, one.close))
      expect(one.low).toBeLessThanOrEqual(Math.min(one.open, one.close))
      expect(one.volume).toBeGreaterThan(0)
    }
  })

  it('honors a different anchor date', async () => {
    const provider = createFixtureProvider('2026-01-30')
    const { bars } = await provider.priceHistory({ instrument: known, sessions: 1 })

    expect(bars[0]?.date).toBe('2026-01-30')
  })

  it('refuses an instrument the table does not carry', async () => {
    const provider = createFixtureProvider(DEFAULT_ANCHOR_DATE)

    await expect(provider.quote({ instrument: unknown })).rejects
      .toThrow(expect.objectContaining({ code: 'MARKET_DATA_UNKNOWN_INSTRUMENT' }))
    await expect(provider.priceHistory({ instrument: unknown, sessions: 5 })).rejects
      .toThrow(expect.objectContaining({ code: 'MARKET_DATA_UNKNOWN_INSTRUMENT' }))
  })

  it('is always usable, having no credential to lose', async () => {
    await expect(createFixtureProvider(DEFAULT_ANCHOR_DATE).available()).resolves.toBe(true)
    expect(createFixtureProvider(DEFAULT_ANCHOR_DATE).id).toBe(PROVIDER_ID)
  })
})

describe('fixture instrument lookup', () => {
  const provider = createFixtureProvider(DEFAULT_ANCHOR_DATE)

  it('matches a code from its start, because a partial code is a prefix', async () => {
    expect((await provider.search({ query: '3007', limit: 8 })).matches)
      .toEqual([{ instrument: { market: 'SZSE', symbol: '300750' }, name: '宁德时代' }])
    // A code's tail is not a code, so a suffix names nothing.
    expect((await provider.search({ query: '0750', limit: 8 })).matches).toEqual([])
  })

  it('matches a name anywhere, because a person types its distinctive part', async () => {
    expect((await provider.search({ query: '茅台', limit: 8 })).matches)
      .toEqual([{ instrument: { market: 'SSE', symbol: '600519' }, name: '贵州茅台' }])
  })

  it('matches a venue, so a user can see what it lists', async () => {
    const { matches } = await provider.search({ query: 'szse', limit: 8 })

    expect(matches.map(match => match.instrument.symbol)).toEqual(['300750', '300274'])
  })

  it('honors the caller limit', async () => {
    expect((await provider.search({ query: 'SZSE', limit: 1 })).matches).toHaveLength(1)
  })

  it('resolves empty for a blank query rather than listing the whole table', async () => {
    expect(await provider.search({ query: '   ', limit: 8 })).toEqual({ matches: [] })
  })

  it('resolves empty for a query that names nothing', async () => {
    expect(await provider.search({ query: 'zzzz', limit: 8 })).toEqual({ matches: [] })
  })
})

describe('fixture provider registration', () => {
  it('registers on the seam and unregisters with the fiber', async () => {
    const ctx = new Context()
    await ctx.plugin(MarketDataRuntime, { maxHistorySessions: 500, maxSearchMatches: 20 }).await()
    const fiber = ctx.plugin({ name: 'fixture', inject: [...inject], apply, Config }, {})
    await fiber.await()

    expect((await ctx.marketData.quote({ instrument: known })).name).toBe('宁德时代')

    await fiber.dispose()
    await expect(ctx.marketData.quote({ instrument: known })).rejects
      .toThrow(expect.objectContaining({ code: 'MARKET_DATA_PROVIDER_UNAVAILABLE' }))
  })

  it('defaults the anchor date through its config schema', () => {
    expect(Config({}).anchorDate).toBe(DEFAULT_ANCHOR_DATE)
  })
})

describe('fixture invariant companion', () => {
  it('reserves package ownership under its declared companion name', async () => {
    const ctx = new Context()
    await ctx.plugin(InvariantRegistry, { enabled: true })
    const fiber = ctx.plugin(FixtureInvariant)
    await fiber.await()

    expect(FixtureInvariant.name).toBe('market-data-fixture-invariant')
    expect(FixtureInvariant.inject).toEqual(['invariants'])
    await fiber.dispose()
  })
})
