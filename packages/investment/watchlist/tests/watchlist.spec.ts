/**
 * Watchlist projection over the real registry, storage, and market-data
 * composition: the join, the decision that an unpriceable row survives while a
 * selection failure does not, the lookup that marks what is already followed,
 * one name read on its own, and the follow arc that resolves its own name.
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Storage from '@deepseek-ai/dsh-storage'
import { DomainFacility } from '@deepseek-ai/dsh-storage-domain'
import { MemoryMediaPool, MemoryStorageBackend } from '../../../storage/storage-domain/tests/helpers/memory-backend.ts'
import FollowedNamesService from '@deepseek-ai/dsh-followed-names'
import NameRecordService from '@deepseek-ai/dsh-name-record'
import MarketDataRuntime, { MarketDataError } from '@deepseek-ai/dsh-market-data'
import type { MarketDataProvider, Quote } from '@deepseek-ai/dsh-market-data'
// Source-plane import: the fixture raises MarketDataError, and the built
// package would carry a second copy of the class that `instanceof` misses.
import * as marketDataFixture from '../../market-data-fixture/src/index.ts'
import WatchlistService from '../src/index.ts'

const CATL = { market: 'SZSE', symbol: '300750' } as const
const MOUTAI = { market: 'SSE', symbol: '600519' } as const
const UNLISTED = { market: 'SZSE', symbol: '999999' } as const

const T1 = '2026-08-14T07:00:00.000Z'

let roots: string[] = []

afterEach(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true })
  roots = []
})

/** A throwaway archive root outside the developer's real harness home. */
function archiveRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'dsh-watchlist-'))
  roots.push(root)
  return join(root, 'archive')
}

/**
 * The registry and seam the projection reads, without the projection itself.
 * `provider` replaces the fixture when a test needs a specific failure;
 * `'none'` registers nothing, leaving selection with no candidate.
 */
async function composition(provider?: MarketDataProvider | 'none') {
  const ctx = new Context()
  await ctx.plugin(Storage)
  ctx.storage.backend.register('memory', new MemoryStorageBackend(new MemoryMediaPool()))
  const facility = new DomainFacility(ctx, { backend: 'memory', routes: {} })
  ctx.storage.mount('domain', facility)
  ctx.provide('storageDomain', facility)
  await ctx.plugin(FollowedNamesService, { archivePath: archiveRoot() }).await()
  await ctx.plugin(NameRecordService).await()
  await ctx.plugin(MarketDataRuntime, { maxHistorySessions: 500, maxSearchMatches: 20 }).await()
  if (provider === undefined) await ctx.plugin(marketDataFixture, {}).await()
  else if (provider !== 'none') ctx.marketData.registerProvider(provider)
  return ctx
}

/** The full composition a consumer sees: `ctx.watchlist` over both seams. */
async function bench(provider?: MarketDataProvider | 'none') {
  const ctx = await composition(provider)
  await ctx.plugin(WatchlistService).await()
  return ctx
}

/** A provider that prices one instrument and refuses everything else. */
function partialProvider(refusal: MarketDataError): MarketDataProvider {
  return {
    id: 'partial',
    available: () => true,
    search: () => Promise.resolve({ matches: [] }),
    quote: ({ instrument }) => instrument.symbol === CATL.symbol
      ? Promise.resolve(quoteOf(instrument.symbol))
      : Promise.reject(refusal),
    priceHistory: () => Promise.reject(new MarketDataError('unused', 'MARKET_DATA_UNKNOWN_INSTRUMENT')),
  }
}

/** A minimal quote; only the fields the join carries through matter here. */
function quoteOf(symbol: string): Quote {
  return {
    instrument: { market: 'SZSE', symbol },
    name: '宁德时代',
    currency: 'CNY',
    last: 212.3,
    previousClose: 210,
    changePercent: 1.1,
    volume: 1_000,
    asOf: T1,
    session: 'closed',
  }
}

