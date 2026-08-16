/**
 * Technical indicators for the name workbench chart, as pure functions over a
 * closing series. Each returns an array the same length as its input, with
 * `null` in the leading positions where the indicator has no value yet — a
 * chart draws a gap there rather than a line starting from zero.
 *
 * Parameter defaults follow the conventions mainland trading software ships
 * with (MA 5/10/20/60, MACD 12/26/9, KDJ 9/3/3), because a workbench that
 * renamed or re-tuned them would make every reading incomparable with the
 * platforms its users already read.
 * @module @deepseek-ai/dsh-client-ui-watchlist/chart/indicators
 */

/** One session's prices, the least an indicator needs. */
export interface IndicatorBar {
  /** Highest traded price of the session. */
  high: number
  /** Lowest traded price of the session. */
  low: number
  /** Last traded price of the session. */
  close: number
}

/** MACD at one session; `null` members are positions the indicator cannot value yet. */
export interface MacdPoint {
  /** Fast EMA minus slow EMA. */
  dif: number
  /** Signal line: EMA of {@link MacdPoint.dif}. */
  dea: number
  /**
   * Histogram, `(dif − dea) × 2`. The doubling is the mainland convention; it
   * scales the bars to the DIF/DEA lines they are read against.
   */
  histogram: number
}

/** KDJ at one session. */
export interface KdjPoint {
  /** Smoothed raw stochastic value. */
  k: number
  /** Smoothed {@link KdjPoint.k}. */
  d: number
  /** `3K − 2D`; overshoots both, which is what makes it the early signal. */
  j: number
}

/**
 * Simple moving average over the closing series.
 * @param closes - closing prices in ascending date order.
 * @param period - how many sessions each average covers; must be positive.
 * @returns one value per session, `null` before the window fills.
 */
export function movingAverage(closes: readonly number[], period: number): (number | null)[] {
  const out: (number | null)[] = []
  let sum = 0
  for (let i = 0; i < closes.length; i += 1) {
    sum += closes[i] as number
    if (i >= period) sum -= closes[i - period] as number
    out.push(i >= period - 1 ? sum / period : null)
  }
  return out
}

/**
 * Exponential moving average, seeded with the first observation.
 *
 * Seeding from the first close rather than from a simple average of the first
 * `period` sessions is what the mainland platforms do, and the choice is
 * visible: the two seeds disagree for roughly the first `period` sessions, so a
 * chart drawn one way cannot be compared against a reading taken the other.
 * @param values - the series in ascending date order.
 * @param period - smoothing period; must be positive.
 * @returns one value per input position; empty input gives an empty result.
 */
export function exponentialMovingAverage(values: readonly number[], period: number): number[] {
  const alpha = 2 / (period + 1)
  const out: number[] = []
  let previous = 0
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i] as number
    previous = i === 0 ? value : alpha * value + (1 - alpha) * previous
    out.push(previous)
  }
  return out
}

/**
 * MACD over the closing series.
 * @param closes - closing prices in ascending date order.
 * @param fast - fast EMA period.
 * @param slow - slow EMA period.
 * @param signal - period of the EMA taken over DIF to get DEA.
 * @returns one point per session, `null` until the slow EMA has seen `slow` sessions.
 */
export function macd(
  closes: readonly number[],
  fast = 12,
  slow = 26,
  signal = 9,
): (MacdPoint | null)[] {
  const fastEma = exponentialMovingAverage(closes, fast)
  const slowEma = exponentialMovingAverage(closes, slow)
  const dif = closes.map((_, i) => (fastEma[i] as number) - (slowEma[i] as number))
  const dea = exponentialMovingAverage(dif, signal)
  // Both EMAs are seeded from the first close, so early DIF values describe the
  // seed rather than the series; suppress them instead of drawing a shape the
  // data has not produced yet.
  const warmup = slow - 1
  return closes.map((_, i) => i < warmup
    ? null
    : {
      dif: dif[i] as number,
      dea: dea[i] as number,
      histogram: ((dif[i] as number) - (dea[i] as number)) * 2,
    })
}

/**
 * KDJ over the high/low/close series.
 *
 * K and D are Wilder-style smoothings seeded at 50, the neutral reading, so the
 * first sessions converge toward the true value instead of anchoring at an
 * extreme.
 * @param bars - sessions in ascending date order.
 * @param period - lookback for the raw stochastic (the highest high and lowest low).
 * @param kPeriod - smoothing period for K.
 * @param dPeriod - smoothing period for D.
 * @returns one point per session, `null` before the lookback window fills.
 */
export function kdj(
  bars: readonly IndicatorBar[],
  period = 9,
  kPeriod = 3,
  dPeriod = 3,
): (KdjPoint | null)[] {
  const out: (KdjPoint | null)[] = []
  let k = 50
  let d = 50
  for (let i = 0; i < bars.length; i += 1) {
    if (i < period - 1) {
      out.push(null)
      continue
    }
    const window = bars.slice(i - period + 1, i + 1)
    let highest = -Infinity
    let lowest = Infinity
    for (const bar of window) {
      if (bar.high > highest) highest = bar.high
      if (bar.low < lowest) lowest = bar.low
    }
    const span = highest - lowest
    // A window with no range has no stochastic position; hold the previous
    // reading rather than dividing by zero or snapping to an arbitrary end.
    const rsv = span === 0 ? 50 : (((bars[i] as IndicatorBar).close - lowest) / span) * 100
    k = ((kPeriod - 1) * k + rsv) / kPeriod
    d = ((dPeriod - 1) * d + k) / dPeriod
    out.push({ k, d, j: 3 * k - 2 * d })
  }
  return out
}

/**
 * Axis tick values at a readable interval: the 1/2/5×10ⁿ step that lands
 * closest to the requested count. Arbitrary steps produce labels like 1173.4,
 * which a reader cannot use to place a price by eye.
 * @param min - lowest value the axis must cover.
 * @param max - highest value the axis must cover.
 * @param count - roughly how many ticks are wanted.
 * @returns ascending tick values spanning `[min, max]`; a zero-width range gives one tick.
 */
export function niceTicks(min: number, max: number, count: number): number[] {
  const span = max - min
  if (span <= 0) return [min]
  const rough = span / count
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const normalized = rough / magnitude
  // Round to the nearest 1/2/5/10, not up to the next one: rounding up drops a
  // 5-tick axis to 3 ticks whenever the rough interval lands just above a step.
  const step = (normalized < 1.5 ? 1 : normalized < 3 ? 2 : normalized < 7 ? 5 : 10) * magnitude
  const ticks: number[] = []
  for (let value = Math.ceil(min / step) * step; value <= max + step * 1e-9; value += step) {
    ticks.push(value)
  }
  return ticks
}
