// @vitest-environment jsdom
/**
 * Watchlist tab: the pure row derivations, the view's states over a stubbed
 * Remote face, and the view-ring registration with fiber teardown proving
 * removal (HMR safety).
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
  MARKETS,
  directionOf,
  formatChange,
  formatLast,
  instrumentLabel,
  normalizeSymbol,
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

/** A view over a stubbed Remote face; every call resolves unless overridden. */
function mount(over?: Partial<WatchlistViewInjected>, snapshot: WatchlistSnapshot = { rows: [row()] }) {
  const injected: WatchlistViewInjected = {
    list: vi.fn(() => Promise.resolve(snapshot)),
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

  it('offers every venue the market union declares', () => {
    expect([...MARKETS]).toEqual(['SSE', 'SZSE', 'BSE', 'HKEX', 'NASDAQ', 'NYSE'])
  })

  it('takes whitespace and case out of a typed code, and refuses an empty one', () => {
    expect(normalizeSymbol('  300750 ')).toBe('300750')
    expect(normalizeSymbol('aapl')).toBe('AAPL')
    expect(normalizeSymbol('   ')).toBeNull()
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
    expect(screen.getByText('Enter a venue and a code to follow the first name.')).toBeTruthy()
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

describe('following a name from the form', () => {
  /** Fill the code field and submit, which is the whole add interaction. */
  function submit(view: ReturnType<typeof render>, code: string) {
    fireEvent.change(view.getByLabelText('Code'), { target: { value: code } })
    fireEvent.click(view.getByText('Follow'))
  }

  it('sends the selected venue with the typed code, normalized', async () => {
    const { view, injected } = mount()
    await screen.findByText('宁德时代')

    fireEvent.change(view.getByLabelText('Venue'), { target: { value: 'SSE' } })
    submit(view, ' 600519 ')

    await waitFor(() => {
      expect(injected.follow).toHaveBeenCalledWith({ market: 'SSE', symbol: '600519' })
    })
  })

  it('refuses to submit an empty code rather than asking the host about nothing', async () => {
    const { view, injected } = mount()
    await screen.findByText('宁德时代')

    expect(view.getByText('Follow').hasAttribute('disabled')).toBe(true)
    fireEvent.change(view.getByLabelText('Code'), { target: { value: '   ' } })

    expect(view.getByText('Follow').hasAttribute('disabled')).toBe(true)
    expect(injected.follow).not.toHaveBeenCalled()
  })

  it('names the venue when a typed code is not listed there', async () => {
    const follow = vi.fn(() => Promise.resolve({ ok: false as const, reason: 'unknown-instrument' as const }))
    const { view } = mount({ follow })
    await screen.findByText('宁德时代')

    submit(view, '999999')

    expect(await screen.findByText('That venue does not list this code.')).toBeTruthy()
  })

  it('reloads the list and clears the field after a name is followed', async () => {
    const { view, injected } = mount()
    await screen.findByText('宁德时代')

    submit(view, '600519')

    await waitFor(() => { expect(injected.list).toHaveBeenCalledTimes(2) })
    expect((view.getByLabelText('Code') as HTMLInputElement).value).toBe('')
  })

  it('reports a failed follow separately from an unlisted code', async () => {
    const follow = vi.fn(() => Promise.reject(new Error('offline')))
    const { view } = mount({ follow })
    await screen.findByText('宁德时代')

    submit(view, '600519')

    expect(await screen.findByText('Could not follow the name. Try again.')).toBeTruthy()
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
