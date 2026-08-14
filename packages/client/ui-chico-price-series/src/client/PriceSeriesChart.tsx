/**
 * Candle chart for a completed price series. Pure presentation: every value
 * arrives already derived by {@link priceSeriesModel}, so this component does
 * no arithmetic beyond mapping the unit box onto the viewBox.
 */
import clsx from 'clsx'
import type { PriceSeriesModel } from './model.ts'
import css from './PriceSeriesChart.module.css'

/** Unit-box height the plot maps onto; width is one column per session. */
const PLOT_HEIGHT = 100

/** Horizontal share of a column the candle body occupies. */
const BODY_WIDTH = 0.62

/** Adjustment wording shown beside the range, spelled out rather than coded. */
const ADJUSTMENT_LABEL: Record<PriceSeriesModel['adjustment'], string> = {
  none: 'as traded',
  backward: 'back-adjusted',
  forward: 'forward-adjusted',
}

/**
 * Draw one price series.
 * @param props.model - the derived chart model.
 * @returns the chart element.
 */
export function PriceSeriesChart({ model }: { model: PriceSeriesModel }) {
  const columns = model.bars.length
  const rising = model.changePercent >= 0
  return (
    <div className={css.chart}>
      <div className={css.header}>
        <span className={css.label}>{model.label}</span>
        <span className={clsx(css.last, rising ? css.rising : css.falling)}>
          {model.last}
          {model.currency !== undefined ? ` ${model.currency}` : ''}
          {` (${rising ? '+' : ''}${model.changePercent}%)`}
        </span>
      </div>
      <svg
        className={css.plot}
        viewBox={`0 0 ${columns} ${PLOT_HEIGHT}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${model.bars.length} sessions from ${model.bars[0]?.date} to ${model.bars[columns - 1]?.date}, ${ADJUSTMENT_LABEL[model.adjustment]}`}
      >
        {model.bars.map((bar, index) => {
          // The unit box counts upward from the series low; SVG counts downward.
          const y = (unit: number) => (1 - unit) * PLOT_HEIGHT
          const center = index + 0.5
          const bodyTop = y(bar.bodyTopUnit)
          const bodyHeight = y(bar.bodyBottomUnit) - bodyTop
          return (
            <g key={bar.date} className={bar.rising ? css.rising : css.falling}>
              <line className={css.wick} x1={center} x2={center} y1={y(bar.highUnit)} y2={y(bar.lowUnit)} />
              {bodyHeight > 0
                ? (
                  <rect
                    className={css.body}
                    x={center - BODY_WIDTH / 2}
                    width={BODY_WIDTH}
                    y={bodyTop}
                    height={bodyHeight}
                  />
                )
                : (
                  <line
                    className={css.bodyFlat}
                    x1={center - BODY_WIDTH / 2}
                    x2={center + BODY_WIDTH / 2}
                    y1={bodyTop}
                    y2={bodyTop}
                  />
                )}
            </g>
          )
        })}
      </svg>
      <div className={css.meta}>
        <span>{`${columns} sessions`}</span>
        <span>{`${model.bars[0]?.date} – ${model.bars[columns - 1]?.date}`}</span>
        <span>{`low ${model.low} · high ${model.high}`}</span>
        <span>{ADJUSTMENT_LABEL[model.adjustment]}</span>
      </div>
    </div>
  )
}
