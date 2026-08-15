// @vitest-environment jsdom
/**
 * Price-series toolview: model derivation from the render intent (including
 * every generic-card fallback), chart geometry, and the keyed registration
 * with fiber teardown proving removal (HMR safety).
 */
import { Context } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import type { ToolCallBlock } from '@deepseek-ai/dsh-client-runtime/client'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import { zh } from '@deepseek-ai/dsh-client-ui-conversation/src/client/locales.ts'
import { priceSeriesModel } from '../src/client/tool/models/price-series-card-model.ts'
import { PriceSeriesChart } from '../src/client/tool/toolviews/PriceSeriesChart.tsx'
import { PRICE_SERIES_TOOL, PriceSeriesRow, priceSeriesToolview } from '../src/client/tool/toolviews/price-series-row.tsx'

afterEach(cleanup)

// Mirrors the real lookup chain (conversation namespace, then common).
const t = makeTranslate(zh, commonZh)

const bars = [
  { date: '2026-08-12', open: 100, high: 110, low: 95, close: 105, volume: 10 },
  { date: '2026-08-13', open: 105, high: 108, low: 100, close: 102, volume: 12 },
  { date: '2026-08-14', open: 102, high: 120, low: 101, close: 118, volume: 15 },
]

/** A settled tool call carrying the given result view. */
function settled(resultView: unknown): ToolCallBlock {
  return { kind: 'tool-result', callId: 'c1', isError: false, resultView } as never
}

describe('priceSeriesModel', () => {
  it('derives unit geometry and the series summary from a price-series card', () => {
    const model = priceSeriesModel(settled({
      card: 'price-series', label: 'SZSE:300750', bars, adjustment: 'backward', currency: 'CNY',
    }))

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
    const model = priceSeriesModel(settled({
      card: 'price-series', label: 'x', bars, adjustment: 'none',
    }))
    const first = model?.bars[0]

    // Range is 95..120, so the first bar's low sits at the very bottom.
    expect(first?.lowUnit).toBe(0)
    expect(first?.highUnit).toBeCloseTo((110 - 95) / 25)
    expect(first?.bodyTopUnit).toBeCloseTo((105 - 95) / 25)
    expect(first?.bodyBottomUnit).toBeCloseTo((100 - 95) / 25)
    expect(first?.rising).toBe(true)
    expect(model?.bars[1]?.rising).toBe(false)
  })

  it('omits currency when the tool supplied none', () => {
    const model = priceSeriesModel(settled({ card: 'price-series', label: 'x', bars, adjustment: 'none' }))

    expect(model?.currency).toBeUndefined()
  })

  it('takes the generic path for a running call', () => {
    expect(priceSeriesModel({ callId: 'c1', argsRaw: '' } as never)).toBeNull()
  })

  it.each([
    ['a generic result view', { card: 'generic', title: 'History' }],
    ['a card this UI version does not know', { card: 'candlestick-v2', label: 'x', bars, adjustment: 'none' }],
    ['no result view at all', undefined],
  ])('takes the generic path for %s', (_label, resultView) => {
    expect(priceSeriesModel(settled(resultView))).toBeNull()
  })

  it('takes the generic path for an empty series, which has nothing to plot', () => {
    expect(priceSeriesModel(settled({ card: 'price-series', label: 'x', bars: [], adjustment: 'none' }))).toBeNull()
  })

  it('takes the generic path for a flat series rather than drawing an arbitrary line', () => {
    const flat = [{ date: '2026-08-14', open: 10, high: 10, low: 10, close: 10, volume: 1 }]

    expect(priceSeriesModel(settled({ card: 'price-series', label: 'x', bars: flat, adjustment: 'none' }))).toBeNull()
  })
})

