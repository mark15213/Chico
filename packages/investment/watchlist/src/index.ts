/**
 * Watchlist projection (`ctx.watchlist`): the browser-facing join of the
 * followed-names registry with current quotes, exposed over Typert Remote.
 *
 * This is a Consumer of two capability seams rather than a seam of its own.
 * The registry deliberately knows nothing about prices, and the market-data
 * seam knows nothing about what a user follows; a surface that shows a name
 * beside its price needs both, and that join lives here so neither seam grows
 * a dependency on the other.
 * @module @deepseek-ai/dsh-watchlist
 */

import { Context } from '@deepseek-ai/cordis'
import { TypertRemoteService, Remote } from '@deepseek-ai/dsh-typert-protocol'
// Typert-generated ./typert and ./remote artifacts import Zod at runtime.
import type {} from 'zod'
import type { FollowedName } from '@deepseek-ai/dsh-followed-names'
import type { InstrumentRef, Quote } from '@deepseek-ai/dsh-market-data'
import { MarketDataError } from '@deepseek-ai/dsh-market-data'
import type { WatchlistFollowResult, WatchlistRow, WatchlistSnapshot } from './types.ts'

export type * from './types.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    watchlist: WatchlistService
  }
}

/**
 * Market-data failures that describe provider selection rather than one
 * instrument. Every row would degrade identically, so a watchlist of dashes
 * would hide a composition error behind what looks like missing prices.
 */
const SELECTION_FAILURES = new Set([
  'MARKET_DATA_PROVIDER_CONFIGURED_MISSING',
  'MARKET_DATA_PROVIDER_CONFIGURED_UNAVAILABLE',
  'MARKET_DATA_PROVIDER_AMBIGUOUS',
  'MARKET_DATA_PROVIDER_UNAVAILABLE',
])

/** Whether a failure describes provider selection rather than one instrument. */
function isSelectionFailure(error: unknown): boolean {
  return error instanceof MarketDataError && SELECTION_FAILURES.has(error.code)
}

/** Whether a failure says the venue does not list the requested code. */
function isUnknownInstrument(error: unknown): boolean {
  return error instanceof MarketDataError && error.code === 'MARKET_DATA_UNKNOWN_INSTRUMENT'
}

/**
 * The watchlist service. Registered as `ctx.watchlist` (one instance per
 * context) and reachable from a browser as the `watchlist` Remote namespace.
 */
export class WatchlistService extends TypertRemoteService {
  static inject = ['followedNames', 'marketData']

  /** @param ctx - Host context carrying the registry and the market-data seam. */
  constructor(ctx: Context) {
    super(ctx, 'watchlist')
  }

  /**
   * Every followed name with its current quote, priced concurrently.
   *
   * A quote that fails degrades its own row to `quote: null`, except when the
   * failure is provider selection, which raises for the whole call.
   * @param signal - optional cancellation signal, forwarded to each quote.
   * @returns the current rows in the registry's own order.
   * @throws {@link MarketDataError} when no usable provider can be selected.
   */
  @Remote('list')
  async list(signal?: AbortSignal): Promise<WatchlistSnapshot> {
    const records = this.ctx.followedNames.listFollowed()
    const rows = await Promise.all(records.map(record => this.row(record, signal)))
    return { rows }
  }

  /**
   * Follow an instrument named by venue and code, taking its display name from
   * the venue rather than from the caller. Re-following a name that was
   * unfollowed restores it with its original `firstFollowedAt`.
   * @param instrument - the venue and code to follow.
   * @param signal - optional cancellation signal for the resolving quote.
   * @returns the stored row, or the unknown-instrument outcome.
   * @throws {@link MarketDataError} when no usable provider can be selected.
   */
  @Remote('follow')
  async follow(instrument: InstrumentRef, signal?: AbortSignal): Promise<WatchlistFollowResult> {
    let quote: Quote
    try {
      quote = await this.ctx.marketData.quote({ instrument }, signal)
    } catch (error) {
      if (isUnknownInstrument(error)) return { ok: false, reason: 'unknown-instrument' }
      throw error
    }
    const record = await this.ctx.followedNames.follow(instrument, quote.name, new Date().toISOString())
    return { ok: true, row: { ...projection(record), quote } }
  }

  /**
   * Take an instrument off the watchlist. The record survives, so a later
   * re-follow keeps everything recorded about the name.
   * @param instrument - the venue and code to unfollow.
   * @returns the followed count after the change, so a caller can reconcile
   *   without a second round trip.
   * @throws {@link FollowedNameError} when no record exists for the instrument.
   */
  @Remote('unfollow')
  async unfollow(instrument: InstrumentRef): Promise<number> {
    await this.ctx.followedNames.unfollow(instrument, new Date().toISOString())
    return this.ctx.followedNames.listFollowed().length
  }

  /** One record joined with its quote, degrading the quote rather than the row. */
  private async row(record: FollowedName, signal?: AbortSignal): Promise<WatchlistRow> {
    try {
      const quote = await this.ctx.marketData.quote({ instrument: record.instrument }, signal)
      return { ...projection(record), quote }
    } catch (error) {
      if (isSelectionFailure(error)) throw error
      return { ...projection(record), quote: null }
    }
  }
}

/** The record fields a row carries; `followed` and `updatedAt` stay internal. */
function projection(record: FollowedName): Omit<WatchlistRow, 'quote'> {
  return {
    instrument: record.instrument,
    displayName: record.displayName,
    firstFollowedAt: record.firstFollowedAt,
  }
}

export default WatchlistService
