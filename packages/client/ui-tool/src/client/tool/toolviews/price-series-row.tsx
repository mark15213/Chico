// Price-series toolview registrant: the keyed toolview hole for the
// `market_history` tool. The row composes the shared ToolRow (chrome, running
// sweep, whole-row expand) and feeds it the completed series as ToolRow's
// `priceSeries` card material, so it renders through ui-primitives'
// PriceSeriesBlock in the row's expanded body. Until the call settles there is no price-series card (the
// tool keeps a generic pending view), so a running row is the summary line alone.
//
// The chart opens without a click, unlike every other card row here. A read or a
// grep card is the work behind an answer and the reader skims past it, but a
// price series is the answer to what was asked, and one hidden behind a row that
// looks like every other row does not get looked at.
//
// The row lives here rather than in a product package because the card kind
// lives in the shared `dsh-tools` render-intent union: client bundle purity
// forbids a product plugin importing this row's chrome, and every other core
// card kind is keyed here too. The drawing itself moved to ui-primitives once
// the watchlist's name page needed the same chart.

import { useSyncExternalStore } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import { IconDataOutline16, PriceSeriesBlock } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRenderSlots } from '@deepseek-ai/dsh-client-ui-slots'
import type { ToolCallViewProps } from '../../contract/slots.ts'
import { priceSeriesCardModel } from '../models/price-series-card-model.ts'
import { toolRowModel } from '../models/tool-call-model.ts'
import { ToolRow } from '../components/ToolRow.tsx'
import { CONVERSATION_NS as NS } from '../../locale.ts'

/**
 * Whether anything occupies the row's chart seat. Read from the slot ledger
 * rather than from a flag this package keeps, so a chart registered after load
 * counts — the same arrangement `conversation.hero` uses for framed openings.
 */
export interface ChartSeat {
  /** True when a composition put its own chart on the seat. */
  occupied: () => boolean
  /** Subscribe to seat changes. */
  subscribe: (fn: () => void) => () => void
  /** Registry version, for `useSyncExternalStore`. */
  version: () => number
}

/** What the row's registration injects beyond the standard shares. */
export interface PriceSeriesRowInjected {
  /** The chart seat's occupancy, live. */
  chartSeat: ChartSeat
}

/** Full row props: the toolview runtime share, the chart seat, and the locale seat. */
type PriceSeriesRowProps = ToolCallViewProps
  & PropsRenderSlots<'tool.call.priceSeries'>
  & PriceSeriesRowInjected
  & PropsLocale<'conversation'>

/** The tool whose completed calls carry a price-series render intent. */
export const PRICE_SERIES_TOOL = 'market_history'

/**
 * Price-series row: icon + History · {summary} in the shared ToolRow chrome,
 * with the completed series as the row's card body, opened as soon as it exists.
 * @param props - the toolview owner share and locale seat.
 * @returns the composed row.
 */
export function PriceSeriesRow({ toolName, block, inspect, t, chartSeat, renderSlot }: PriceSeriesRowProps) {
  const model = toolRowModel(toolName, block)
  const series = priceSeriesCardModel(block)
  useSyncExternalStore(chartSeat.subscribe, chartSeat.version)
  // An occupied seat draws the whole chart; an empty one keeps the shipped
  // candles. Deciding here rather than inside ToolRow keeps the row chrome
  // ignorant of what a price series is.
  const chart = series === null
    ? null
    : chartSeat.occupied()
      ? renderSlot('tool.call.priceSeries', { model: series.model, bars: series.bars })
      : <PriceSeriesBlock model={series.model} />
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
      priceSeries={chart}
      startExpanded={series !== null}
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
    const chartSeat: ChartSeat = {
      occupied: () => ctx.slots.entries('tool.call.priceSeries').length > 0,
      subscribe: fn => ctx.slots.subscribe('tool.call.priceSeries', fn),
      version: () => ctx.slots.getVersion('tool.call.priceSeries'),
    }
    ctx.slots.inject('tool.call.toolview', () => ctx.slots.register(
      {
        name: 'tool.call.toolview',
        key: PRICE_SERIES_TOOL,
        locale: NS,
        children: { 'tool.call.priceSeries': { kind: 'single', scope: 'session' } },
        inject: (): PriceSeriesRowInjected => ({ chartSeat }),
      },
      PriceSeriesRow,
    ))
  },
}
