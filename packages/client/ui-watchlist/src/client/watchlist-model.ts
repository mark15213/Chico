/**
 * Pure derivations behind the watchlist rows: price and change presentation,
 * and the instrument label. Kept out of the component so the rules are
 * asserted directly rather than through the DOM.
 */

import type { InstrumentRef, Quote, WatchlistRow } from '@deepseek-ai/dsh-api-remotes/client'

/**
 * Which way a row moved. `flat` is its own case rather than a rounding of up:
 * an unchanged price carries no direction and must not be colored as if it did.
 */
export type PriceDirection = 'up' | 'down' | 'flat'

/** One row's presented figures, or nulls when the row carries no quote. */
export interface RowFigures {
  /** `MARKET:SYMBOL`, the identity the user follows by. */
  readonly instrumentLabel: string
  /** Last price with its currency, or null without a quote. */
  readonly last: string | null
  /** Signed percentage change, or null without a quote. */
  readonly change: string | null
  /** Direction the change is colored by, or null without a quote. */
  readonly direction: PriceDirection | null
}

/**
 * Decimal places every figure is shown to. Two is what the venues served today
 * price in; a venue with finer ticks makes this a per-venue fact rather than
 * one constant.
 */
const PRICE_DECIMALS = 2

/**
 * `MARKET:SYMBOL` for one instrument.
 * @param instrument - the venue and code.
 * @returns the identity a user follows by.
 */
export function instrumentLabel(instrument: WatchlistRow['instrument']): string {
  return `${instrument.market}:${instrument.symbol}`
}

/**
 * Which way a change moved, treating exactly zero as its own case.
 * @param changePercent - signed percentage change.
 * @returns the direction the row is colored by.
 */
export function directionOf(changePercent: number): PriceDirection {
  if (changePercent > 0) return 'up'
  if (changePercent < 0) return 'down'
  return 'flat'
}

/**
 * Signed percentage with a fixed sign column, so a list of rows stays aligned.
 * @param changePercent - signed percentage change.
 * @returns the presented change, using a true minus sign rather than a hyphen.
 */
export function formatChange(changePercent: number): string {
  const sign = changePercent > 0 ? '+' : changePercent < 0 ? '−' : ''
  return `${sign}${Math.abs(changePercent).toFixed(PRICE_DECIMALS)}%`
}

/**
 * Last price with the currency the venue prices in.
 * @param quote - the quote to present.
 * @returns the presented price.
 */
export function formatLast(quote: Quote): string {
  return `${quote.last.toFixed(PRICE_DECIMALS)} ${quote.currency}`
}

/**
 * Everything one row shows, with the no-quote case carried as nulls.
 * @param row - the watchlist row.
 * @returns the presented figures.
 */
export function rowFigures(row: WatchlistRow): RowFigures {
  const label = instrumentLabel(row.instrument)
  if (row.quote === null) {
    return { instrumentLabel: label, last: null, change: null, direction: null }
  }
  return {
    instrumentLabel: label,
    last: formatLast(row.quote),
    change: formatChange(row.quote.changePercent),
    direction: directionOf(row.quote.changePercent),
  }
}

/**
 * Whether two references name the same listing. Identity is the pair, so a
 * comparison that only matched symbols would confuse one code on two venues.
 * @param left - one instrument.
 * @param right - the other.
 * @returns true when both halves match.
 */
export function sameInstrument(left: InstrumentRef, right: InstrumentRef): boolean {
  return left.market === right.market && left.symbol === right.symbol
}

/**
 * The query as a lookup should see it, or null when the field holds nothing to
 * look up. Whitespace is the user's typing, not part of what they meant.
 * @param input - the raw field value.
 * @returns the trimmed query, or null when there is nothing to look up.
 */
export function normalizeQuery(input: string): string | null {
  const trimmed = input.trim()
  return trimmed.length === 0 ? null : trimmed
}
