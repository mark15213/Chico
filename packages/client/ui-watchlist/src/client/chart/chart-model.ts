/**
 * Everything the workbench chart draws, derived once from a series and the
 * visible window. Width-independent on purpose: the pixel mapping depends on
 * the measured container and changes on every resize, while this does not, so
 * a resize redraws without recomputing indicators over hundreds of sessions.
 * @module @deepseek-ai/dsh-client-ui-watchlist/chart/chart-model
 */
import type { PriceSeriesBar } from '@deepseek-ai/dsh-client-ui-primitives'
import { kdj, macd, movingAverage, niceTicks, type KdjPoint, type MacdPoint } from './indicators.ts'

/** Which indicator the lower pane draws. */
export type ChartPane = 'volume' | 'macd' | 'kdj'

/** The moving-average periods drawn over the candles, and their colour order. */
export const MA_PERIODS = [5, 10, 20, 60] as const

/** One drawn moving average. */
export interface MaSeries {
  /** Sessions the average covers. */
  period: number
  /** One value per visible session, `null` where the window had not filled. */
  values: (number | null)[]
}

/** The derived chart. Every array is aligned to {@link ProChartModel.bars} by index. */
export interface ProChartModel {
  /** The visible sessions, ascending. */
  bars: readonly PriceSeriesBar[]
  /** Lowest drawn price, already padded and widened to cover the visible averages. */
  low: number
  /** Highest drawn price, likewise. */
  high: number
  /** Price-axis tick values inside `[low, high]`. */
  priceTicks: number[]
  /** The moving averages, in {@link MA_PERIODS} order. */
  mas: MaSeries[]
  /** Largest visible session volume, the volume pane's full height. */
  volumeMax: number
  /** MACD over the whole series, sliced to the window. */
  macd: (MacdPoint | null)[]
  /** KDJ over the whole series, sliced to the window. */
  kdj: (KdjPoint | null)[]
  /** Largest absolute MACD value in the window; 0 when the window has none. */
  macdScale: number
}

/**
 * Derive the visible chart.
 *
 * Indicators are computed over the **whole** series and only then sliced to the
 * window. Computing them over the slice would restart every warm-up at the left
 * edge, so the same session would show a different MA60 depending on how far
 * the reader had zoomed — the number would move because the viewport moved.
 *
 * @param bars - the full series in ascending date order.
 * @param sessions - how many trailing sessions to show; clamped to what exists.
 * @returns the derived chart, or null when the window has no price range to plot.
 */
export function proChartModel(bars: readonly PriceSeriesBar[], sessions: number): ProChartModel | null {
  if (bars.length === 0) return null
  const from = Math.max(0, bars.length - Math.max(1, sessions))
  const visible = bars.slice(from)

  const closes = bars.map(bar => bar.close)
  const mas: MaSeries[] = MA_PERIODS.map(period => ({
    period,
    values: movingAverage(closes, period).slice(from),
  }))

  let low = Infinity
  let high = -Infinity
  for (const bar of visible) {
    if (bar.low < low) low = bar.low
    if (bar.high > high) high = bar.high
  }
  // The averages are drawn in the same box, so an MA60 running under a rising
  // window has to be inside it or the line leaves the plot.
  for (const ma of mas) {
    for (const value of ma.values) {
      if (value === null) continue
      if (value < low) low = value
      if (value > high) high = value
    }
  }
  if (high === low) return null

  const pad = (high - low) * 0.06
  low -= pad
  high += pad

  const macdSeries = macd(closes).slice(from)
  let macdScale = 0
  for (const point of macdSeries) {
    if (point === null) continue
    macdScale = Math.max(macdScale, Math.abs(point.dif), Math.abs(point.dea), Math.abs(point.histogram))
  }

  return {
    bars: visible,
    low,
    high,
    priceTicks: niceTicks(low, high, 5),
    mas,
    volumeMax: Math.max(...visible.map(bar => bar.volume), 1),
    macd: macdSeries,
    kdj: kdj(bars.map(bar => ({ high: bar.high, low: bar.low, close: bar.close }))).slice(from),
    macdScale,
  }
}

/**
 * Session-over-session change at one visible index.
 *
 * The first visible session has no predecessor inside the window, so it is
 * measured against its own open — the same basis a single candle carries.
 * @param model - the derived chart.
 * @param index - visible session index.
 * @returns the absolute change and the percentage, both zero for a flat session.
 */
export function changeAt(model: ProChartModel, index: number): { change: number; percent: number } {
  const bar = model.bars[index] as PriceSeriesBar
  const previous = index > 0 ? (model.bars[index - 1] as PriceSeriesBar).close : bar.open
  const change = bar.close - previous
  return { change, percent: previous === 0 ? 0 : (change / previous) * 100 }
}
