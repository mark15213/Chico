/**
 * Public type vocabulary of the watchlist projection: the row one followed
 * name presents to a browser, and the outcome of following an instrument the
 * user named by code.
 * @module @deepseek-ai/dsh-watchlist/src/types
 */

import type { InstrumentRef, Quote } from '@deepseek-ai/dsh-market-data'

/**
 * One followed name as the watchlist presents it: the durable record joined
 * with the instrument's current quote.
 */
export interface WatchlistRow {
  /** The instrument this row describes. */
  readonly instrument: InstrumentRef
  /**
   * The name as the record holds it. This is what the user follows by and is
   * not rewritten when a venue renames a listing, so it can differ from
   * {@link Quote.name} on the same row.
   */
  readonly displayName: string
  /** ISO-8601 instant of the first follow, which is the row's age. */
  readonly firstFollowedAt: string
  /**
   * Current quote, or `null` when the provider could not price this
   * instrument. A row that cannot be priced still belongs on the watchlist:
   * a suspended or delisted name is exactly the one a user needs to see.
   */
  readonly quote: Quote | null
}

/**
 * One listing a lookup matched, told apart by whether it is already on the
 * watchlist. The flag is what makes this a watchlist answer rather than a
 * market-data one: a picker that offers to add a name already followed asks
 * the user to make a mistake.
 */
export interface WatchlistSearchMatch {
  /** The matched instrument. */
  readonly instrument: InstrumentRef
  /** Display name in the venue's own language. */
  readonly name: string
  /** Whether this instrument is currently on the watchlist. */
  readonly followed: boolean
}

/** The listings one lookup matched, best first as the provider ranks them. */
export interface WatchlistSearchResult {
  /** Matched listings; empty when the query names nothing. */
  readonly matches: readonly WatchlistSearchMatch[]
}

/** Every followed name, in the registry's own order. */
export interface WatchlistSnapshot {
  /** The current watchlist rows. */
  readonly rows: readonly WatchlistRow[]
}

/**
 * Outcome of following an instrument. A code the venue does not list is the
 * one failure a user causes by typing, so it travels as a value rather than a
 * thrown error, which the RPC layer would flatten into an internal failure.
 */
export type WatchlistFollowResult =
  | {
    /** The instrument was followed. */
    readonly ok: true
    /** The stored row, carrying the quote that resolved the display name. */
    readonly row: WatchlistRow
  }
  | {
    /** Nothing was recorded. */
    readonly ok: false
    /** The venue does not list this code. */
    readonly reason: 'unknown-instrument'
  }
