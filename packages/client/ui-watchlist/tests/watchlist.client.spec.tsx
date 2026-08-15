// @vitest-environment jsdom
/**
 * Watchlist tab: the pure row derivations, the instrument lookup and its
 * debounce, the view's states over a stubbed Remote face, and the view-ring
 * registration with fiber teardown proving removal (HMR safety).
 */
import { Context, Service } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type { Quote, WatchlistRow, WatchlistSnapshot } from '@deepseek-ai/dsh-api-remotes/client'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import { en, NS } from '../src/client/locales.ts'
import {
  directionOf,
  formatChange,
  formatLast,
  instrumentLabel,
  normalizeQuery,
  rowFigures,
} from '../src/client/watchlist-model.ts'
import { WatchlistView, type WatchlistViewInjected } from '../src/client/WatchlistView.tsx'
import * as watchlistPlugin from '../src/client/index.ts'

afterEach(cleanup)

// English so the assertions read as the copy a user sees.
const t = makeTranslate(en, commonZh)

const CATL = { market: 'SZSE', symbol: '300750' } as const

function quote(over?: Partial<Quote>): Quote {
  return {
    instrument: CATL,
    name: '宁德时代',
    currency: 'CNY',
    last: 212.3,
    previousClose: 210,
    changePercent: 1.0952,
    volume: 1_000,
    asOf: '2026-08-14T07:00:00.000Z',
    session: 'closed',
    ...over,
  }
}

function row(over?: Partial<WatchlistRow>): WatchlistRow {
  return {
    instrument: CATL,
    displayName: '宁德时代',
    firstFollowedAt: '2026-08-14T07:00:00.000Z',
    quote: quote(),
    ...over,
  }
}

const MOUTAI = { market: 'SSE', symbol: '600519' } as const

/** A view over a stubbed Remote face; every call resolves unless overridden. */
function mount(over?: Partial<WatchlistViewInjected>, snapshot: WatchlistSnapshot = { rows: [row()] }) {
  const injected: WatchlistViewInjected = {
    list: vi.fn(() => Promise.resolve(snapshot)),
    search: vi.fn(() => Promise.resolve({
      matches: [{ instrument: MOUTAI, name: '贵州茅台', followed: false }],
    })),
    follow: vi.fn(() => Promise.resolve({ ok: true as const, row: row() })),
    unfollow: vi.fn(() => Promise.resolve()),
    ...over,
  }
  // The view reads only the inject face plus the locale seat off the full
  // runtime share, so the cast supplies those alone (as the tool-row tests do).
  const props = { ...injected, t } as unknown as Parameters<typeof WatchlistView>[0]
  const view = render(<WatchlistView {...props} />)
  return { view, injected }
}

describe('row derivations', () => {
  it('signs a change and pads it to a fixed width so a column of rows aligns', () => {
    expect(formatChange(1.0952)).toBe('+1.10%')
    expect(formatChange(-2)).toBe('−2.00%')
    expect(formatChange(0)).toBe('0.00%')
  })

  it('treats an unchanged price as its own direction rather than as a rise', () => {
    expect(directionOf(0.01)).toBe('up')
    expect(directionOf(-0.01)).toBe('down')
    expect(directionOf(0)).toBe('flat')
  })

  it('prices in the currency the venue quotes', () => {
    expect(formatLast(quote({ last: 1486, currency: 'CNY' }))).toBe('1486.00 CNY')
  })

  it('labels an instrument by the identity the user follows by', () => {
    expect(instrumentLabel(CATL)).toBe('SZSE:300750')
  })

  it('carries a row with no quote as nulls rather than as zeroes', () => {
    expect(rowFigures(row({ quote: null }))).toEqual({
      instrumentLabel: 'SZSE:300750', last: null, change: null, direction: null,
    })
  })

  it('takes the typing whitespace out of a query, and refuses an empty one', () => {
    expect(normalizeQuery('  300750 ')).toBe('300750')
    expect(normalizeQuery('   ')).toBeNull()
  })
})

