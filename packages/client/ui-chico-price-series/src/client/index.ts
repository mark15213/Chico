/**
 * Chico price-series toolview: the keyed toolview registrant for
 * `market_history`. It composes the shared ToolRow chrome and supplies the
 * candle chart as the row's custom card, so a price series renders through the
 * same collapsed-by-default interaction every other card row has.
 *
 * A composition without this package keeps the generic card and the bar table
 * the tool's own result text carries, which is what the `price-series` render
 * intent promises an incapable UI.
 * @module @deepseek-ai/dsh-client-ui-chico-price-series/client
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-tool/client'
// Type-only: pulls the conversation dictionary's LocaleNamespaceMap merge, so
// the registration below can claim that namespace's locale seat.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { PriceSeriesRow } from './PriceSeriesRow.tsx'

export { PriceSeriesChart } from './PriceSeriesChart.tsx'
export { priceSeriesModel } from './model.ts'
export type { PlottedBar, PriceSeriesModel } from './model.ts'
export { PriceSeriesRow } from './PriceSeriesRow.tsx'

/** Tool whose completed calls carry a `price-series` render intent. */
export const HISTORY_TOOL = 'market_history'

/** Required services for the keyed toolview contribution. */
export const inject = ['slots']

/**
 * Register the price-series row under the market-history tool's keyed toolview
 * hole. The hole is declared by ui-tool, whose activation order relative to
 * this one is not constrained, so registration rides `slots.inject()`.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.slots.inject('tool.call.toolview', () => ctx.slots.register(
    // The row composes ToolRow, whose chrome copy lives in the conversation
    // dictionary ui-conversation owns; this package registers no copy of its own.
    { name: 'tool.call.toolview', key: HISTORY_TOOL, locale: 'conversation' },
    PriceSeriesRow,
  ))
}