describe('the watchlist join', () => {
  it('lists a followed name beside its current quote', async () => {
    const ctx = await bench()
    await ctx.followedNames.follow(CATL, '宁德时代', T1)

    const { rows } = await ctx.watchlist.list()

    expect(rows).toHaveLength(1)
    expect(rows[0]?.instrument).toEqual(CATL)
    expect(rows[0]?.displayName).toBe('宁德时代')
    expect(rows[0]?.firstFollowedAt).toBe(T1)
    expect(rows[0]?.openTheses).toBe(0)
    expect(rows[0]?.quote?.last).toBeGreaterThan(0)
    expect(rows[0]?.quote?.currency).toBe('CNY')
  })

  it('carries the recorded name, not the venue name, so a rename does not rewrite the record', async () => {
    const ctx = await bench()
    await ctx.followedNames.follow(CATL, 'CATL', T1)

    const { rows } = await ctx.watchlist.list()

    expect(rows[0]?.displayName).toBe('CATL')
    expect(rows[0]?.quote?.name).toBe('宁德时代')
  })

  it('omits an unfollowed name without losing its record', async () => {
    const ctx = await bench()
    await ctx.followedNames.follow(CATL, '宁德时代', T1)
    await ctx.followedNames.follow(MOUTAI, '贵州茅台', T1)
    await ctx.followedNames.unfollow(MOUTAI, T1)

    const { rows } = await ctx.watchlist.list()

    expect(rows.map(row => row.instrument.symbol)).toEqual([CATL.symbol])
    expect(ctx.followedNames.get(MOUTAI)?.followed).toBe(false)
  })

  it('is empty, not absent, before anything is followed', async () => {
    const ctx = await bench()

    expect(await ctx.watchlist.list()).toEqual({ rows: [] })
  })
})

describe('the row markers', () => {
  it('lists names in follow order, so the list does not reshuffle between glances', async () => {
    const ctx = await bench()
    await ctx.followedNames.follow(MOUTAI, '贵州茅台', '2026-08-20T07:00:00.000Z')
    await ctx.followedNames.follow(CATL, '宁德时代', T1)

    const { rows } = await ctx.watchlist.list()

    // CATL was followed first, so it leads regardless of write order.
    expect(rows.map(row => row.instrument.symbol)).toEqual([CATL.symbol, MOUTAI.symbol])
  })

  it('counts the theses still waiting, which is what the unverified marker draws', async () => {
    const ctx = await bench()
    await ctx.followedNames.follow(CATL, '宁德时代', T1)
    const thesis = await ctx.nameRecord.append(CATL, { kind: 'thesis', body: '毛利率见底', source: { kind: 'manual' } }, T1)
    await ctx.nameRecord.append(CATL, { kind: 'thesis', body: '订单慢一个季度', source: { kind: 'manual' } }, T1)

    expect((await ctx.watchlist.list()).rows[0]?.openTheses).toBe(2)

    await ctx.nameRecord.append(CATL, {
      kind: 'verification', body: '成立', source: { kind: 'manual' }, settles: thesis.id, verdict: 'confirmed',
    }, T1)

    expect((await ctx.watchlist.list()).rows[0]?.openTheses).toBe(1)
  })
})

