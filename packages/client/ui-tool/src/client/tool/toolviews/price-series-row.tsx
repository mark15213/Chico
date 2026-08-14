// Price-series toolview registrant: the keyed toolview hole for the
// `market_history` tool. The row composes the shared ToolRow (chrome, running
// sweep, whole-row expand) and feeds it the completed series as ToolRow's
// `priceSeries` card material, so it renders through PriceSeriesChart in the
// collapsed-by-default expanded body — the same unified interaction every other
// card row has. Until the call settles there is no price-series card (the tool
// keeps a generic pending view), so a running row is the summary line alone.
//
// The renderer lives here rather than in a product package because the card
// kind lives in the shared `dsh-tools` render-intent union: client bundle
// purity forbids a product plugin importing this row's chrome, and every other
// core card kind is rendered here too.

import type { Context } from '@deepseek-ai/cordis'
import { IconDataOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { ToolCallViewProps } from '../../contract/slots.ts'
import { priceSeriesModel } from '../models/price-series-card-model.ts'
import { toolRowModel } from '../models/tool-call-model.ts'
import { ToolRow } from '../components/ToolRow.tsx'
import { CONVERSATION_NS as NS } from '../../locale.ts'

/** Full row props: the toolview runtime share plus the standard locale seat. */
type PriceSeriesRowProps = ToolCallViewProps & PropsLocale<'conversation'>

/** The tool whose completed calls carry a price-series render intent. */
export const PRICE_SERIES_TOOL = 'market_history'

/**
 * Price-series row: icon + History · {summary} in the shared ToolRow chrome,
 * with the completed series as the row's collapsed-by-default card body.
 * @param props - the toolview owner share and locale seat.
 * @returns the composed row.
 */
export function PriceSeriesRow({ toolName, block, inspect, t }: PriceSeriesRowProps) {
  const model = toolRowModel(toolName, block)
  const series = priceSeriesModel(block)
  return (
    <ToolRow
      t={t}
      variant={model.variant}
      toolName={toolName}
      icon={<IconDataOutline16 size={14} />}
      title="History"
      summary={model.summary}
      body={null}
      output={model.output}
      errorSummary={model.errorSummary}
      priceSeries={series}
      state={model.state}
      inspect={inspect}
    />
  )
}

/**
 * The price-series row follows the atomic Tool-view declaration across
 * activation and reload.
 */
export const priceSeriesToolview = {
  name: 'price-series-toolview',
  inject: ['slots'],
  /**
   * Register the price-series row under the history tool's keyed toolview hole.
   * @param ctx - registrant context (disposal rides ctx.effect inside slots.register).
   */
  apply(ctx: Context): void {
    ctx.slots.inject('tool.call.toolview', () => ctx.slots.register(
      { name: 'tool.call.toolview', key: PRICE_SERIES_TOOL, locale: NS },
      PriceSeriesRow,
    ))
  },
}
