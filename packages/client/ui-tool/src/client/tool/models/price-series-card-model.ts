/**
 * Pure derivation of the price-series chart props from a frozen call slice.
 * The `card: 'price-series'` render intent a market-data tool declares at
 * result time arrives on the snapshot as `resultView`, and this is the one
 * place that turns it into what the chart draws.
 * @module
 */
import type { ToolCallBlock } from './tool-call-model.ts'

/** One session's drawn geometry, already normalized into the 0..1 unit box. */
export interface PlottedBar {
  /** Trading date, carried through for the hover label. */
  date: string
  /** Session open. */
  open: number
  /** Session close. */
  close: number
  /** Fraction of the price range at the session high, 0 at the series low. */
  highUnit: number
  /** Fraction of the price range at the session low. */
  lowUnit: number
  /** Fraction of the price range at the higher of open and close. */
  bodyTopUnit: number
  /** Fraction of the price range at the lower of open and close. */
  bodyBottomUnit: number
  /** True when the session closed at or above its open. */
  rising: boolean
}

/** Everything the chart needs, derived once from the render intent. */
export interface PriceSeriesModel {
  /** What the series describes, for the card header. */
  label: string
  /** Corporate-action basis, always shown because a chart without it invites a wrong comparison. */
  adjustment: 'none' | 'backward' | 'forward'
  /** ISO-4217 code, when the tool supplied one. */
  currency?: string
  /** Bars in ascending date order with their drawn geometry. */
  bars: PlottedBar[]
  /** Lowest low across the series. */
  low: number
  /** Highest high across the series. */
  high: number
  /** Close of the last session. */
  last: number
  /** Percent change from the first session's open to the last session's close. */
  changePercent: number
}

/**
 * Derive the chart model for a tool call, or null when this call is not a
 * price-series card and belongs on the generic path. Null cases, all of them
 * the documented generic-card default:
 *
 * - A running call: the market-data tools keep a generic pending card, so
 *   nothing series-shaped exists until the call settles.
 * - A settled call whose result view is not a price-series card, including a
 *   `card` value this UI version does not know (it arrives over the wire and so
 *   cannot be trusted to be one of the compiled variants) and the generic card
 *   a failed call returns.
 * - A series with no bars, or one whose every price is identical: neither has a
 *   range to plot, and drawing a flat line at an arbitrary height would state a
 *   shape the data does not have.
 * @param block - RunningToolCall or ToolResultNode off the snapshot caches.
 * @returns the chart model, or null for the generic path.
 */
export function priceSeriesModel(block: ToolCallBlock): PriceSeriesModel | null {
  // Running calls have no result view; the price-series card is result-only.
  if (!('kind' in block)) return null
  const result = block.resultView
  if (result?.card !== 'price-series') return null
  if (result.bars.length === 0) return null

  const low = Math.min(...result.bars.map(bar => bar.low))
  const high = Math.max(...result.bars.map(bar => bar.high))
  const range = high - low
  // A zero range has no scale: every unit would divide by zero.
  if (range === 0) return null

  const unit = (price: number): number => (price - low) / range
  const [first] = result.bars
  const final = result.bars[result.bars.length - 1]
  // The length guard above already established both, but the index reads are
  // what the compiler sees; a defensive null exit costs nothing here.
  if (first === undefined || final === undefined) return null

  return {
    label: result.label,
    adjustment: result.adjustment,
    ...result.currency !== undefined ? { currency: result.currency } : {},
    bars: result.bars.map(bar => ({
      date: bar.date,
      open: bar.open,
      close: bar.close,
      highUnit: unit(bar.high),
      lowUnit: unit(bar.low),
      bodyTopUnit: unit(Math.max(bar.open, bar.close)),
      bodyBottomUnit: unit(Math.min(bar.open, bar.close)),
      rising: bar.close >= bar.open,
    })),
    low,
    high,
    last: final.close,
    changePercent: Math.round((final.close / first.open - 1) * 10_000) / 100,
  }
}
