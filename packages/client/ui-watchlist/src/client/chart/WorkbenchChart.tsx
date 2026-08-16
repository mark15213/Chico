/**
 * The chart Chico puts on the price-series row's `tool.call.priceSeries` seat.
 *
 * It decides per conversation rather than per composition: a conversation bound
 * to a name is investing work and gets the workbench chart, and every other
 * conversation in the same app keeps the shipped candles. Mounting Chico must
 * not change how a price series looks in a conversation about a codebase.
 *
 * Binding, not the active frame, is the test. A conversation is bound to its
 * name at creation and never reassigned, so the chart a conversation draws
 * stays the same when the reader switches frames — which is what a reader
 * scrolling back through one conversation expects.
 */
import { PriceSeriesBlock, type PriceSeriesBar, type PriceSeriesModel } from '@deepseek-ai/dsh-client-ui-primitives'
import type { SessionId } from '@deepseek-ai/dsh-api-remotes/client'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { useWorkbenchFocus, type WorkbenchSelection } from '../workbench-store.ts'
import { ProChart } from './ProChart.tsx'

/** What the seat's occupant receives: the row's owner share plus this plugin's own state. */
export interface WorkbenchChartProps {
  /** Derived chart geometry, from the price-series row. */
  model: PriceSeriesModel
  /** The bars as the tool reported them, carrying volume. */
  bars: readonly PriceSeriesBar[]
  /** The conversation this call belongs to; absent outside a session. */
  sessionId?: SessionId | undefined
  /** The open name and its bound conversations. */
  selection: WorkbenchSelection
  /** The workbench locale seat. */
  t: TranslateNS<'watchlist'>
}

/**
 * Draw one completed price series, choosing by whether this conversation is
 * about a name.
 * @param props - the row's owner share, the selection, and the locale seat.
 * @returns the workbench chart for a bound conversation, the shipped candles otherwise.
 */
export function WorkbenchChart({ model, bars, sessionId, selection, t }: WorkbenchChartProps) {
  const focus = useWorkbenchFocus(selection)
  const bound = sessionId !== undefined && focus.sessions.includes(sessionId)
  if (!bound) return <PriceSeriesBlock model={model} />
  return (
    <ProChart
      label={model.label}
      bars={bars}
      adjustment={model.adjustment}
      currency={model.currency}
      t={t}
    />
  )
}