describe('PriceSeriesChart', () => {
  it('states the label, the change, and the adjustment', () => {
    const model = priceSeriesModel(settled({
      card: 'price-series', label: 'SZSE:300750', bars, adjustment: 'backward', currency: 'CNY',
    }))
    render(<PriceSeriesChart model={model!} />)

    expect(screen.getByText('SZSE:300750')).toBeTruthy()
    expect(screen.getByText('118 CNY (+18%)')).toBeTruthy()
    expect(screen.getByText('back-adjusted')).toBeTruthy()
    expect(screen.getByText('low 95 · high 120')).toBeTruthy()
    expect(screen.getByText('3 sessions')).toBeTruthy()
  })

  it('labels the plot for assistive technology with its range and basis', () => {
    const model = priceSeriesModel(settled({ card: 'price-series', label: 'x', bars, adjustment: 'none' }))
    render(<PriceSeriesChart model={model!} />)

    expect(screen.getByRole('img').getAttribute('aria-label'))
      .toBe('3 sessions from 2026-08-12 to 2026-08-14, as traded')
  })

  it('draws one wick and one body per session', () => {
    const model = priceSeriesModel(settled({ card: 'price-series', label: 'x', bars, adjustment: 'none' }))
    const { container } = render(<PriceSeriesChart model={model!} />)

    expect(container.querySelectorAll('line')).toHaveLength(3)
    expect(container.querySelectorAll('rect')).toHaveLength(3)
  })

  it('draws a doji session as a hairline rather than a zero-height body', () => {
    const doji = [
      { date: '2026-08-13', open: 100, high: 110, low: 90, close: 100, volume: 1 },
      { date: '2026-08-14', open: 100, high: 105, low: 95, close: 104, volume: 1 },
    ]
    const model = priceSeriesModel(settled({ card: 'price-series', label: 'x', bars: doji, adjustment: 'none' }))
    const { container } = render(<PriceSeriesChart model={model!} />)

    // Two wicks plus the doji's body hairline; only the second bar gets a rect.
    expect(container.querySelectorAll('line')).toHaveLength(3)
    expect(container.querySelectorAll('rect')).toHaveLength(1)
  })
})

describe('PriceSeriesRow expansion', () => {
  const CARD = { card: 'price-series', label: 'SZSE:300750', bars, adjustment: 'none' as const }

  const ARGS = '{"market":"SZSE","symbol":"300750","sessions":3}'

  /** A running call: no result view yet, so no series to plot. */
  function pending(): ToolCallBlock {
    return {
      callId: 'c1', name: PRICE_SERIES_TOOL, argsRaw: ARGS,
      turn: 1, step: 1, time: 1_000, callView: null, subCalls: [],
    }
  }

  /** The same call settled, carrying the price-series card the row plots. */
  function done(): ToolCallBlock {
    return {
      kind: 'tool-result', seq: 10, time: 2_000, callId: 'c1',
      call: { name: PRICE_SERIES_TOOL, argsRaw: ARGS }, callTime: 1_000,
      content: [], isError: false, callView: null, resultView: CARD, subCalls: [],
    } as never
  }

  const rowProps = (block: ToolCallBlock): Parameters<typeof PriceSeriesRow>[0] =>
    ({ callId: 'c1', toolName: PRICE_SERIES_TOOL, block, openFile: () => {}, t } as never)

  it('opens the chart with no click, because the series is the answer, not the work behind one', () => {
    const view = render(<PriceSeriesRow {...rowProps(done())} />)

    expect(view.getByRole('img').getAttribute('aria-label')).toContain('3 sessions')
  })

  it('opens a call that settles after the row mounted, which is every live call', () => {
    // The row appears while the tool runs and is re-rendered in place when the
    // result lands: deciding at mount alone would leave every live chart shut.
    const view = render(<PriceSeriesRow {...rowProps(pending())} />)
    expect(view.queryByRole('img')).toBeNull()

    view.rerender(<PriceSeriesRow {...rowProps(done())} />)
    expect(view.getByRole('img')).toBeTruthy()
  })

  it('keeps a collapse the reader chose', () => {
    const view = render(<PriceSeriesRow {...rowProps(done())} />)
    fireEvent.click(view.container.querySelector('[data-expandable]')!)

    expect(view.queryByRole('img')).toBeNull()
  })
})

describe('price-series toolview registration', () => {
  it('registers under the history tool key, and fiber teardown removes it (HMR safety)', async () => {
    const ctx = new Context()
    await ctx.plugin(SlotRegistry).await()
    ctx.slots.register({
      name: 'root',
      children: { 'tool.call.toolview': { kind: 'keyed', scope: 'session' } },
    } as never, () => null)

    const fiber = ctx.plugin(priceSeriesToolview)
    await fiber.await()
    expect(ctx.slots.entries('tool.call.toolview').map(entry => entry.options.key)).toContain(PRICE_SERIES_TOOL)

    await fiber.dispose()
    expect(ctx.slots.entries('tool.call.toolview').map(entry => entry.options.key)).not.toContain(PRICE_SERIES_TOOL)
  })
})
