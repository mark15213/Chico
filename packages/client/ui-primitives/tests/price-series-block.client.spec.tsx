// @vitest-environment jsdom
/**
 * Price-series block: the geometry derived from a raw series, the two series
 * shapes that have nothing to plot, and what the drawn chart states.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { PriceSeriesBlock, priceSeriesModel } from '../src/PriceSeriesBlock.tsx'

afterEach(cleanup)

const bars = [
  { date: '2026-08-12', open: 100, high: 110, low: 95, close: 105 },
  { date: '2026-08-13', open: 105, high: 108, low: 100, close: 102 },
  { date: '2026-08-14', open: 102, high: 120, low: 101, close: 118 },
]

describe('priceSeriesModel', () => {
  it('derives the series summary from the whole range', () => {
    const model = priceSeriesModel({ label: 'SZSE:300750', bars, adjustment: 'backward', currency: 'CNY' })

    expect(model).not.toBeNull()
    expect(model?.label).toBe('SZSE:300750')
    expect(model?.adjustment).toBe('backward')
    expect(model?.currency).toBe('CNY')
    expect(model?.low).toBe(95)
    expect(model?.high).toBe(120)
    expect(model?.last).toBe(118)
    // 100 open to 118 close over the series.
    expect(model?.changePercent).toBe(18)
  })

  it('normalizes each bar into the unit box against the whole series range', () => {
    const model = priceSeriesModel({ label: 'x', bars, adjustment: 'none' })
    const first = model?.bars[0]

    // Range is 95..120, so the first bar's low sits at the very bottom.
    expect(first?.lowUnit).toBe(0)
    expect(first?.highUnit).toBeCloseTo((110 - 95) / 25)
    expect(first?.bodyTopUnit).toBeCloseTo((105 - 95) / 25)
    expect(first?.bodyBottomUnit).toBeCloseTo((100 - 95) / 25)
    expect(first?.rising).toBe(true)
    expect(model?.bars[1]?.rising).toBe(false)
  })

  it('omits currency when the caller supplied none', () => {
    expect(priceSeriesModel({ label: 'x', bars, adjustment: 'none' })?.currency).toBeUndefined()
  })

  it('has nothing to plot for an empty series', () => {
    expect(priceSeriesModel({ label: 'x', bars: [], adjustment: 'none' })).toBeNull()
  })

  it('refuses a flat series rather than drawing an arbitrary line', () => {
    const flat = [{ date: '2026-08-14', open: 10, high: 10, low: 10, close: 10 }]

    expect(priceSeriesModel({ label: 'x', bars: flat, adjustment: 'none' })).toBeNull()
  })
})

describe('PriceSeriesBlock', () => {
  it('states the label, the change, and the adjustment', () => {
    const model = priceSeriesModel({ label: 'SZSE:300750', bars, adjustment: 'backward', currency: 'CNY' })
    render(<PriceSeriesBlock model={model!} />)

    expect(screen.getByText('SZSE:300750')).toBeTruthy()
    expect(screen.getByText('118 CNY (+18%)')).toBeTruthy()
    expect(screen.getByText('back-adjusted')).toBeTruthy()
    expect(screen.getByText('low 95 · high 120')).toBeTruthy()
    expect(screen.getByText('3 sessions')).toBeTruthy()
  })

  it('labels the plot for assistive technology with its range and basis', () => {
    const model = priceSeriesModel({ label: 'x', bars, adjustment: 'none' })
    render(<PriceSeriesBlock model={model!} />)

    expect(screen.getByRole('img').getAttribute('aria-label'))
      .toBe('3 sessions from 2026-08-12 to 2026-08-14, as traded')
  })

  it('draws one wick and one body per session', () => {
    const model = priceSeriesModel({ label: 'x', bars, adjustment: 'none' })
    const { container } = render(<PriceSeriesBlock model={model!} />)

    expect(container.querySelectorAll('line')).toHaveLength(3)
    expect(container.querySelectorAll('rect')).toHaveLength(3)
  })

  it('draws a doji session as a hairline rather than a zero-height body', () => {
    const doji = [
      { date: '2026-08-13', open: 100, high: 110, low: 90, close: 100 },
      { date: '2026-08-14', open: 100, high: 105, low: 95, close: 104 },
    ]
    const model = priceSeriesModel({ label: 'x', bars: doji, adjustment: 'none' })
    const { container } = render(<PriceSeriesBlock model={model!} />)

    // Two wicks plus the doji's body hairline; only the second bar gets a rect.
    expect(container.querySelectorAll('line')).toHaveLength(3)
    expect(container.querySelectorAll('rect')).toHaveLength(1)
  })
})
