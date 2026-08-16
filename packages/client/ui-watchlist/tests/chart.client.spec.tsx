// @vitest-environment jsdom
/**
 * The workbench chart: indicator arithmetic against hand-computable series, the
 * derived model's window and range rules, the crosshair readout, the lower-pane
 * switch, and the per-conversation choice that keeps the shipped candles in a
 * conversation that is not about a name.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, within } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type { PriceSeriesBar } from '@deepseek-ai/dsh-client-ui-primitives'
import type { SessionId } from '@deepseek-ai/dsh-api-remotes/client'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import { en } from '../src/client/locales.ts'
import {
  exponentialMovingAverage, kdj, macd, movingAverage, niceTicks,
} from '../src/client/chart/indicators.ts'
import { changeAt, proChartModel } from '../src/client/chart/chart-model.ts'
import { ProChart } from '../src/client/chart/ProChart.tsx'
import { WorkbenchChart } from '../src/client/chart/WorkbenchChart.tsx'
import { WorkbenchFocus } from '../src/client/workbench-store.ts'

afterEach(cleanup)

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub)

const t = makeTranslate(en, commonZh)

/** A rising series with a readable shape: close climbs by 1 each session. */
function series(count: number, from = 100): PriceSeriesBar[] {
  return Array.from({ length: count }, (_, i) => {
    const close = from + i
    return {
      date: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`,
      open: close - 0.5,
      high: close + 1,
      low: close - 1,
      close,
      volume: 1000 + i * 10,
    }
  })
}

describe('indicators', () => {
  it('averages only once the window has filled', () => {
    expect(movingAverage([1, 2, 3, 4], 2)).toEqual([null, 1.5, 2.5, 3.5])
  })

  it('seeds the exponential average from the first observation, not from zero', () => {
    const ema = exponentialMovingAverage([10, 20], 3)

    expect(ema[0]).toBe(10)
    // alpha = 2/(3+1) = 0.5
    expect(ema[1]).toBe(15)
  })

  it('has no exponential average for an empty series', () => {
    expect(exponentialMovingAverage([], 5)).toEqual([])
  })

  it('suppresses MACD until the slow window has passed, then reports the doubled histogram', () => {
    const points = macd(series(40).map(bar => bar.close))

    expect(points.slice(0, 25).every(point => point === null)).toBe(true)
    const settled = points[39]
    expect(settled).not.toBeNull()
    expect(settled?.histogram).toBeCloseTo((settled!.dif - settled!.dea) * 2, 10)
  })

  it('puts KDJ at the top of its range for a series closing at its highs', () => {
    const points = kdj(series(20))

    expect(points.slice(0, 8).every(point => point === null)).toBe(true)
    const settled = points[19]
    expect(settled!.k).toBeGreaterThan(80)
    // J overshoots K and D by construction: 3K − 2D.
    expect(settled!.j).toBeCloseTo(3 * settled!.k - 2 * settled!.d, 10)
  })

  it('holds the previous KDJ reading through a window with no range', () => {
    const flat = Array.from({ length: 12 }, () => ({ high: 5, low: 5, close: 5 }))
    const points = kdj(flat)

    // RSV is undefined without a range; the neutral seed carries through.
    expect(points[11]!.k).toBeCloseTo(50, 6)
    expect(points[11]!.d).toBeCloseTo(50, 6)
  })

  it('picks tick steps a reader can place a price against', () => {
    expect(niceTicks(0, 100, 5)).toEqual([0, 20, 40, 60, 80, 100])
    expect(niceTicks(5, 5, 5)).toEqual([5])
  })

  it.each([
    [1.4, 'a 1-step'],
    [3, 'a 5-step'],
    [7, 'a 10-step'],
  ])('rounds a %s rough interval to %s', (rough) => {
    const ticks = niceTicks(0, rough * 5, 5)

    expect(ticks.length).toBeGreaterThan(1)
    const step = (ticks[1] as number) - (ticks[0] as number)
    const mantissa = step / 10 ** Math.floor(Math.log10(step))
    expect([1, 2, 5, 10]).toContain(Math.round(mantissa))
  })
})

describe('proChartModel', () => {
  it('keeps only the requested window but computes indicators over the whole series', () => {
    const all = series(300)
    const windowed = proChartModel(all, 30)
    const whole = proChartModel(all, 300)

    expect(windowed?.bars).toHaveLength(30)
    // MA60 at the last session is the same number either way: restarting the
    // warm-up at the window edge would make the reading depend on the zoom.
    const ma60Windowed = windowed?.mas[3]?.values.at(-1)
    const ma60Whole = whole?.mas[3]?.values.at(-1)
    expect(ma60Windowed).toBeCloseTo(ma60Whole as number, 10)
  })

  it('widens the price range to contain the visible averages', () => {
    // A series that fell hard leaves MA60 well above every visible high.
    const bars = [...series(80, 200), ...series(20, 100)]
    const model = proChartModel(bars, 20)
    const visibleHigh = Math.max(...(model?.bars ?? []).map(bar => bar.high))
    const ma60 = (model?.mas[3]?.values ?? []).filter((v): v is number => v !== null)

    expect(Math.max(...ma60)).toBeGreaterThan(visibleHigh)
    expect(model?.high).toBeGreaterThanOrEqual(Math.max(...ma60))
  })

  it('refuses an empty series and a window with no price range', () => {
    expect(proChartModel([], 30)).toBeNull()
    const flat = Array.from({ length: 5 }, (_, i) => ({
      date: `2026-01-0${i + 1}`, open: 10, high: 10, low: 10, close: 10, volume: 1,
    }))
    expect(proChartModel(flat, 5)).toBeNull()
  })

  it('clamps a window longer than the series, and a non-positive one to a single session', () => {
    expect(proChartModel(series(10), 999)?.bars).toHaveLength(10)
    expect(proChartModel(series(10), 0)?.bars).toHaveLength(1)
  })

  it('measures the first visible session against its own open, having no predecessor', () => {
    const model = proChartModel(series(5), 5)

    expect(changeAt(model!, 0).change).toBeCloseTo(0.5, 10)
    expect(changeAt(model!, 1).change).toBeCloseTo(1, 10)
  })
})

describe('ProChart', () => {
  const props = { label: 'SSE:600519', bars: series(120), adjustment: 'none' as const, currency: 'CNY', t }

  it('reads the last session until the pointer names another', () => {
    const view = render(<ProChart {...props} />)

    // The headline is the crosshair's result, so it is the one place that
    // must name the focused session; the same number also appears in the OHLC
    // readout and the axis bubble, which is what a quote screen does.
    // A name above 200 shows one decimal; precision follows the price.
    const headline = (): string => within(view.getByRole('status')).getByText(/^\d/).textContent ?? ''
    expect(headline()).toBe('219.0')
    fireEvent.keyDown(view.getByRole('img'), { key: 'ArrowLeft' })
    expect(headline()).toBe('218.0')
  })

  it('stops at the ends instead of running off the series', () => {
    const view = render(<ProChart {...props} bars={series(3)} />)
    const plot = view.getByRole('img')

    const headline = (): string => within(view.getByRole('status')).getByText(/^\d/).textContent ?? ''

    fireEvent.keyDown(plot, { key: 'ArrowRight' })
    expect(headline()).toBe('102.00')
    for (let i = 0; i < 5; i += 1) fireEvent.keyDown(plot, { key: 'ArrowLeft' })
    expect(headline()).toBe('100.00')
  })

  it('ignores keys that are not the two it moves on', () => {
    const view = render(<ProChart {...props} />)

    fireEvent.keyDown(view.getByRole('img'), { key: 'Enter' })
    expect(within(view.getByRole('status')).getByText(/^\d/).textContent).toBe('219.0')
  })

  it('switches the lower pane, and names the pane in the accessible label', () => {
    const view = render(<ProChart {...props} />)

    expect(view.getByRole('img').getAttribute('aria-label')).toContain('Volume')
    fireEvent.click(view.getByRole('button', { name: 'MACD' }))
    expect(view.getByRole('img').getAttribute('aria-label')).toContain('MACD')
    expect(view.getByText(/DIF/)).toBeTruthy()
    fireEvent.click(view.getByRole('button', { name: 'KDJ' }))
    expect(view.getByText(/^K /)).toBeTruthy()
  })

  it('shows a dash for an indicator the window is too short to value', () => {
    const view = render(<ProChart {...props} bars={series(5)} />)

    fireEvent.click(view.getByRole('button', { name: 'MACD' }))
    expect(view.getByText('MACD —')).toBeTruthy()
    fireEvent.click(view.getByRole('button', { name: 'KDJ' }))
    expect(view.getByText('KDJ —')).toBeTruthy()
  })

  it('narrows the window on a range switch', () => {
    const view = render(<ProChart {...props} />)

    expect(view.getByText(/120 sessions/)).toBeTruthy()
    fireEvent.click(view.getByRole('button', { name: '1M' }))
    expect(view.getByText(/21 sessions/)).toBeTruthy()
  })

  it('states the adjustment basis, because comparing across bases is the mistake', () => {
    const view = render(<ProChart {...props} adjustment="backward" />)

    expect(view.getByText(/back-adjusted/)).toBeTruthy()
  })

  it('says so rather than drawing a shape when the window has no range', () => {
    const flat = Array.from({ length: 4 }, (_, i) => ({
      date: `2026-01-0${i + 1}`, open: 7, high: 7, low: 7, close: 7, volume: 1,
    }))
    const view = render(<ProChart {...props} bars={flat} />)

    expect(view.getByText('Nothing to plot over this range.')).toBeTruthy()
    expect(view.queryByRole('img')).toBeNull()
  })

  it('drops the currency when the caller has none', () => {
    const view = render(<ProChart {...props} currency={undefined} />)

    expect(view.queryByText('CNY')).toBeNull()
  })

  it('names the instrument by default, and yields the name to a host that already shows it', () => {
    const withLabel = render(<ProChart {...props} />)
    expect(withLabel.getByText('SSE:600519')).toBeTruthy()
    cleanup()

    const without = render(<ProChart {...props} showLabel={false} />)
    expect(without.queryByText('SSE:600519')).toBeNull()
    // The crosshair's own readings stay: they follow the cursor, not the panel.
    expect(without.getAllByText('2026-01-08').length).toBeGreaterThan(0)
  })

  it('scales the plot to the measured width instead of holding one height', () => {
    const view = render(<ProChart {...props} />)
    const svg = view.getByRole('img')
    // 720 assumed width → main pane clamps at 280 → total 10+280+10+84+22 = 406.
    expect(svg.getAttribute('height')).toBe('406')
    expect(svg.getAttribute('viewBox')).toBe('0 0 720 406')
  })
})

describe('WorkbenchChart', () => {
  const model = {
    label: 'SSE:600519',
    adjustment: 'none' as const,
    currency: 'CNY',
    bars: [],
    low: 1,
    high: 2,
    last: 2,
    changePercent: 1,
  }
  const bars = series(30)

  it('keeps the shipped candles in a conversation that is not about a name', () => {
    const focus = new WorkbenchFocus()
    const view = render(
      <WorkbenchChart model={model} bars={bars} sessionId={'s1' as SessionId} selection={focus} t={t} />,
    )

    // The shipped block draws the series header; the workbench chart draws controls.
    expect(view.queryByRole('button', { name: 'MACD' })).toBeNull()
  })

  it('draws the workbench chart once the conversation is bound to a name', () => {
    const focus = new WorkbenchFocus()
    focus.open({ market: 'SSE', symbol: '600519' }, '贵州茅台', ['s1' as SessionId])
    const view = render(
      <WorkbenchChart model={model} bars={bars} sessionId={'s1' as SessionId} selection={focus} t={t} />,
    )

    expect(view.getByRole('button', { name: 'MACD' })).toBeTruthy()
  })

  it('keeps the shipped candles outside any conversation', () => {
    const focus = new WorkbenchFocus()
    focus.open({ market: 'SSE', symbol: '600519' }, '贵州茅台', ['s1' as SessionId])
    const view = render(
      <WorkbenchChart model={model} bars={bars} sessionId={undefined} selection={focus} t={t} />,
    )

    expect(view.queryByRole('button', { name: 'MACD' })).toBeNull()
  })
})
