// @vitest-environment jsdom
/**
 * Watchlist surfaces: the pure row derivations, the instrument lookup and its
 * debounce, the tab's states over a stubbed Remote face, the name page, the
 * pinned sidebar list, the one store both surfaces read, and the registrations
 * with fiber teardown proving removal (HMR safety).
 */
import { Context, Service } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type { NameDossier, Quote, WatchlistRow, WatchlistSnapshot } from '@deepseek-ai/dsh-api-remotes/client'
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
import { WatchlistRail } from '../src/client/WatchlistRail.tsx'
import { WatchlistFeed } from '../src/client/watchlist-store.ts'
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
    openTheses: 0,
    quote: quote(),
    ...over,
  }
}

const MOUTAI = { market: 'SSE', symbol: '600519' } as const

const bars = [
  { date: '2026-08-12', open: 100, high: 110, low: 95, close: 105, volume: 10 },
  { date: '2026-08-13', open: 105, high: 108, low: 100, close: 102, volume: 12 },
  { date: '2026-08-14', open: 102, high: 120, low: 101, close: 118, volume: 15 },
]

function dossierOf(over?: Partial<NameDossier>): NameDossier {
  return {
    instrument: CATL,
    displayName: '宁德时代',
    firstFollowedAt: '2026-08-14T07:00:00.000Z',
    followed: true,
    quote: quote(),
    bars,
    adjustment: 'none',
    ...over,
  }
}

/** How the host answers `watchlist.list` for one mounted view. */
type ListRead = () => Promise<WatchlistSnapshot>

/**
 * A view over a stubbed Remote face and the real feed. `read` replaces what
 * the rows come from; everything else resolves unless overridden.
 */
function mount(
  over?: Partial<Omit<WatchlistViewInjected, 'rows'>>,
  snapshot: WatchlistSnapshot = { rows: [row()] },
  read?: ListRead,
) {
  const list = vi.fn(read ?? (() => Promise.resolve(snapshot)))
  const feed = new WatchlistFeed(list)
  const injected: WatchlistViewInjected = {
    rows: feed,
    search: vi.fn(() => Promise.resolve({
      matches: [{ instrument: MOUTAI, name: '贵州茅台', followed: false }],
    })),
    dossier: vi.fn(() => Promise.resolve(dossierOf())),
    follow: vi.fn(() => Promise.resolve({ ok: true as const, row: row() })),
    unfollow: vi.fn(() => Promise.resolve()),
    ...over,
  }
  // The view reads the inject face and the locale seat off the full runtime
  // share, so the cast supplies those alone.
  const props = { ...injected, t } as unknown as Parameters<typeof WatchlistView>[0]
  const view = render(<WatchlistView {...props} />)
  return { view, injected, list }
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
    const read = vi.fn<ListRead>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ rows: [row()] })
    const { view } = mount(undefined, undefined, read)

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
    const { view, injected, list } = mount()
    fireEvent.change(view.getByLabelText('Search instruments'), { target: { value: '600519' } })
    const add = await view.findByLabelText('Follow 贵州茅台')

    fireEvent.click(add)

    await waitFor(() => { expect(injected.follow).toHaveBeenCalledWith(MOUTAI) })
    await waitFor(() => { expect(list).toHaveBeenCalledTimes(2) })
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
    const { view, injected, list } = mount()
    await screen.findByText('宁德时代')

    fireEvent.click(view.getByLabelText('Unfollow 宁德时代'))

    await waitFor(() => { expect(injected.unfollow).toHaveBeenCalledWith(CATL) })
    await waitFor(() => { expect(list).toHaveBeenCalledTimes(2) })
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

describe('opening a name', () => {
  /** Click a row's identity, which is the way into the page. */
  async function open(view: ReturnType<typeof render>) {
    fireEvent.click(await view.findByLabelText('Open 宁德时代'))
  }

  it('reads the opened instrument with the range the page draws', async () => {
    const { view, injected } = mount()
    await open(view)

    await waitFor(() => { expect(injected.dossier).toHaveBeenCalledWith(CATL, 60) })
  })

  it('shows the figures, the chart, and when the record started', async () => {
    const { view } = mount()
    await open(view)

    expect(await view.findByText('212.30 CNY')).toBeTruthy()
    expect(view.getByText('+1.10%')).toBeTruthy()
    expect(view.getByRole('img').getAttribute('aria-label')).toContain('3 sessions')
    expect(view.getByText('2026-08-14')).toBeTruthy()
  })

  it('says so when a name has no history rather than drawing an empty frame', async () => {
    const dossier = vi.fn(() => Promise.resolve(dossierOf({ bars: [] })))
    const { view } = mount({ dossier })
    await open(view)

    expect(await view.findByText('No price history available.')).toBeTruthy()
    expect(view.queryByRole('img')).toBeNull()
  })

  it('keeps the page readable when the name cannot be priced', async () => {
    const dossier = vi.fn(() => Promise.resolve(dossierOf({ quote: null, bars: [] })))
    const { view } = mount({ dossier })
    await open(view)

    expect(await view.findByText('No quote')).toBeTruthy()
    expect(view.getByText('Followed since')).toBeTruthy()
  })

  it('reports a failed read without losing the way back', async () => {
    const dossier = vi.fn(() => Promise.reject(new Error('offline')))
    const { view } = mount({ dossier })
    await open(view)

    expect(await view.findByText('This name is temporarily unavailable.')).toBeTruthy()
    expect(view.getByText('← Watchlist')).toBeTruthy()
  })

  it('returns to the list, which is read again on the way back', async () => {
    const { view, list } = mount()
    await open(view)
    fireEvent.click(await view.findByText('← Watchlist'))

    expect(await view.findByLabelText('Open 宁德时代')).toBeTruthy()
    expect(list).toHaveBeenCalled()
  })

  it('unfollows from the page and returns to the list', async () => {
    const { view, injected } = mount()
    await open(view)
    fireEvent.click(await view.findByText('Unfollow'))

    await waitFor(() => { expect(injected.unfollow).toHaveBeenCalledWith(CATL) })
    expect(await view.findByLabelText('Open 宁德时代')).toBeTruthy()
  })
})

