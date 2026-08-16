/**
 * The name workbench's candle chart: candles and moving averages over a price
 * axis, a switchable lower pane (volume, MACD, KDJ), and a crosshair whose
 * readout names every value at the session under the pointer.
 *
 * Drawn at measured pixel width rather than through a stretched viewBox, so
 * candle proportions, label sizes, and stroke widths hold at every container
 * width. The static layers are memoized on the derived model, and only the
 * crosshair layer re-renders while the pointer moves.
 *
 * Colours follow the local market convention the product serves — red for a
 * rising session, green for a falling one, the inverse of the Western one.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import clsx from 'clsx'
import type { PriceSeriesAdjustment, PriceSeriesBar } from '@deepseek-ai/dsh-client-ui-primitives'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { changeAt, proChartModel, type ChartPane, type ProChartModel } from './chart-model.ts'
import css from './ProChart.module.css'

/** What the chart needs to draw one instrument. */
export interface ProChartProps {
  /** What the series describes, for the header and the accessible name. */
  label: string
  /** Session bars in ascending date order. */
  bars: readonly PriceSeriesBar[]
  /** Corporate-action basis, always shown: comparing across bases is the mistake it prevents. */
  adjustment: PriceSeriesAdjustment
  /** ISO-4217 code, when the caller has one. */
  currency?: string | undefined
  /**
   * Draw the instrument label above the readout. A host that already names the
   * instrument in its own header passes false, so the name is not stated twice
   * in one column; the crosshair's date and price stay either way, because
   * those follow the cursor rather than the panel.
   */
  showLabel?: boolean | undefined
  /** The workbench locale seat. */
  t: TranslateNS<'watchlist'>
}

/** Fixed bands of the plot, in CSS pixels. Only the main pane's height varies. */
const LAYOUT = { top: 10, right: 62, left: 10, gap: 10, axis: 22, lower: 84 }

/**
 * Main-pane height for a measured width, so the plot keeps a readable aspect at
 * any column. A fixed height turns the chart nearly square in a narrow details
 * column, where candles then read as a dense block rather than a trend.
 * @param width - measured container width in CSS pixels.
 * @returns the main pane's height.
 */
const mainHeight = (width: number): number => Math.round(Math.max(150, Math.min(280, width * 0.42)))

/**
 * Total drawn height for a measured width.
 * @param width - measured container width in CSS pixels.
 * @returns the SVG height.
 */
const totalHeight = (width: number): number =>
  LAYOUT.top + mainHeight(width) + LAYOUT.gap + LAYOUT.lower + LAYOUT.axis

/** Width assumed before the container has been measured; replaced on first observation. */
const ASSUMED_WIDTH = 720

/** Selectable windows, in trading sessions. `all` keeps whatever the series has. */
const RANGES = [
  { key: 'chart.range.1m', sessions: 21 },
  { key: 'chart.range.3m', sessions: 63 },
  { key: 'chart.range.6m', sessions: 126 },
  { key: 'chart.range.1y', sessions: 250 },
  { key: 'chart.range.all', sessions: Number.MAX_SAFE_INTEGER },
] as const

/** The lower pane's options, in switch order. */
const PANES: readonly ChartPane[] = ['volume', 'macd', 'kdj']

/** Decimal places a price is shown with: a low-priced name needs the second one, a high-priced one does not. */
const digitsFor = (price: number): number => (price >= 200 ? 1 : 2)

/**
 * Format a price at a fixed width so the digits line up as the crosshair moves.
 * @param value - the price.
 * @param digits - decimal places.
 * @returns the grouped, fixed-precision text.
 */
const price = (value: number, digits: number): string =>
  value.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })

/**
 * Format a share count compactly. `Intl` picks the divisor the reader's own
 * language uses — 万/亿 in Chinese, K/M in English — which a pair of translated
 * suffixes could not do, because the two languages break at different powers.
 * @param value - shares or contracts.
 * @returns the compact text.
 */
const shares = (value: number): string =>
  value.toLocaleString(undefined, { notation: 'compact', maximumFractionDigits: 1 })

/** A rising session is one that closed at or above its open. */
const isRising = (bar: PriceSeriesBar): boolean => bar.close >= bar.open

