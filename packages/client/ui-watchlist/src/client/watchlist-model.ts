/**
 * Pure derivations behind the watchlist rows: price and change presentation,
 * the instrument label, and the venue list the add form offers. Kept out of the
 * component so the rules are asserted directly rather than through the DOM.
 */

import type { Market, Quote, WatchlistRow } from '@deepseek-ai/dsh-api-remotes/client'
import type { WatchlistLocaleKey } from './locales.ts'

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
 * Venue labels, one locale key per member of the market union. A `Record` over
 * the union rather than a list, so a venue added to the seam fails this file to
 * compile instead of silently disappearing from the add form.
 */
export const MARKET_LABEL_KEYS = {
  SSE: 'market.SSE',
  SZSE: 'market.SZSE',
  BSE: 'market.BSE',
  HKEX: 'market.HKEX',
  NASDAQ: 'market.NASDAQ',
  NYSE: 'market.NYSE',
} as const satisfies Record<Market, WatchlistLocaleKey>

/** The venues the add form offers, in the order it lists them. */
export const MARKETS = Object.keys(MARKET_LABEL_KEYS) as readonly Market[]

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
 * The code as the venue writes it, or null when the field holds nothing to
 * look up. Whitespace and case are the user's typing, not part of the code.
 * @param input - the raw field value.
 * @returns the normalized code, or null when there is nothing to look up.
 */
export function normalizeSymbol(input: string): string | null {
  const trimmed = input.trim().toUpperCase()
  return trimmed.length === 0 ? null : trimmed
}
