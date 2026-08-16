/**
 * Candle chart for a completed price series, plus the geometry derivation
 * behind it. Both live here rather than beside one caller because two surfaces
 * draw the same series: the market-history tool row and the watchlist's name
 * page. The block is pure presentation — every value arrives already derived by
 * {@link priceSeriesModel}, so it does no arithmetic beyond mapping the unit
 * box onto the viewBox.
 */
import clsx from 'clsx'
import css from './PriceSeriesBlock.module.css'

/** Corporate-action basis a series carries. */
export type PriceSeriesAdjustment = 'none' | 'backward' | 'forward'

/** One session as a caller supplies it, in venue prices. */
export interface PriceSeriesBar {
  /** Trading date at the venue (`YYYY-MM-DD`). */
  date: string
  /** First traded price of the session. */
  open: number
  /** Highest traded price of the session. */
  high: number
  /** Lowest traded price of the session. */
  low: number
  /** Last traded price of the session. */
  close: number
  /**
   * Session volume in shares or contracts. This block does not draw it, but
   * both callers read it off a bar that carries it, and a chart on the
   * `tool.call.priceSeries` seat needs it for a volume pane — dropping it here
   * would force that chart to re-fetch a series it was already handed.
   */
  volume: number
}

/** What a caller supplies to draw one series. */
export interface PriceSeriesInput {
  /** What the series describes, for the header. */
  label: string
  /** Session bars in ascending date order. */
  bars: readonly PriceSeriesBar[]
  /** Corporate-action basis, always drawn because a chart without it invites a wrong comparison. */
  adjustment: PriceSeriesAdjustment
  /** ISO-4217 code, when the caller has one. */
  currency?: string | undefined
}

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

/** Everything the block needs, derived once from the caller's series. */
export interface PriceSeriesModel {
  /** What the series describes, for the header. */
  label: string
  /** Corporate-action basis, always shown. */
  adjustment: PriceSeriesAdjustment
  /** ISO-4217 code, when the caller supplied one. */
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

/** Unit-box height the plot maps onto; width is one column per session. */
const PLOT_HEIGHT = 100

/** Horizontal share of a column the candle body occupies. */
const BODY_WIDTH = 0.62

/** Adjustment wording shown beside the range, spelled out rather than coded. */
const ADJUSTMENT_LABEL: Record<PriceSeriesAdjustment, string> = {
  none: 'as traded',
  backward: 'back-adjusted',
  forward: 'forward-adjusted',
}

/**
 * Derive the chart geometry, or null when the series has nothing to plot: an
 * empty series, or one whose every price is identical. Drawing a flat line at
 * an arbitrary height would state a shape the data does not have, so a caller
 * that gets null shows the numbers instead.
 * @param input - the series, its label, and its adjustment basis.
 * @returns the derived model, or null when there is no range to plot.
 */
export function priceSeriesModel(input: PriceSeriesInput): PriceSeriesModel | null {
  if (input.bars.length === 0) return null

  const low = Math.min(...input.bars.map(bar => bar.low))
  const high = Math.max(...input.bars.map(bar => bar.high))
  const range = high - low
  // A zero range has no scale: every unit would divide by zero.
  if (range === 0) return null

  const unit = (price: number): number => (price - low) / range
  const [first] = input.bars
  const final = input.bars[input.bars.length - 1]
  // The length guard above already established both, but the index reads are
  // what the compiler sees; a defensive null exit costs nothing here.
  if (first === undefined || final === undefined) return null

  return {
    label: input.label,
    adjustment: input.adjustment,
    ...input.currency !== undefined ? { currency: input.currency } : {},
    bars: input.bars.map(bar => ({
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

/**
 * Draw one price series.
 * @param props.model - the derived chart model.
 * @returns the chart element.
 */
export function PriceSeriesBlock({ model }: { model: PriceSeriesModel }) {
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