describe('the pinned sidebar list', () => {
  /** The rail over the same store seat the tab uses. */
  function mountRail(snapshot: WatchlistSnapshot = { rows: [row()] }) {
    const list = vi.fn(() => Promise.resolve(snapshot))
    const feed = new WatchlistFeed(list)
    const props = { rows: feed, t } as unknown as Parameters<typeof WatchlistRail>[0]
    return { view: render(<WatchlistRail {...props} />), list, feed }
  }

  it('lists each followed name with its price and change', async () => {
    const { view } = mountRail()

    expect(await view.findByText('宁德时代')).toBeTruthy()
    expect(view.getByText('212.3')).toBeTruthy()
    expect(view.getByText('+1.10%').getAttribute('data-direction')).toBe('up')
  })

  it('renders nothing while the record is empty, rather than a heading over a blank', async () => {
    const { view, list } = mountRail({ rows: [] })

    await waitFor(() => { expect(list).toHaveBeenCalled() })
    expect(view.container.textContent).toBe('')
  })

  it('renders nothing when the read fails, since the sidebar has no room to explain', async () => {
    const list = vi.fn(() => Promise.reject(new Error('offline')))
    const feed = new WatchlistFeed(list)
    const props = { rows: feed, t } as unknown as Parameters<typeof WatchlistRail>[0]
    const view = render(<WatchlistRail {...props} />)

    await waitFor(() => { expect(list).toHaveBeenCalled() })
    expect(view.container.textContent).toBe('')
  })

  it('caps the list and says how many it left out, so it cannot squeeze the browser', async () => {
    const many = Array.from({ length: 11 }, (_unused, index) => row({
      instrument: { market: 'SZSE', symbol: `30000${index}` },
      displayName: `名称${index}`,
    }))
    const { view } = mountRail({ rows: many })

    expect(await view.findByText('名称0')).toBeTruthy()
    expect(view.queryByText('名称8')).toBeNull()
    expect(view.getByText('3 more')).toBeTruthy()
  })

  it('marks an unpriceable name rather than showing a blank figure', async () => {
    const { view } = mountRail({ rows: [row({ quote: null })] })

    expect(await view.findByText('No quote')).toBeTruthy()
  })
})

describe('the shared store', () => {
  it('gives both surfaces one answer, so following in the tab moves the sidebar', async () => {
    let rows = [row()]
    const list = vi.fn(() => Promise.resolve({ rows }))
    const feed = new WatchlistFeed(list)
    const railProps = { rows: feed, t } as unknown as Parameters<typeof WatchlistRail>[0]
    const rail = render(<WatchlistRail {...railProps} />)
    expect(await rail.findByText('宁德时代')).toBeTruthy()

    rows = [row(), row({ instrument: MOUTAI, displayName: '贵州茅台' })]
    await feed.refresh()

    expect(await rail.findByText('贵州茅台')).toBeTruthy()
  })

  it('joins a refresh already in flight rather than reading twice', async () => {
    let settle: (value: WatchlistSnapshot) => void = () => {}
    const list = vi.fn(() => new Promise<WatchlistSnapshot>((resolve) => { settle = resolve }))
    const feed = new WatchlistFeed(list)

    const first = feed.refresh()
    const second = feed.refresh()
    settle({ rows: [row()] })
    await Promise.all([first, second])

    expect(list).toHaveBeenCalledTimes(1)
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
      children: {
        'conversation.view': { kind: 'list', scope: 'session' },
        'sidebar.pinned': { kind: 'single', scope: 'root' },
      },
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
    // Registration must not price anything: each surface reads when it mounts.
    expect(b.list).not.toHaveBeenCalled()
  })

  it('registers the pinned sidebar list over the same store as the tab', async () => {
    const b = await bench()
    const fiber = b.ctx.plugin({ inject: [...watchlistPlugin.inject], apply: watchlistPlugin.apply })
    await fiber.await()

    const pinned = b.slots.entries('sidebar.pinned')[0]
    expect(pinned?.component).toBe(WatchlistRail)
    // One feed, so following in the tab moves the sidebar with it.
    const railRows = (pinned?.inject as (() => { rows: unknown }) | undefined)?.().rows
    const tab = b.slots.entries('conversation.view').find(row => row.options.id === 'watchlist')
    const tabRows = (tab?.inject as (() => { rows: unknown }) | undefined)?.().rows
    expect(railRows).toBeDefined()
    expect(railRows).toBe(tabRows)
  })

  it('removes the tab when its fiber disposes (HMR safety)', async () => {
    const b = await bench()
    const fiber = b.ctx.plugin({ inject: [...watchlistPlugin.inject], apply: watchlistPlugin.apply })
    await fiber.await()

    await fiber.dispose()

    expect(b.slots.entries('conversation.view').map(entry => entry.options.id)).not.toContain('watchlist')
    expect(b.slots.entries('sidebar.pinned')).toEqual([])
  })
})