describe('a row that cannot be priced', () => {
  it('keeps the row with a null quote, because a suspended name is the one to watch', async () => {
    const ctx = await bench(partialProvider(new MarketDataError('halted', 'MARKET_DATA_UNKNOWN_INSTRUMENT')))
    await ctx.followedNames.follow(CATL, '宁德时代', T1)
    await ctx.followedNames.follow(MOUTAI, '贵州茅台', T1)

    const { rows } = await ctx.watchlist.list()

    expect(rows).toHaveLength(2)
    expect(rows.find(row => row.instrument.symbol === MOUTAI.symbol)?.quote).toBeNull()
    expect(rows.find(row => row.instrument.symbol === CATL.symbol)?.quote).not.toBeNull()
  })

  it('degrades on any per-instrument failure, including one the seam did not raise', async () => {
    const provider: MarketDataProvider = {
      id: 'flaky',
      available: () => true,
      search: () => Promise.resolve({ matches: [] }),
      quote: () => Promise.reject(new Error('socket hang up')),
      priceHistory: () => Promise.reject(new Error('unused')),
    }
    const ctx = await bench(provider)
    await ctx.followedNames.follow(CATL, '宁德时代', T1)

    expect((await ctx.watchlist.list()).rows[0]?.quote).toBeNull()
  })

  it('raises a selection failure instead, so a watchlist of dashes cannot hide it', async () => {
    // No provider registered at all: every row would degrade identically.
    const ctx = await bench('none')
    await ctx.followedNames.follow(CATL, '宁德时代', T1)

    await expect(ctx.watchlist.list()).rejects.toMatchObject({
      code: 'MARKET_DATA_PROVIDER_UNAVAILABLE',
    })
  })
})

describe('the instrument lookup', () => {
  it('finds a listing by code and by name', async () => {
    const ctx = await bench()

    expect((await ctx.watchlist.search('300750', 8)).matches)
      .toEqual([{ instrument: CATL, name: '宁德时代', followed: false }])
    expect((await ctx.watchlist.search('茅台', 8)).matches)
      .toEqual([{ instrument: MOUTAI, name: '贵州茅台', followed: false }])
  })

  it('marks a match already on the watchlist, so a picker cannot offer it twice', async () => {
    const ctx = await bench()
    await ctx.followedNames.follow(CATL, '宁德时代', T1)

    const { matches } = await ctx.watchlist.search('300750', 8)

    expect(matches[0]?.followed).toBe(true)
  })

  it('does not mark an unfollowed record as followed, since the picker offers to re-add it', async () => {
    const ctx = await bench()
    await ctx.followedNames.follow(CATL, '宁德时代', T1)
    await ctx.followedNames.unfollow(CATL, T1)

    expect((await ctx.watchlist.search('300750', 8)).matches[0]?.followed).toBe(false)
  })

  it('resolves empty for a query that names nothing', async () => {
    const ctx = await bench()

    expect(await ctx.watchlist.search('zzzz', 8)).toEqual({ matches: [] })
  })

  it('refuses a limit above the seam ceiling rather than returning a truncated list', async () => {
    const ctx = await bench()

    await expect(ctx.watchlist.search('3', 21)).rejects.toMatchObject({
      code: 'MARKET_DATA_SEARCH_RANGE_REFUSED',
    })
  })
})

describe('following by code', () => {
  it('takes the display name from the venue rather than from the caller', async () => {
    const ctx = await bench()

    const result = await ctx.watchlist.follow(CATL)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.row.displayName).toBe('宁德时代')
    expect(ctx.followedNames.get(CATL)?.displayName).toBe('宁德时代')
  })

  it('reports an unlisted code as a value, since typing one is what a user does', async () => {
    const ctx = await bench()

    expect(await ctx.watchlist.follow(UNLISTED)).toEqual({ ok: false, reason: 'unknown-instrument' })
    expect(ctx.followedNames.get(UNLISTED)).toBeUndefined()
  })

  it('raises a selection failure rather than reporting it as an unlisted code', async () => {
    const ctx = await bench(partialProvider(
      new MarketDataError('no entitlement', 'MARKET_DATA_PROVIDER_CONFIGURED_UNAVAILABLE'),
    ))

    await expect(ctx.watchlist.follow(MOUTAI)).rejects.toMatchObject({
      code: 'MARKET_DATA_PROVIDER_CONFIGURED_UNAVAILABLE',
    })
  })

  it('keeps the original follow instant when a name is re-followed', async () => {
    const ctx = await bench()
    await ctx.followedNames.follow(CATL, '宁德时代', T1)
    await ctx.watchlist.unfollow(CATL)

    const result = await ctx.watchlist.follow(CATL)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.row.firstFollowedAt).toBe(T1)
  })

  it('stamps a fresh instant for a name followed for the first time', async () => {
    const ctx = await bench()

    const result = await ctx.watchlist.follow(MOUTAI)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(Number.isNaN(Date.parse(result.row.firstFollowedAt))).toBe(false)
  })
})

