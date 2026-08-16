/**
 * The mock provider: what the compiled dataset serves for lookup, quote, and
 * history, the refusals it raises instead of inventing a listing, the switch
 * that takes it out of selection, and the registration's disposal.
 */
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import MarketDataRuntime from '@deepseek-ai/dsh-market-data'
import { apply, Config, createMockProvider, inject, name, PROVIDER_ID } from '../src/index.ts'
import { ANCHOR_DATE, DATASET } from '../src/dataset.ts'
import * as MockInvariant from '../src/invariant.ts'

const CATL = { market: 'SZSE', symbol: '300750' } as const
const provider = createMockProvider(true)

describe('compiled dataset', () => {
  it('carries every column aligned, ascending, and ending on the anchor', () => {
    expect(DATASET.length).toBeGreaterThan(0)
    for (const series of DATASET) {
      const dates = series.dates.split(',')
      expect(series.open).toHaveLength(dates.length)
      expect(series.high).toHaveLength(dates.length)
      expect(series.low).toHaveLength(dates.length)
      expect(series.close).toHaveLength(dates.length)
      expect(series.volume).toHaveLength(dates.length)
      expect(dates.at(-1)).toBe(ANCHOR_DATE.replace(/-/g, ''))
      for (let i = 1; i < dates.length; i += 1) {
        expect(dates[i] as string > (dates[i - 1] as string)).toBe(true)
      }
    }
  })

  it('holds bars a venue could have printed', () => {
    for (const series of DATASET) {
      for (let i = 0; i < series.close.length; i += 1) {
        const open = series.open[i] as number
        const high = series.high[i] as number
        const low = series.low[i] as number
        const close = series.close[i] as number
        expect(low).toBeLessThanOrEqual(Math.min(open, close))
        expect(high).toBeGreaterThanOrEqual(Math.max(open, close))
        expect(series.volume[i] as number).toBeGreaterThan(0)
      }
    }
  })
})

describe('lookup', () => {
  it('matches a code from its start and a name anywhere in it', async () => {
    await expect(provider.search({ query: '3007', limit: 5 }))
      .resolves.toEqual({ matches: [{ instrument: CATL, name: '宁德时代' }] })
    await expect(provider.search({ query: '德时', limit: 5 }))
      .resolves.toEqual({ matches: [{ instrument: CATL, name: '宁德时代' }] })
  })

  it('matches by venue, and honours the caller’s limit', async () => {
    const all = await provider.search({ query: 'SSE', limit: 20 })
    const capped = await provider.search({ query: 'SSE', limit: 2 })

    expect(all.matches.length).toBeGreaterThan(2)
    expect(capped.matches).toHaveLength(2)
  })

  it('answers an empty query with no matches rather than the whole table', async () => {
    await expect(provider.search({ query: '   ', limit: 5 })).resolves.toEqual({ matches: [] })
  })

  it('finds nothing for a query the dataset does not carry', async () => {
    await expect(provider.search({ query: 'NVDA', limit: 5 })).resolves.toEqual({ matches: [] })
  })
})

describe('quote', () => {
  it('prices the anchor session against the one before it', async () => {
    const quote = await provider.quote({ instrument: CATL })
    const series = DATASET.find(entry => entry.symbol === '300750')
    const last = series!.close.length - 1

    expect(quote.name).toBe('宁德时代')
    expect(quote.currency).toBe('CNY')
    expect(quote.last).toBe(series!.close[last])
    expect(quote.previousClose).toBe(series!.close[last - 1])
    expect(quote.changePercent)
      .toBeCloseTo(((series!.close[last] as number) / (series!.close[last - 1] as number) - 1) * 100, 1)
    expect(quote.asOf.startsWith(ANCHOR_DATE)).toBe(true)
    // End-of-day data is never a live session, whatever the wall clock says.
    expect(quote.session).toBe('closed')
  })

  it('prices a Hong Kong listing in its own currency', async () => {
    await expect(provider.quote({ instrument: { market: 'HKEX', symbol: '00700' } }))
      .resolves.toEqual(expect.objectContaining({ currency: 'HKD', name: '腾讯控股' }))
  })

  it('refuses an instrument the dataset does not carry', async () => {
    await expect(provider.quote({ instrument: { market: 'NASDAQ', symbol: 'NVDA' } }))
      .rejects.toThrow(expect.objectContaining({ code: 'MARKET_DATA_UNKNOWN_INSTRUMENT' }))
  })
})

describe('history', () => {
  it('returns the trailing window, oldest first, with the compiled basis', async () => {
    const history = await provider.priceHistory({ instrument: CATL, sessions: 30 })

    expect(history.bars).toHaveLength(30)
    expect(history.adjustment).toBe('none')
    expect(history.bars.at(-1)?.date).toBe(ANCHOR_DATE)
    expect((history.bars[0]?.date ?? '') < ANCHOR_DATE).toBe(true)
  })

  it('returns what it has when asked for more sessions than the dataset holds', async () => {
    const compiled = DATASET.find(entry => entry.symbol === '300750')!.close.length
    const history = await provider.priceHistory({ instrument: CATL, sessions: compiled + 500 })

    expect(history.bars).toHaveLength(compiled)
  })

  it('refuses an instrument the dataset does not carry', async () => {
    await expect(provider.priceHistory({ instrument: { market: 'NYSE', symbol: 'X' }, sessions: 5 }))
      .rejects.toThrow(expect.objectContaining({ code: 'MARKET_DATA_UNKNOWN_INSTRUMENT' }))
  })
})

describe('availability', () => {
  it('is usable by default, needing no credential and no network', async () => {
    await expect(provider.available()).resolves.toBe(true)
  })

  it('reports itself unusable when the composition disabled it', async () => {
    await expect(createMockProvider(false).available()).resolves.toBe(false)
  })
})

describe('registration', () => {
  it('registers on the seam and unregisters on dispose (HMR safety)', async () => {
    const ctx = new Context()
    await ctx.plugin(MarketDataRuntime, {} as never).await()
    const fiber = ctx.plugin({ name, inject: [...inject], apply, Config }, {})
    await fiber.await()

    await expect(ctx.marketData.quote({ instrument: CATL })).resolves.toBeDefined()
    await fiber.dispose()
    // With the only provider gone, selection has nothing usable to resolve to.
    await expect(ctx.marketData.quote({ instrument: CATL }))
      .rejects.toThrow(expect.objectContaining({ code: 'MARKET_DATA_PROVIDER_UNAVAILABLE' }))
  })

  it('claims the documented registry id', () => {
    expect(PROVIDER_ID).toBe('mock')
    expect(name).toBe('market-data-mock')
  })

  it('takes itself out of selection when disabled, rather than serving invented prices', async () => {
    const ctx = new Context()
    await ctx.plugin(MarketDataRuntime, {} as never).await()
    await ctx.plugin({ name, inject: [...inject], apply, Config }, { disabled: true }).await()

    await expect(ctx.marketData.quote({ instrument: CATL }))
      .rejects.toThrow(expect.objectContaining({ code: 'MARKET_DATA_PROVIDER_UNAVAILABLE' }))
  })
})

describe('invariant companion', () => {
  it('reserves package ownership under its declared companion name', async () => {
    const ctx = new Context()
    const { default: InvariantRegistry } = await import('@deepseek-ai/dsh-invariants')
    await ctx.plugin(InvariantRegistry, { enabled: true })
    const fiber = ctx.plugin(MockInvariant)
    await fiber.await()

    expect(MockInvariant.name).toBe('market-data-mock-invariant')
    expect(MockInvariant.inject).toEqual(['invariants'])
    await fiber.dispose()
  })
})