describe('the watchlist tab', () => {
  it('lists a followed name with its price and change', async () => {
    mount()

    expect(await screen.findByText('宁德时代')).toBeTruthy()
    expect(screen.getByText('SZSE:300750')).toBeTruthy()
    expect(screen.getByText('212.30 CNY')).toBeTruthy()
    expect(screen.getByText('+1.10%')).toBeTruthy()
    expect(screen.getByText('Closed')).toBeTruthy()
  })

  it('colors the change through a data attribute, so the sign survives grayscale', async () => {
    const { view } = mount(undefined, { rows: [row({ quote: quote({ changePercent: -3 }) })] })

    await waitFor(() => { expect(view.getByText('−3.00%')).toBeTruthy() })
    expect(view.getByText('−3.00%').getAttribute('data-direction')).toBe('down')
  })

  it('keeps an unpriceable name on the list instead of dropping it', async () => {
    mount(undefined, { rows: [row({ quote: null })] })

    expect(await screen.findByText('宁德时代')).toBeTruthy()
    expect(screen.getByText('No quote')).toBeTruthy()
  })

  it('states how to fill an empty watchlist rather than showing a blank panel', async () => {
    mount(undefined, { rows: [] })

    expect(await screen.findByText('The watchlist is empty.')).toBeTruthy()
    expect(screen.getByText('Search above by code or name to follow the first one.')).toBeTruthy()
  })

  it('offers a retry when the list cannot be read', async () => {
    const list = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ rows: [row()] })
    const { view } = mount({ list })

    expect(await screen.findByRole('alert')).toBeTruthy()
    fireEvent.click(view.getByText('Retry'))

    expect(await screen.findByText('宁德时代')).toBeTruthy()
  })
})

describe('the instrument lookup', () => {
  /** Type into the search field, which is the whole trigger. */
  function type(view: ReturnType<typeof render>, text: string) {
    fireEvent.change(view.getByLabelText('Search instruments'), { target: { value: text } })
  }

  it('sends the trimmed query with the limit the picker will draw', async () => {
    const { view, injected } = mount()
    await screen.findByText('宁德时代')

    type(view, '  茅台 ')

    await waitFor(() => {
      expect(injected.search).toHaveBeenCalledWith('茅台', 8, expect.anything())
    })
  })

  it('asks nothing while the field is empty, so a cleared box costs no request', async () => {
    const { view, injected } = mount()
    await screen.findByText('宁德时代')

    type(view, '   ')

    await waitFor(() => { expect(view.queryByText('Searching…')).toBeNull() })
    expect(injected.search).not.toHaveBeenCalled()
  })

  it('sends one request for a burst of keystrokes rather than one per key', async () => {
    const { view, injected } = mount()
    await screen.findByText('宁德时代')

    type(view, '6')
    type(view, '60')
    type(view, '600519')

    await waitFor(() => { expect(injected.search).toHaveBeenCalledTimes(1) })
    expect(injected.search).toHaveBeenCalledWith('600519', 8, expect.anything())
  })

  it('lists each match with its identity and an add control', async () => {
    const { view } = mount()
    type(view, '600519')

    expect(await view.findByText('贵州茅台')).toBeTruthy()
    expect(view.getByText('SSE:600519')).toBeTruthy()
    expect(view.getByLabelText('Follow 贵州茅台')).toBeTruthy()
  })

  it('marks a match already on the watchlist instead of offering to add it twice', async () => {
    const search = vi.fn(() => Promise.resolve({
      matches: [{ instrument: CATL, name: '宁德时代', followed: true }],
    }))
    const { view } = mount({ search })
    type(view, '300750')

    expect(await view.findByText('On the watchlist')).toBeTruthy()
    expect(view.queryByLabelText('Follow 宁德时代')).toBeNull()
  })

  it('says nothing matched rather than leaving the picker blank', async () => {
    const search = vi.fn(() => Promise.resolve({ matches: [] }))
    const { view } = mount({ search })
    type(view, 'zzzz')

    expect(await view.findByText('Nothing matched.')).toBeTruthy()
  })

  it('reports a failed lookup without touching the rows below', async () => {
    const search = vi.fn(() => Promise.reject(new Error('offline')))
    const { view } = mount({ search })
    await screen.findByText('宁德时代')
    type(view, '600519')

    expect(await view.findByText('The search failed. Try again.')).toBeTruthy()
    expect(view.getByText('212.30 CNY')).toBeTruthy()
  })
})