describe('one name read on its own', () => {
  it('joins the record with its quote and its history in one call', async () => {
    const ctx = await bench()
    await ctx.followedNames.follow(CATL, '宁德时代', T1)

    const dossier = await ctx.watchlist.dossier(CATL, 30)

    expect(dossier.displayName).toBe('宁德时代')
    expect(dossier.firstFollowedAt).toBe(T1)
    expect(dossier.followed).toBe(true)
    expect(dossier.quote?.currency).toBe('CNY')
    expect(dossier.bars).toHaveLength(30)
    expect(dossier.adjustment).toBe('none')
  })

  it('degrades the quote and the history separately rather than failing the page', async () => {
    const ctx = await bench(partialProvider(new MarketDataError('halted', 'MARKET_DATA_UNKNOWN_INSTRUMENT')))
    await ctx.followedNames.follow(MOUTAI, '贵州茅台', T1)

    const dossier = await ctx.watchlist.dossier(MOUTAI, 30)

    expect(dossier.quote).toBeNull()
    expect(dossier.bars).toEqual([])
    // The record is what the page is about; it survives both refusals.
    expect(dossier.displayName).toBe('贵州茅台')
  })

  it('raises a selection failure instead of presenting an empty page', async () => {
    const ctx = await bench('none')
    await ctx.followedNames.follow(CATL, '宁德时代', T1)

    await expect(ctx.watchlist.dossier(CATL, 30)).rejects.toMatchObject({
      code: 'MARKET_DATA_PROVIDER_UNAVAILABLE',
    })
  })

  it('refuses an instrument with no record, since a dossier is about a record', async () => {
    const ctx = await bench()

    await expect(ctx.watchlist.dossier(CATL, 30)).rejects.toMatchObject({
      code: 'FOLLOWED_NAME_UNKNOWN',
    })
  })

  it('still reads a name taken off the watchlist, and says it is not followed', async () => {
    const ctx = await bench()
    await ctx.followedNames.follow(CATL, '宁德时代', T1)
    await ctx.followedNames.unfollow(CATL, T1)

    const dossier = await ctx.watchlist.dossier(CATL, 30)

    expect(dossier.followed).toBe(false)
    expect(dossier.firstFollowedAt).toBe(T1)
  })
})

describe('unfollowing', () => {
  it('returns the remaining count so a caller reconciles without a second read', async () => {
    const ctx = await bench()
    await ctx.followedNames.follow(CATL, '宁德时代', T1)
    await ctx.followedNames.follow(MOUTAI, '贵州茅台', T1)

    expect(await ctx.watchlist.unfollow(MOUTAI)).toBe(1)
    expect((await ctx.watchlist.list()).rows).toHaveLength(1)
  })

  it('refuses an instrument with no record rather than reporting a silent success', async () => {
    const ctx = await bench()

    await expect(ctx.watchlist.unfollow(UNLISTED)).rejects.toMatchObject({
      code: 'FOLLOWED_NAME_UNKNOWN',
    })
  })
})

describe('where a conversation about a name runs', () => {
  it('reports the archive directory the registry owns', async () => {
    const ctx = await bench()

    expect(ctx.watchlist.archive()).toEqual({ path: ctx.followedNames.archivePath })
  })
})

describe('service lifecycle', () => {
  it('withdraws ctx.watchlist when its fiber disposes (HMR safety)', async () => {
    const ctx = await composition()
    const fiber = ctx.plugin(WatchlistService)
    await fiber.await()

    await fiber.dispose()

    expect(ctx.get('watchlist')).toBeUndefined()
  })
})
