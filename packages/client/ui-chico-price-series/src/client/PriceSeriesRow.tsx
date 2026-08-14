/**
 * Price-series row: the shared ToolRow chrome with the candle chart as its
 * custom card. The chart is result-only, so a running call shows the summary
 * line alone and a settled call whose result is not a price-series card falls
 * through to the generic text body ToolRow already renders.
 */
import { IconDataOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the conversation dictionary's LocaleNamespaceMap merge.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { ToolRow, toolRowModel } from '@deepseek-ai/dsh-client-ui-tool/client'
import type { ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client'
import { priceSeriesModel } from './model.ts'
import { PriceSeriesChart } from './PriceSeriesChart.tsx'

/** Full row props: the toolview runtime share plus the standard locale seat. */
type PriceSeriesRowProps = ToolCallViewProps & PropsLocale<'conversation'>

/**
 * Render one market-history call.
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
      customCard={series === null ? null : <PriceSeriesChart model={series} />}
      state={model.state}
      inspect={inspect}
    />
  )
}
