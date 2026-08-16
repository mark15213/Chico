// @vitest-environment jsdom
/**
 * Price-series toolview: card extraction from the render intent (including
 * every generic-card fallback), the row's expansion states, and the keyed
 * registration with fiber teardown proving removal (HMR safety). Geometry and
 * drawing are ui-primitives' and are asserted there.
 */
import { Context } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import type { ToolCallBlock } from '@deepseek-ai/dsh-client-runtime/client'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import { zh } from '@deepseek-ai/dsh-client-ui-conversation/src/client/locales.ts'
import { priceSeriesCardModel } from '../src/client/tool/models/price-series-card-model.ts'
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

describe('priceSeriesCardModel', () => {
  it('extracts the card a market-data tool declared, with its label and basis', () => {
    const card = priceSeriesCardModel(settled({
      card: 'price-series', label: 'SZSE:300750', bars, adjustment: 'backward', currency: 'CNY',
    }))

    expect(card?.model.label).toBe('SZSE:300750')
    expect(card?.model.adjustment).toBe('backward')
    expect(card?.model.currency).toBe('CNY')
    expect(card?.model.bars).toHaveLength(3)
    // The source bars travel with the derived model so a chart on the seat can
    // read what the geometry drops — volume above all.
    expect(card?.bars.map(bar => bar.volume)).toEqual([10, 12, 15])
  })

  it('takes the generic path for a running call', () => {
    expect(priceSeriesCardModel({ callId: 'c1', argsRaw: '' } as never)).toBeNull()
  })

  it.each([
    ['a generic result view', { card: 'generic', title: 'History' }],
    ['a card this UI version does not know', { card: 'candlestick-v2', label: 'x', bars, adjustment: 'none' }],
    ['no result view at all', undefined],
  ])('takes the generic path for %s', (_label, resultView) => {
    expect(priceSeriesCardModel(settled(resultView))).toBeNull()
  })

  it('takes the generic path for a series with no range to plot', () => {
    const flat = [{ date: '2026-08-14', open: 10, high: 10, low: 10, close: 10, volume: 1 }]

    expect(priceSeriesCardModel(settled({ card: 'price-series', label: 'x', bars: [], adjustment: 'none' }))).toBeNull()
    expect(priceSeriesCardModel(settled({ card: 'price-series', label: 'x', bars: flat, adjustment: 'none' }))).toBeNull()
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

  /** An empty chart seat: what every composition that registers no chart has. */
  const emptySeat = { occupied: () => false, subscribe: () => () => {}, version: () => 0 }

  const rowProps = (
    block: ToolCallBlock,
    seat: typeof emptySeat = emptySeat,
    renderSlot: () => unknown = () => null,
  ): Parameters<typeof PriceSeriesRow>[0] =>
    ({ callId: 'c1', toolName: PRICE_SERIES_TOOL, block, openFile: () => {}, t, chartSeat: seat, renderSlot } as never)

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

describe('PriceSeriesRow chart seat', () => {
  const CARD = { card: 'price-series', label: 'SZSE:300750', bars, adjustment: 'none' as const }

  /** A settled call carrying the card, the only state that draws a chart. */
  function done(): ToolCallBlock {
    return {
      kind: 'tool-result', seq: 10, time: 2_000, callId: 'c1',
      call: { name: PRICE_SERIES_TOOL, argsRaw: '{}' }, callTime: 1_000,
      content: [], isError: false, callView: null, resultView: CARD, subCalls: [],
    } as never
  }

  const props = (
    occupied: boolean,
    renderSlot: (key: string, owner: unknown) => unknown,
  ): Parameters<typeof PriceSeriesRow>[0] => ({
    callId: 'c1',
    toolName: PRICE_SERIES_TOOL,
    block: done(),
    openFile: () => {},
    t,
    chartSeat: { occupied: () => occupied, subscribe: () => () => {}, version: () => 0 },
    renderSlot,
  } as never)

  it('draws the shipped candles when no composition claimed the seat', () => {
    const view = render(<PriceSeriesRow {...props(false, () => <div data-testid="other" />)} />)

    expect(view.getByRole('img').getAttribute('aria-label')).toContain('3 sessions')
    expect(view.queryByTestId('other')).toBeNull()
  })

  it('hands an occupied seat the derived model and the source bars, and draws that chart instead', () => {
    let owner: { model?: { label?: string }; bars?: readonly { volume: number }[] } = {}
    const view = render(<PriceSeriesRow {...props(true, (_key, received) => {
      owner = received as typeof owner
      return <div data-testid="pro-chart" />
    })} />)

    expect(view.getByTestId('pro-chart')).toBeTruthy()
    // The shipped candles are gone, not merely covered.
    expect(view.queryByRole('img')).toBeNull()
    expect(owner.model?.label).toBe('SZSE:300750')
    expect(owner.bars?.map(bar => bar.volume)).toEqual([10, 12, 15])
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
