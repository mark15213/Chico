/**
 * Pure derivation of the price-series chart props from a frozen call slice.
 * The `card: 'price-series'` render intent a market-data tool declares at
 * result time arrives on the snapshot as `resultView`, and this is the one
 * place that turns it into what the chart draws. The geometry itself, and the
 * block that draws it, live in `ui-primitives` because the watchlist's name
 * page draws the same series from a different source.
 * @module
 */
import { priceSeriesModel, type PriceSeriesBar, type PriceSeriesModel } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ToolCallBlock } from './tool-call-model.ts'

export type { PriceSeriesModel } from '@deepseek-ai/dsh-client-ui-primitives'

/**
 * A charted call: the derived geometry plus the bars it was derived from. The
 * bars travel alongside because the derived model normalizes prices into the
 * unit box and drops everything a candle does not need — a chart on the
 * `tool.call.priceSeries` seat that draws volume or an indicator reads them
 * here rather than asking for the series again.
 */
export interface PriceSeriesCard {
  /** Derived chart geometry. */
  model: PriceSeriesModel
  /** The bars exactly as the tool reported them, ascending. */
  bars: readonly PriceSeriesBar[]
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
 * @returns the chart model with its source bars, or null for the generic path.
 */
export function priceSeriesCardModel(block: ToolCallBlock): PriceSeriesCard | null {
  // Running calls have no result view; the price-series card is result-only.
  if (!('kind' in block)) return null
  const result = block.resultView
  if (result?.card !== 'price-series') return null
  const model = priceSeriesModel({
    label: result.label,
    bars: result.bars,
    adjustment: result.adjustment,
    currency: result.currency,
  })
  return model === null ? null : { model, bars: result.bars }
}