export function ProChart({ label, bars, adjustment, currency, showLabel = true, t }: ProChartProps) {
  const [rangeIndex, setRangeIndex] = useState(2)
  const [pane, setPane] = useState<ChartPane>('volume')
  const [hover, setHover] = useState<number | null>(null)
  const [width, setWidth] = useState(ASSUMED_WIDTH)
  const frame = useRef<HTMLDivElement>(null)

  // Measured width, not a stretched viewBox: text and strokes keep their size.
  useEffect(() => {
    const node = frame.current
    if (node === null) return undefined
    const observer = new ResizeObserver((entries) => {
      const measured = entries[0]?.contentRect.width
      if (measured !== undefined && measured > 0) setWidth(measured)
    })
    observer.observe(node)
    return () => { observer.disconnect() }
  }, [])

  const sessions = RANGES[rangeIndex]?.sessions ?? 126
  const model = useMemo(() => proChartModel(bars, sessions), [bars, sessions])

  // A window whose prices are all identical has no scale to draw against.
  if (model === null) {
    return <div className={css.chart} ref={frame}><p className={css.empty}>{t('chart.empty')}</p></div>
  }

  const count = model.bars.length
  const plotWidth = Math.max(80, width - LAYOUT.left - LAYOUT.right)
  const step = plotWidth / count
  const body = Math.max(1, Math.min(11, step * 0.66))
  const main = mainHeight(width)
  const height = totalHeight(width)
  const lowerTop = LAYOUT.top + main + LAYOUT.gap

  const x = (index: number): number => LAYOUT.left + step * (index + 0.5)
  const y = (value: number): number =>
    LAYOUT.top + main - ((value - model.low) / (model.high - model.low)) * main

  const index = hover === null ? count - 1 : Math.max(0, Math.min(count - 1, hover))
  const bar = model.bars[index] as PriceSeriesBar
  const digits = digitsFor(bar.close)
  const { change, percent } = changeAt(model, index)
  const direction = percent > 0.005 ? 'rise' : percent < -0.005 ? 'fall' : 'flat'

  /** Pointer position to the session under it. */
  const indexAt = (clientX: number): number => {
    const box = frame.current?.getBoundingClientRect()
    if (box === undefined) return index
    const local = clientX - box.left
    return Math.max(0, Math.min(count - 1, Math.round((local - LAYOUT.left) / step - 0.5)))
  }

  const onPointerMove = (event: PointerEvent<SVGSVGElement>): void => { setHover(indexAt(event.clientX)) }
  const onPointerLeave = (): void => { setHover(null) }
  const onKeyDown = useCallback((event: KeyboardEvent<SVGSVGElement>): void => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    setHover((current) => {
      const base = current ?? count - 1
      return Math.max(0, Math.min(count - 1, base + (event.key === 'ArrowRight' ? 1 : -1)))
    })
  }, [count])

  const candles = model.bars.map((session, i) => {
    const cx = x(i)
    const top = y(Math.max(session.open, session.close))
    const bottom = y(Math.min(session.open, session.close))
    return (
      <g key={session.date} className={isRising(session) ? css.rise : css.fall}>
        <line className={css.wick} x1={cx} x2={cx} y1={y(session.high)} y2={y(session.low)} />
        <rect className={css.body} x={cx - body / 2} width={body} y={top} height={Math.max(bottom - top, 1)} />
      </g>
    )
  })

  const averages = model.mas.map((ma, order) => {
    let path = ''
    for (let i = 0; i < ma.values.length; i += 1) {
      const value = ma.values[i]
      if (value === null || value === undefined) continue
      path += `${path === '' ? 'M' : 'L'}${x(i).toFixed(1)} ${y(value).toFixed(1)}`
    }
    // A window shorter than the period has no line to draw.
    if (path === '') return null
    return <path key={ma.period} className={clsx(css.ma, css[`ma${order}`])} d={path} />
  })

  const lowerPane = (() => {
    if (pane === 'volume') {
      return model.bars.map((session, i) => {
        const height = (session.volume / model.volumeMax) * LAYOUT.lower
        return (
          <rect
            key={session.date}
            className={clsx(css.volumeBar, isRising(session) ? css.rise : css.fall)}
            x={x(i) - body / 2}
            width={body}
            y={lowerTop + LAYOUT.lower - height}
            height={Math.max(height, 0.6)}
          />
        )
      })
    }
    if (pane === 'macd') {
      // A flat window has no scale; the zero line alone is the honest drawing.
      const scale = model.macdScale === 0 ? 1 : model.macdScale
      const mid = lowerTop + LAYOUT.lower / 2
      const toY = (value: number): number => mid - (value / scale) * (LAYOUT.lower / 2) * 0.9
      const line = (pick: (point: { dif: number; dea: number }) => number): string => {
        let path = ''
        for (let i = 0; i < model.macd.length; i += 1) {
          const point = model.macd[i]
          if (point === null || point === undefined) continue
          path += `${path === '' ? 'M' : 'L'}${x(i).toFixed(1)} ${toY(pick(point)).toFixed(1)}`
        }
        return path
      }
      const difPath = line(point => point.dif)
      const deaPath = line(point => point.dea)
      return (
        <>
          <line className={css.zeroLine} x1={LAYOUT.left} x2={width - LAYOUT.right} y1={mid} y2={mid} />
          {model.macd.map((point, i) => point === null ? null : (
            <rect
              key={model.bars[i]?.date}
              className={clsx(css.volumeBar, point.histogram >= 0 ? css.rise : css.fall)}
              x={x(i) - body / 2}
              width={body}
              y={Math.min(mid, toY(point.histogram))}
              height={Math.max(Math.abs(toY(point.histogram) - mid), 0.6)}
            />
          ))}
          {difPath === '' ? null : <path className={clsx(css.ma, css.ma0)} d={difPath} />}
          {deaPath === '' ? null : <path className={clsx(css.ma, css.ma1)} d={deaPath} />}
        </>
      )
    }
    // KDJ rides a fixed 0..100 box, so readings stay comparable across windows.
    const toY = (value: number): number =>
      lowerTop + LAYOUT.lower - (Math.max(-20, Math.min(120, value)) + 20) / 140 * LAYOUT.lower
    const line = (pick: (point: { k: number; d: number; j: number }) => number): string => {
      let path = ''
      for (let i = 0; i < model.kdj.length; i += 1) {
        const point = model.kdj[i]
        if (point === null || point === undefined) continue
        path += `${path === '' ? 'M' : 'L'}${x(i).toFixed(1)} ${toY(pick(point)).toFixed(1)}`
      }
      return path
    }
    const paths = [
      { key: 'k', d: line(point => point.k), cls: css.ma0 },
      { key: 'd', d: line(point => point.d), cls: css.ma1 },
      { key: 'j', d: line(point => point.j), cls: css.ma2 },
    ]
    return (
      <>
        {[20, 50, 80].map(level => (
          <line
            key={level}
            className={css.zeroLine}
            x1={LAYOUT.left}
            x2={width - LAYOUT.right}
            y1={toY(level)}
            y2={toY(level)}
          />
        ))}
        {paths.map(entry => entry.d === '' ? null : <path key={entry.key} className={clsx(css.ma, entry.cls)} d={entry.d} />)}
      </>
    )
  })()

  const cursorX = x(index)
  const cursorY = y(bar.close)
  const dateBubbleWidth = 68
  const dateBubbleX = Math.max(
    LAYOUT.left,
    Math.min(width - LAYOUT.right - dateBubbleWidth, cursorX - dateBubbleWidth / 2),
  )

  const paneValues = ((): string => {
    if (pane === 'volume') return `${t('chart.volume')} ${shares(bar.volume)}`
    if (pane === 'macd') {
      const point = model.macd[index]
      return point === undefined || point === null
        ? 'MACD —'
        : `DIF ${point.dif.toFixed(2)}  DEA ${point.dea.toFixed(2)}  M ${point.histogram.toFixed(2)}`
    }
    const point = model.kdj[index]
    return point === undefined || point === null
      ? 'KDJ —'
      : `K ${point.k.toFixed(2)}  D ${point.d.toFixed(2)}  J ${point.j.toFixed(2)}`
  })()

  return (
    <div className={css.chart} ref={frame}>
      <div className={css.head}>
        <div className={css.identity}>
          {showLabel && <span className={css.label}>{label}</span>}
          <span className={css.date}>{bar.date}</span>
        </div>
        {/* An <output> because this is the crosshair's result, not static text:
            it carries an implicit live region, so moving the cursor announces
            the new price instead of changing it silently. */}
        <output className={clsx(css.quote, css[direction])}>
          <span className={css.last}>{price(bar.close, digits)}</span>
          <span className={css.delta}>
            {`${change > 0 ? '+' : ''}${price(change, digits)}`}
          </span>
          <span className={css.delta}>
            {`${percent > 0 ? '+' : ''}${percent.toFixed(2)}%`}
          </span>
          {currency !== undefined && <span className={css.currency}>{currency}</span>}
        </output>
      </div>

      <div className={css.readout}>
        <span><b>{t('chart.open')}</b>{price(bar.open, digits)}</span>
        <span><b>{t('chart.high')}</b>{price(bar.high, digits)}</span>
        <span><b>{t('chart.low')}</b>{price(bar.low, digits)}</span>
        <span><b>{t('chart.close')}</b>{price(bar.close, digits)}</span>
        <span className={css.paneValues}>{paneValues}</span>
      </div>

      <div className={css.legend}>
        {model.mas.map((ma, order) => {
          const value = ma.values[index]
          return (
            <span key={ma.period} className={css.legendItem}>
              <i className={clsx(css.swatch, css[`ma${order}`])} />
              {`MA${ma.period} ${value === null || value === undefined ? '—' : price(value, digits)}`}
            </span>
          )
        })}
      </div>

      <div className={css.controls}>
        <div className={css.segment} role="group" aria-label={t('chart.range.label')}>
          {RANGES.map((range, order) => (
            <button
              key={range.key}
              type="button"
              aria-pressed={order === rangeIndex}
              onClick={() => { setRangeIndex(order); setHover(null) }}
            >
              {t(range.key)}
            </button>
          ))}
        </div>
        <div className={css.segment} role="group" aria-label={t('chart.pane.label')}>
          {PANES.map(option => (
            <button
              key={option}
              type="button"
              aria-pressed={option === pane}
              onClick={() => { setPane(option) }}
            >
              {t(`chart.pane.${option}`)}
            </button>
          ))}
        </div>
      </div>

      <svg
        className={css.plot}
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        tabIndex={0}
        role="img"
        aria-label={t('chart.aria', {
          label,
          count: String(count),
          pane: t(`chart.pane.${pane}`),
        })}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        onKeyDown={onKeyDown}
      >
        <g>
          {model.priceTicks.map(tick => (
            <g key={tick}>
              <line className={css.grid} x1={LAYOUT.left} x2={width - LAYOUT.right} y1={y(tick)} y2={y(tick)} />
              <text className={css.axisText} x={width - LAYOUT.right + 7} y={y(tick) + 3.5}>
                {price(tick, digits)}
              </text>
            </g>
          ))}
          <line className={css.grid} x1={LAYOUT.left} x2={width - LAYOUT.right} y1={lowerTop} y2={lowerTop} />
        </g>
        {candles}
        {averages}
        {lowerPane}
        <g className={css.cursor}>
          <line x1={cursorX} x2={cursorX} y1={LAYOUT.top} y2={lowerTop + LAYOUT.lower} />
          <line x1={LAYOUT.left} x2={width - LAYOUT.right} y1={cursorY} y2={cursorY} />
          <rect className={css.bubble} x={width - LAYOUT.right + 2} y={cursorY - 9} width={LAYOUT.right - 6} height={18} rx={3} />
          <text className={css.bubbleText} x={width - LAYOUT.right + 7} y={cursorY + 4}>{price(bar.close, digits)}</text>
          <rect className={css.bubble} x={dateBubbleX} y={height - LAYOUT.axis + 1} width={dateBubbleWidth} height={17} rx={3} />
          <text className={css.bubbleText} x={dateBubbleX + dateBubbleWidth / 2} y={height - LAYOUT.axis + 13} textAnchor="middle">
            {bar.date}
          </text>
        </g>
      </svg>

      <p className={css.summary}>
        {t('chart.summary', {
          count: String(count),
          from: model.bars[0]?.date ?? '',
          to: model.bars[count - 1]?.date ?? '',
          low: price(Math.min(...model.bars.map(session => session.low)), digits),
          high: price(Math.max(...model.bars.map(session => session.high)), digits),
          adjustment: t(`chart.adjustment.${adjustment}`),
        })}
      </p>
    </div>
  )
}

export type { ProChartModel }