describe('following a match', () => {
  it('follows the picked instrument, then reloads and clears the field', async () => {
    const { view, injected } = mount()
    fireEvent.change(view.getByLabelText('Search instruments'), { target: { value: '600519' } })
    const add = await view.findByLabelText('Follow 贵州茅台')

    fireEvent.click(add)

    await waitFor(() => { expect(injected.follow).toHaveBeenCalledWith(MOUTAI) })
    await waitFor(() => { expect(injected.list).toHaveBeenCalledTimes(2) })
    expect((view.getByLabelText('Search instruments') as HTMLInputElement).value).toBe('')
  })

  it('reports a follow the host refused, and keeps the query for another try', async () => {
    const follow = vi.fn(() => Promise.resolve({ ok: false as const, reason: 'unknown-instrument' as const }))
    const { view } = mount({ follow })
    fireEvent.change(view.getByLabelText('Search instruments'), { target: { value: '600519' } })
    fireEvent.click(await view.findByLabelText('Follow 贵州茅台'))

    expect(await view.findByText('Could not follow the name. Try again.')).toBeTruthy()
    expect((view.getByLabelText('Search instruments') as HTMLInputElement).value).toBe('600519')
  })
})

describe('unfollowing from a row', () => {
  it('sends the row instrument and reloads', async () => {
    const { view, injected } = mount()
    await screen.findByText('宁德时代')

    fireEvent.click(view.getByLabelText('Unfollow 宁德时代'))

    await waitFor(() => { expect(injected.unfollow).toHaveBeenCalledWith(CATL) })
    expect(injected.list).toHaveBeenCalledTimes(2)
  })

  it('names the row that failed, since a list of rows has more than one', async () => {
    const unfollow = vi.fn(() => Promise.reject(new Error('offline')))
    const { view } = mount({ unfollow })
    await screen.findByText('宁德时代')

    fireEvent.click(view.getByLabelText('Unfollow 宁德时代'))

    expect(await screen.findByText(/SZSE:300750/)).toBeTruthy()
    expect(screen.getByText(/Could not unfollow/)).toBeTruthy()
  })
})

describe('view-ring registration', () => {
  /** The services the plugin declares, with the Remote namespace stubbed. */
  async function bench() {
    const ctx = new Context()
    await ctx.plugin(SlotRegistry).await()
    const slots = ctx.get('slots') as SlotRegistry
    slots.register({
      name: 'root',
      children: { 'conversation.view': { kind: 'list', scope: 'session' } },
    } as never, () => null)
    ctx.provide('locale', new LocaleRuntime(ctx))
    class RemoteService extends Service {
      constructor(serviceCtx: Context) { super(serviceCtx, 'remote') }
    }
    new RemoteService(ctx)
    const list = vi.fn().mockResolvedValue({ ok: true, value: { rows: [] } })
    ctx.provide('remote.watchlist', { list })
    return { ctx, slots, list }
  }

  it('declares only the services the tab and its Remote contribution use', () => {
    expect(watchlistPlugin.inject).toEqual(['slots', 'locale', 'remote', 'remote.watchlist'])
  })

  it('registers the tab without reading the Remote eagerly', async () => {
    const b = await bench()
    const fiber = b.ctx.plugin({ inject: [...watchlistPlugin.inject], apply: watchlistPlugin.apply })
    await fiber.await()

    const entry = b.slots.entries('conversation.view').find(row => row.options.id === 'watchlist')
    expect(entry?.component).toBe(WatchlistView)
    expect(entry?.options).toMatchObject({ id: 'watchlist', order: 20 })
    expect(entry?.locale).toBe(NS)
    // Registration must not price anything: the tab reads when it mounts.
    expect(b.list).not.toHaveBeenCalled()
  })

  it('removes the tab when its fiber disposes (HMR safety)', async () => {
    const b = await bench()
    const fiber = b.ctx.plugin({ inject: [...watchlistPlugin.inject], apply: watchlistPlugin.apply })
    await fiber.await()

    await fiber.dispose()

    expect(b.slots.entries('conversation.view').map(entry => entry.options.id)).not.toContain('watchlist')
  })
})
