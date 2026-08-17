// @vitest-environment jsdom
/**
 * The name workbench: the pure row derivations, the names frame with its
 * lookup and selection, the record panel's chain and its writes, the two
 * plugin-owned observables both columns read, and the registrations with
 * fiber teardown proving removal (HMR safety).
 */
import { Context, Service } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type {
  ChainEntry, ChainEntryId, NameDossier, NameRecordView, Quote, WatchlistRow, WatchlistSnapshot,
} from '@deepseek-ai/dsh-api-remotes/client'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import { en, NS } from '../src/client/locales.ts'
import {
  directionOf, formatChange, formatLast, instrumentLabel, normalizeQuery, rowFigures, sameInstrument,
} from '../src/client/watchlist-model.ts'
import { InvestingHero } from '../src/client/InvestingHero.tsx'
import { NamesFrame, type NamesFrameInjected } from '../src/client/NamesFrame.tsx'
import { NameDetails, type NameDetailsInjected } from '../src/client/NameDetails.tsx'
import { RecordPanel } from '../src/client/RecordPanel.tsx'
import { WatchlistFeed } from '../src/client/watchlist-store.ts'
import { WorkbenchFocus } from '../src/client/workbench-store.ts'
import { WorkbenchSessions } from '../src/client/workbench-sessions.ts'
import * as workbench from '../src/client/index.ts'

afterEach(cleanup)

// jsdom implements no ResizeObserver, and the record panel's chart measures its
// container through one. The stub never fires: the chart draws at its assumed
// width until an observation arrives, which is the state under test here.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub)

// English so the assertions read as the copy a user sees.
const t = makeTranslate(en, commonZh)

const CATL = { market: 'SZSE', symbol: '300750' } as const
const MOUTAI = { market: 'SSE', symbol: '600519' } as const

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
    source: { providerId: 'fixture', datasets: ['fixture-table'], retrievedAt: null },
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

function thesis(over?: Partial<Extract<ChainEntry, { kind: 'thesis' }>>): ChainEntry {
  return {
    id: 'entry-1' as ChainEntryId,
    instrument: CATL,
    recordedAt: '2026-06-15T02:00:00.000Z',
    body: '毛利率见底',
    source: { kind: 'manual' },
    kind: 'thesis',
    resolution: 'open',
    ...over,
  }
}

function recordOf(over?: Partial<NameRecordView>): NameRecordView {
  return { stance: null, chain: [], sessions: [], ...over }
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

  it('compares both halves, so one code on two venues stays two names', () => {
    expect(sameInstrument(CATL, { market: 'SZSE', symbol: '300750' })).toBe(true)
    expect(sameInstrument(CATL, { market: 'SSE', symbol: '300750' })).toBe(false)
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

/** The names frame over the real feed and focus, with a stubbed Remote face. */
function mountFrame(
  snapshot: WatchlistSnapshot = { rows: [row()] },
  over?: {
    search?: unknown
    follow?: unknown
    wide?: boolean
    detailsClosed?: boolean
    archivedSessionIds?: readonly string[]
    archiveConversation?: (id: never) => Promise<void>
    activateConversationNavigation?: () => () => void
    openDetails?: () => void
    workbenchEntries?: number
    page?: string | null
  },
) {
  const list = vi.fn(() => Promise.resolve(snapshot))
  const feed = new WatchlistFeed(list)
  const focus = new WorkbenchFocus()
  const search = over?.search ?? vi.fn(() => Promise.resolve({
    matches: [{ instrument: MOUTAI, name: '贵州茅台', followed: false }],
  }))
  const follow = over?.follow ?? vi.fn(() => Promise.resolve({}))
  const open = vi.fn((instrument: typeof CATL, name: string) => { focus.open(instrument, name, []) })
  const openConversation = vi.fn()
  const startConversation = vi.fn()
  const archiveConversation = over?.archiveConversation ?? vi.fn(() => Promise.resolve())
  const activateConversationNavigation = over?.activateConversationNavigation ?? vi.fn(() => () => {})
  const openDetails = over?.openDetails ?? vi.fn()
  const useSessions = (select: (state: unknown) => unknown) => select({
    byId: { 's-1': { displayTitle: '本周储能订单节奏' }, 's-2': { displayTitle: 'Q2 财报速读' } },
    current: 's-2',
  })
  const useWorkspaces = (select: (state: unknown) => unknown) => select({
    archivedSessionIds: over?.archivedSessionIds ?? [],
  })
  const workbenchEntries = over?.workbenchEntries ?? 0
  const workbench = {
    count: () => workbenchEntries,
    subscribe: () => () => {},
    version: () => 0,
  }
  const openPage = vi.fn()
  const closePage = vi.fn()
  // The frame renders its declared holes; a test double states which hole was
  // asked for so the block's presence is observable without a slot runtime.
  const renderSlot = vi.fn((name: string) => <span data-slot={name} />)
  const props = {
    rows: feed, workbench, search, follow, focus, open, openConversation, startConversation,
    archiveConversation, activateConversationNavigation, renderSlot,
    useSessions, useWorkspaces, wide: over?.wide ?? true, detailsClosed: over?.detailsClosed ?? false,
    openDetails, page: over?.page ?? null, openPage, closePage, t,
  } as unknown as Parameters<typeof NamesFrame>[0]
  return {
    view: render(<NamesFrame {...props} />), list, feed, focus, search, follow, open,
    openConversation, startConversation, archiveConversation, openDetails,
    openPage, closePage, renderSlot,
  }
}

describe('the names frame', () => {
  it('lists every followed name with its price and change', async () => {
    const { view } = mountFrame()

    expect(await view.findByText('宁德时代')).toBeTruthy()
    expect(view.getByText('SZSE:300750')).toBeTruthy()
    expect(view.getByText('+1.10%').getAttribute('data-direction')).toBe('up')
  })

  it('marks a name whose thesis is still waiting, which no general agent tracks', async () => {
    const { view } = mountFrame({ rows: [row({ openTheses: 2 })] })

    const mark = await view.findByLabelText('Open theses · 2')
    expect(mark.getAttribute('data-mark')).toBe('unverified')
  })

  it('leaves an unmarked name unmarked rather than drawing an empty badge', async () => {
    const { view } = mountFrame()

    await view.findByText('宁德时代')
    expect(view.queryByLabelText(/waiting to be settled/)).toBeNull()
  })

  it('opens a name through the one call that moves every column', async () => {
    // Setting the focus alone left the record column at zero width and the
    // conversation on whatever session happened to be current.
    const { view, open } = mountFrame()

    fireEvent.click(await view.findByText('宁德时代'))

    expect(open).toHaveBeenCalledWith(CATL, '宁德时代')
  })

  it('marks the open row, and moves the mark when another name opens', async () => {
    const { view, focus } = mountFrame({ rows: [row(), row({ instrument: MOUTAI, displayName: '贵州茅台' })] })
    await view.findByText('宁德时代')

    fireEvent.click(view.getByText('贵州茅台'))

    // The selection is read through the shared focus, so the mark follows it
    // rather than freezing at whatever the registration captured.
    await waitFor(() => {
      expect(view.getByText('贵州茅台').closest('button')?.getAttribute('aria-current')).toBe('true')
    })
    expect(view.getByText('宁德时代').closest('button')?.getAttribute('aria-current')).toBeNull()
    expect(focus.snapshot().instrument).toEqual(MOUTAI)
  })

  it('lists the conversations recorded against the open name, with live titles', async () => {
    const { view, focus } = mountFrame()
    await view.findByText('宁德时代')

    focus.open(CATL, '宁德时代', ['s-1', 's-2'] as never)

    expect(await view.findByText('本周储能订单节奏')).toBeTruthy()
    // The current one is marked, so the column says which conversation is open.
    expect(view.getByText('Q2 财报速读').closest('button')?.getAttribute('data-current')).toBe('true')
  })

  it('lists conversations only under the open name', async () => {
    const { view, focus } = mountFrame({ rows: [row(), row({ instrument: MOUTAI, displayName: '贵州茅台' })] })
    await view.findByText('宁德时代')

    focus.open(MOUTAI, '贵州茅台', ['s-1'] as never)

    await waitFor(() => { expect(view.getByText('本周储能订单节奏')).toBeTruthy() })
    // One list, under the open row — not one per name.
    expect(view.getAllByText('本周储能订单节奏')).toHaveLength(1)
  })

  it('offers a new conversation about the open name', async () => {
    const { view, focus, startConversation } = mountFrame()
    await view.findByText('宁德时代')
    focus.open(CATL, '宁德时代', [])

    fireEvent.click(await view.findByText('New conversation'))

    expect(startConversation).toHaveBeenCalledWith(CATL)
  })

  it('selects one of the listed conversations', async () => {
    const { view, focus, openConversation } = mountFrame()
    await view.findByText('宁德时代')
    focus.open(CATL, '宁德时代', ['s-1'] as never)

    fireEvent.click(await view.findByText('本周储能订单节奏'))

    expect(openConversation).toHaveBeenCalledWith('s-1')
  })

  it('restores the details column without reopening the selected name', async () => {
    const { view, focus, open, openDetails } = mountFrame(undefined, { detailsClosed: true })
    await view.findByText('宁德时代')
    focus.open(CATL, '宁德时代', ['s-1'] as never)

    fireEvent.click(await view.findByLabelText('Expand investing details'))

    expect(openDetails).toHaveBeenCalledTimes(1)
    expect(open).not.toHaveBeenCalled()
  })

  it('offers no details recovery action before a name is selected or while details are open', async () => {
    const closed = mountFrame(undefined, { detailsClosed: true })
    await closed.view.findByText('宁德时代')
    expect(closed.view.queryByLabelText('Expand investing details')).toBeNull()

    const open = mountFrame()
    await open.view.findByText('宁德时代')
    open.focus.open(CATL, '宁德时代')
    expect(open.view.queryByLabelText('Expand investing details')).toBeNull()
  })

  it('keeps the details recovery action on the collapsed navigation rail', async () => {
    const { view, focus, openDetails } = mountFrame(undefined, { wide: false, detailsClosed: true })
    focus.open(CATL, '宁德时代')

    fireEvent.click(await view.findByLabelText('Expand investing details'))

    expect(openDetails).toHaveBeenCalledTimes(1)
  })

  it('confirms deletion with its retained-log semantics before archiving a conversation', async () => {
    const archiveConversation = vi.fn(() => Promise.resolve())
    const { view, focus } = mountFrame(undefined, { archiveConversation })
    await view.findByText('宁德时代')
    focus.open(CATL, '宁德时代', ['s-1'] as never)

    fireEvent.click(await view.findByLabelText('Delete conversation “本周储能订单节奏”'))

    expect(view.getByRole('dialog', { name: 'Delete conversation record?' }).textContent).toContain(
      'does not permanently delete logs',
    )
    fireEvent.click(view.getByRole('button', { name: 'Delete conversation record' }))
    await waitFor(() => { expect(archiveConversation).toHaveBeenCalledWith('s-1') })
  })

  it('keeps an archive failure visible for retry', async () => {
    const archiveConversation = vi.fn(() => Promise.reject(new Error('offline')))
    const { view, focus } = mountFrame(undefined, { archiveConversation })
    await view.findByText('宁德时代')
    focus.open(CATL, '宁德时代', ['s-1'] as never)

    fireEvent.click(await view.findByLabelText('Delete conversation “本周储能订单节奏”'))
    fireEvent.click(view.getByRole('button', { name: 'Delete conversation record' }))

    expect((await view.findByRole('alert')).textContent).toContain('Could not delete the conversation')
    expect(view.getByText('本周储能订单节奏')).toBeTruthy()
  })

  it('hides archived conversations and excludes them from the related count', async () => {
    const { view, focus } = mountFrame(undefined, { archivedSessionIds: ['s-1'] })
    await view.findByText('宁德时代')
    focus.open(CATL, '宁德时代', ['s-1', 's-2'] as never)

    await view.findByText('Q2 财报速读')
    expect(view.queryByText('本周储能订单节奏')).toBeNull()
    expect(view.getByText('Related conversations').nextElementSibling?.textContent).toBe('1')
  })

  it('says how to start when nothing is followed', async () => {
    const { view } = mountFrame({ rows: [] })

    expect(await view.findByText('The watchlist is empty.')).toBeTruthy()
  })

  it('renders nothing on the rail, where a name beside a price does not fit', () => {
    const { view } = mountFrame(undefined, { wide: false })

    expect(view.container.textContent).toBe('')
  })

  it('draws no workbench block while nothing has registered into it', () => {
    // A heading over an empty block is chrome explaining an absence.
    const { view, renderSlot } = mountFrame()

    expect(view.queryByText('Workbench')).toBeNull()
    expect(renderSlot.mock.calls.some(call => call[0] === 'investing.workbench.section')).toBe(false)
  })

  it('leads with the workbench block once something occupies it', () => {
    const { view, renderSlot } = mountFrame(undefined, { workbenchEntries: 1 })

    expect(view.getByRole('region', { name: 'Workbench' })).toBeTruthy()
    expect(renderSlot).toHaveBeenCalledWith(
      'investing.workbench.section',
      expect.objectContaining({ wide: true, page: null }),
    )
  })

  it('keeps workbench entries reachable from the collapsed rail', () => {
    // What runs unattended must stay reachable when the column is 56px; a
    // name beside a price is what does not fit, not an icon.
    const { view, renderSlot } = mountFrame(undefined, { wide: false, workbenchEntries: 1 })

    expect(renderSlot).toHaveBeenCalledWith(
      'investing.workbench.section',
      expect.objectContaining({ wide: false }),
    )
    expect(view.container.firstChild).toBeTruthy()
  })

  it('offers each row to the mark slot with the name that row is about', async () => {
    const { view, renderSlot } = mountFrame()
    await view.findByText('宁德时代')

    expect(renderSlot).toHaveBeenCalledWith(
      'investing.name.mark',
      expect.objectContaining({ instrument: CATL, displayName: '宁德时代' }),
    )
  })

  it('keeps the lookup with the names it searches, below their heading', () => {
    // The search finds a name; it belongs to the followed list rather than to
    // the column, so the workbench block above it is not separated from it.
    const { view } = mountFrame(undefined, { workbenchEntries: 1 })
    const heading = view.getByRole('heading', { name: 'Watchlist' })
    const field = view.getByLabelText('Search instruments')
    const workbench = view.getByRole('region', { name: 'Workbench' })

    expect(workbench.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(heading.compareDocumentPosition(field) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('keeps the unpriceable name on the list', async () => {
    const { view } = mountFrame({ rows: [row({ quote: null })] })

    expect(await view.findByText('No quote')).toBeTruthy()
  })
})

describe('the names frame lookup', () => {
  function type(view: ReturnType<typeof render>, text: string) {
    fireEvent.change(view.getByLabelText('Search instruments'), { target: { value: text } })
  }

  it('sends the trimmed query with the limit the picker draws', async () => {
    const { view, search } = mountFrame()
    type(view, '  茅台 ')

    await waitFor(() => {
      expect(search).toHaveBeenCalledWith('茅台', 8, expect.anything())
    })
  })

  it('asks nothing for an empty field', async () => {
    const { view, search } = mountFrame()
    type(view, '   ')

    await waitFor(() => { expect(view.queryByText('贵州茅台')).toBeNull() })
    expect(search).not.toHaveBeenCalled()
  })

  it('opens an unfollowed match without following it first', async () => {
    const { view, open, follow } = mountFrame()
    type(view, '600519')

    fireEvent.click(await view.findByLabelText('Open 贵州茅台'))

    expect(open).toHaveBeenCalledWith(MOUTAI, '贵州茅台')
    expect(follow).not.toHaveBeenCalled()
  })

  it('follows a match on request, and reloads the list', async () => {
    const { view, follow, list } = mountFrame()
    type(view, '600519')

    fireEvent.click(await view.findByLabelText('Follow 贵州茅台'))

    await waitFor(() => { expect(follow).toHaveBeenCalledWith(MOUTAI) })
    await waitFor(() => { expect(list).toHaveBeenCalledTimes(2) })
  })

  it('marks a match already followed instead of offering to add it twice', async () => {
    const search = vi.fn(() => Promise.resolve({
      matches: [{ instrument: CATL, name: '宁德时代', followed: true }],
    }))
    const { view } = mountFrame(undefined, { search })
    type(view, '300750')

    expect(await view.findByText('On the watchlist')).toBeTruthy()
    expect(view.queryByLabelText('Follow 宁德时代')).toBeNull()
  })
})

/** The record panel over a focus already pointed at a name. */
function mountPanel(record: NameRecordView = recordOf(), over?: {
  dossier?: unknown
  append?: unknown
  setStance?: unknown
  focused?: boolean
  sessionCount?: number
}) {
  const focus = new WorkbenchFocus()
  if (over?.focused !== false) focus.open(CATL, '宁德时代')
  const read = vi.fn(() => Promise.resolve(record))
  const dossier = over?.dossier ?? vi.fn(() => Promise.resolve(dossierOf()))
  const append = over?.append ?? vi.fn(() => Promise.resolve(thesis()))
  const setStance = over?.setStance ?? vi.fn(() => Promise.resolve({}))
  const renderSlot = vi.fn((name: string) => <span data-slot={name} />)
  const props = {
    focus, read, dossier, append, setStance, renderSlot,
    sessionCount: over?.sessionCount ?? record.sessions.length, t,
  } as unknown as Parameters<typeof RecordPanel>[0]
  return {
    view: render(<RecordPanel {...props} />), focus, read, dossier, append, setStance, renderSlot,
  }
}

describe('the record panel', () => {
  it('asks for a name before it shows one', () => {
    const { view } = mountPanel(undefined, { focused: false })

    expect(view.getByText('Pick a name on the left.')).toBeTruthy()
  })

  it('shows the open name’s figures and chart', async () => {
    const { view } = mountPanel()

    expect(await view.findByText('212.30 CNY')).toBeTruthy()
    expect(view.getByRole('img').getAttribute('aria-label')).toContain('3 sessions')
  })

  it('reads the record and the figures for the open name', async () => {
    const { view, read, dossier } = mountPanel()

    await view.findByText('Investment rationale and record')
    expect(read).toHaveBeenCalledWith(CATL)
    expect(dossier).toHaveBeenCalledWith(CATL, 60)
  })

  it('counts only conversations still visible after archiving', async () => {
    const { view } = mountPanel(recordOf({ sessions: ['s-1', 's-2'] as never }), { sessionCount: 1 })

    await view.findByText('Investment rationale and record')
    expect(view.getByText('Chats').nextElementSibling?.textContent).toBe('1')
  })

  it('says what the empty chain is for rather than showing nothing', async () => {
    const { view } = mountPanel()

    expect(await view.findByText(/A thesis written here comes back to be settled/)).toBeTruthy()
  })

  it('lists an entry with its date, kind, and provenance', async () => {
    const { view } = mountPanel(recordOf({ chain: [thesis()] }))

    expect(await view.findByText('毛利率见底')).toBeTruthy()
    expect(view.getByText('2026-06-15')).toBeTruthy()
    expect(view.getByText('Written by hand')).toBeTruthy()
  })

  it('shows the calibration figure on a verification, which is the point of the chain', async () => {
    const verification: ChainEntry = {
      id: 'entry-2' as ChainEntryId,
      instrument: CATL,
      recordedAt: '2026-07-20T02:00:00.000Z',
      body: 'Q2 毛利率环比 +1.7pct',
      source: { kind: 'manual' },
      kind: 'verification',
      settles: 'entry-1' as ChainEntryId,
      verdict: 'confirmed',
      elapsedDays: 35,
    }
    const { view } = mountPanel(recordOf({ chain: [verification] }))

    expect(await view.findByText('Settled after 35 days')).toBeTruthy()
  })

  it('links an extracted entry back to the turn that produced it', async () => {
    const fromChat = thesis({ source: { kind: 'session', sessionId: 'sess-1' as never, turn: 4 } })
    const { view } = mountPanel(recordOf({ chain: [fromChat] }))

    expect(await view.findByText('From turn 4 of a conversation')).toBeTruthy()
  })

  it('offers to settle an open thesis, and only an open one', async () => {
    const settled = thesis({ id: 'entry-9' as ChainEntryId, resolution: 'confirmed', body: '已结清' })
    const { view } = mountPanel(recordOf({ chain: [thesis(), settled] }))

    await view.findByText('毛利率见底')
    expect(view.getAllByText('Mark confirmed')).toHaveLength(1)
    expect(view.getByText('Confirmed')).toBeTruthy()
  })

  it('settles a thesis through a verification carrying the verdict', async () => {
    const append = vi.fn(() => Promise.resolve(thesis()))
    const { view } = mountPanel(recordOf({ chain: [thesis()] }), { append })

    fireEvent.click(await view.findByText('Mark refuted'))

    await waitFor(() => {
      expect(append).toHaveBeenCalledWith(CATL, expect.objectContaining({
        kind: 'verification', settles: 'entry-1', verdict: 'refuted',
      }))
    })
  })

  it('records a hand-written entry of the picked kind', async () => {
    const append = vi.fn(() => Promise.resolve(thesis()))
    const { view } = mountPanel(recordOf(), { append })
    await view.findByText('Investment rationale and record')

    fireEvent.click(view.getByText('Decision'))
    fireEvent.change(view.getByLabelText(/Record a thesis/), { target: { value: ' 减仓至 4% ' } })
    fireEvent.click(view.getByText('Record'))

    await waitFor(() => {
      expect(append).toHaveBeenCalledWith(CATL, {
        kind: 'decision', body: '减仓至 4%', source: { kind: 'manual' },
      })
    })
  })

  it('refuses to record an empty entry', async () => {
    const append = vi.fn(() => Promise.resolve(thesis()))
    const { view } = mountPanel(recordOf(), { append })
    await view.findByText('Investment rationale and record')

    fireEvent.change(view.getByLabelText(/Record a thesis/), { target: { value: '   ' } })

    expect(view.getByText('Record').hasAttribute('disabled')).toBe(true)
    expect(append).not.toHaveBeenCalled()
  })

  it('keeps the record readable when the figures cannot be read', async () => {
    const dossier = vi.fn(() => Promise.reject(new Error('offline')))
    const { view } = mountPanel(recordOf({ chain: [thesis()] }), { dossier })

    expect(await view.findByText('毛利率见底')).toBeTruthy()
    expect(view.getByText('No quote')).toBeTruthy()
  })

  it('reports a failed record read', async () => {
    const focus = new WorkbenchFocus()
    focus.open(CATL, '宁德时代')
    const props = {
      focus,
      read: vi.fn(() => Promise.reject(new Error('offline'))),
      dossier: vi.fn(() => Promise.resolve(dossierOf())),
      append: vi.fn(),
      sessionCount: 0,
      t,
    } as unknown as Parameters<typeof RecordPanel>[0]
    const view = render(<RecordPanel {...props} />)

    expect(await view.findByRole('alert')).toBeTruthy()
  })
})

describe('the shared selection', () => {
  it('moves both columns from one open call', () => {
    const focus = new WorkbenchFocus()
    const seen: unknown[] = []
    focus.subscribe(() => { seen.push(focus.snapshot()) })

    focus.open(CATL, '宁德时代', [])
    focus.open(MOUTAI, '贵州茅台', ['s-1'] as never)

    expect(seen).toHaveLength(2)
    expect(focus.snapshot()).toEqual({
      instrument: MOUTAI,
      displayName: '贵州茅台',
      sessions: ['s-1'],
      sessionStatus: 'ready',
    })
  })

  it('ignores a conversation list before any name is selected', () => {
    const focus = new WorkbenchFocus()
    const initial = focus.snapshot()

    focus.setSessions(['s-orphan'] as never)

    expect(focus.snapshot()).toBe(initial)
  })

  it('clears the selected name with its conversation state', () => {
    const focus = new WorkbenchFocus()
    focus.open(CATL, '宁德时代', ['s-1'] as never)

    focus.clear()

    expect(focus.snapshot()).toEqual({
      instrument: null,
      displayName: null,
      sessions: [],
      sessionStatus: 'pending',
    })
  })
})

describe('the centre column', () => {
  /** A session list the test drives, plus the controller over it. */
  function bench(
    bound: readonly string[] = [],
    archivedSessionIds: readonly string[] = [],
    archivesReady = true,
  ) {
    let state = { byId: {} as Record<string, { blank: boolean } | undefined>, current: undefined as string | undefined }
    const listeners = new Set<() => void>()
    const publish = (next: typeof state) => {
      state = next
      for (const listener of listeners) listener()
    }
    const sessions = {
      list: {
        getSnapshot: () => state,
        subscribe: (fn: () => void) => {
          listeners.add(fn)
          return () => listeners.delete(fn)
        },
      },
      open: vi.fn(),
      startAt: vi.fn(() => Promise.resolve('s-new')),
    }
    const read = vi.fn(() => Promise.resolve({ sessions: bound }))
    const bind = vi.fn((_i: unknown, id: string) => Promise.resolve([...bound, id]))
    const archive = vi.fn(() => Promise.resolve({ path: '/archive' }))
    const focus = new WorkbenchFocus()
    const onFocusCleared = vi.fn()
    let archiveState: {
      archivedSessionIds: readonly string[]
      phase: 'pending' | 'ready'
      state: 'idle' | 'loading' | 'error'
    } = {
      archivedSessionIds,
      phase: archivesReady ? 'ready' : 'pending',
      state: archivesReady ? 'idle' : 'loading',
    }
    const archiveListeners = new Set<() => void>()
    const publishArchives = (
      ids: readonly string[],
      phase: 'pending' | 'ready' = 'ready',
      state: 'idle' | 'loading' | 'error' = 'idle',
    ): void => {
      archiveState = { archivedSessionIds: ids, phase, state }
      for (const listener of archiveListeners) listener()
    }
    const controller = new WorkbenchSessions(
      sessions as never,
      { read, bind, archive } as never,
      focus,
      {
        getSnapshot: () => archiveState,
        subscribe: (fn: () => void) => {
          archiveListeners.add(fn)
          return () => archiveListeners.delete(fn)
        },
      } as never,
      onFocusCleared,
    )
    const deactivate = controller.activate()
    return {
      controller,
      sessions,
      read,
      bind,
      archive,
      focus,
      publish,
      publishArchives,
      archiveListenerCount: () => archiveListeners.size,
      sessionListenerCount: () => listeners.size,
      onFocusCleared,
      deactivate,
    }
  }

  it('navigates to the name\u2019s newest conversation', async () => {
    const b = bench(['s-1', 's-2'])

    await b.controller.open(CATL, '宁德时代')

    expect(b.sessions.open).toHaveBeenCalledWith('s-2')
    expect(b.sessions.startAt).not.toHaveBeenCalled()
    expect(b.focus.snapshot()).toMatchObject({
      instrument: CATL, sessions: ['s-1', 's-2'], sessionStatus: 'ready',
    })
  })

  it('skips an archived newest conversation while retaining the name record', async () => {
    const b = bench(['s-1', 's-2'], ['s-2'])

    await b.controller.open(CATL, '宁德时代')

    expect(b.sessions.open).toHaveBeenCalledWith('s-1')
    expect(b.focus.snapshot().sessions).toEqual(['s-1', 's-2'])
  })

  it('creates a replacement when all bound conversations are archived', async () => {
    const b = bench(['s-1'], ['s-1'])

    await b.controller.open(CATL, '宁德时代')

    expect(b.sessions.open).toHaveBeenCalledWith('s-new')
    expect(b.bind).toHaveBeenCalledWith(CATL, 's-new')
    expect(b.focus.snapshot().sessions).toEqual(['s-1', 's-new'])
  })

  it('waits for the archive baseline before selecting a bound conversation', async () => {
    const b = bench(['s-1'], [], false)

    const opening = b.controller.open(CATL, '宁德时代')
    await waitFor(() => { expect(b.read).toHaveBeenCalledWith(CATL) })
    expect(b.sessions.open).not.toHaveBeenCalled()

    b.publishArchives(['s-1'])
    await opening

    expect(b.sessions.open).toHaveBeenCalledWith('s-new')
    expect(b.focus.snapshot().sessions).toEqual(['s-1', 's-new'])
  })

  it('leaves navigation retryable when the archive baseline fails', async () => {
    const b = bench(['s-1'], [], false)

    const opening = b.controller.open(CATL, '宁德时代')
    b.publishArchives([], 'pending', 'error')
    await opening

    expect(b.sessions.open).not.toHaveBeenCalled()
    expect(b.focus.snapshot().sessionStatus).toBe('failed')
  })

  it('publishes the name before the read, so the other columns move on the click', async () => {
    const b = bench(['s-1'])
    const seen: Array<{ instrument: unknown; sessionStatus: string }> = []
    b.focus.subscribe(() => {
      const { instrument, sessionStatus } = b.focus.snapshot()
      seen.push({ instrument, sessionStatus })
    })

    await b.controller.open(CATL, '宁德时代')

    // First publish carries the name with no conversations yet.
    expect(seen[0]).toEqual({ instrument: CATL, sessionStatus: 'pending' })
    expect(seen[1]).toEqual({ instrument: CATL, sessionStatus: 'ready' })
    expect(seen).toHaveLength(2)
  })

  it('keeps the latest name when an earlier record read finishes last', async () => {
    const b = bench()
    const first = Promise.withResolvers<{ sessions: readonly string[] }>()
    const second = Promise.withResolvers<{ sessions: readonly string[] }>()
    b.read.mockReset()
    b.read.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)

    const openingFirst = b.controller.open(CATL, '宁德时代')
    const openingSecond = b.controller.open(MOUTAI, '贵州茅台')
    expect(b.focus.snapshot()).toMatchObject({ instrument: MOUTAI, sessionStatus: 'pending' })

    second.resolve({ sessions: ['s-moutai'] })
    await openingSecond
    first.resolve({ sessions: ['s-catl'] })
    await openingFirst

    expect(b.sessions.open.mock.calls).toEqual([['s-moutai']])
    expect(b.focus.snapshot()).toMatchObject({
      instrument: MOUTAI,
      displayName: '贵州茅台',
      sessions: ['s-moutai'],
      sessionStatus: 'ready',
    })
  })

  it('still attempts to bind a created conversation after a later name wins, without surfacing a stale failure', async () => {
    const b = bench()
    const created = Promise.withResolvers<string>()
    b.sessions.startAt.mockReturnValueOnce(created.promise)

    const openingFirst = b.controller.open(CATL, '宁德时代')
    await waitFor(() => { expect(b.sessions.startAt).toHaveBeenCalledTimes(1) })
    b.read.mockResolvedValueOnce({ sessions: ['s-moutai'] })
    const openingSecond = b.controller.open(MOUTAI, '贵州茅台')
    await openingSecond

    b.bind.mockRejectedValueOnce(new Error('offline'))
    created.resolve('s-catl')
    await openingFirst

    expect(b.bind).toHaveBeenCalledWith(CATL, 's-catl')
    expect(b.sessions.open.mock.calls).toEqual([['s-moutai']])
    expect(b.focus.snapshot()).toMatchObject({
      instrument: MOUTAI, sessions: ['s-moutai'], sessionStatus: 'ready',
    })
  })

  it('does not create after an archive lookup returns to a superseded navigation', async () => {
    const b = bench()
    const archive = Promise.withResolvers<{ path: string }>()
    b.archive.mockReturnValueOnce(archive.promise)

    const openingFirst = b.controller.open(CATL, '宁德时代')
    await waitFor(() => { expect(b.archive).toHaveBeenCalledTimes(1) })
    b.read.mockResolvedValueOnce({ sessions: ['s-moutai'] })
    const openingSecond = b.controller.open(MOUTAI, '贵州茅台')
    await openingSecond

    archive.resolve({ path: '/archive' })
    await openingFirst

    expect(b.sessions.startAt).not.toHaveBeenCalled()
    expect(b.focus.snapshot()).toMatchObject({
      instrument: MOUTAI, sessions: ['s-moutai'], sessionStatus: 'ready',
    })
  })

  it('does not select after a binding returns to a superseded navigation', async () => {
    const b = bench()
    const binding = Promise.withResolvers<string[]>()
    b.bind.mockReturnValueOnce(binding.promise)

    const openingFirst = b.controller.open(CATL, '宁德时代')
    await waitFor(() => { expect(b.bind).toHaveBeenCalledWith(CATL, 's-new') })
    b.read.mockResolvedValueOnce({ sessions: ['s-moutai'] })
    const openingSecond = b.controller.open(MOUTAI, '贵州茅台')
    await openingSecond

    binding.resolve(['s-new'])
    await openingFirst

    expect(b.sessions.open.mock.calls).toEqual([['s-moutai']])
    expect(b.focus.snapshot()).toMatchObject({
      instrument: MOUTAI, sessions: ['s-moutai'], sessionStatus: 'ready',
    })
  })

  it('does not open a newly bound conversation archived while its binding was in flight', async () => {
    const b = bench()
    const binding = Promise.withResolvers<string[]>()
    b.bind.mockReturnValueOnce(binding.promise)

    const opening = b.controller.open(CATL, '宁德时代')
    await waitFor(() => { expect(b.bind).toHaveBeenCalledWith(CATL, 's-new') })
    b.publishArchives(['s-new'])
    binding.resolve(['s-new'])
    await opening

    expect(b.sessions.open).not.toHaveBeenCalled()
    expect(b.focus.snapshot().sessionStatus).toBe('failed')
  })

  it('does not publish a created session after selection synchronously starts newer navigation', async () => {
    const b = bench()
    let openingSecond: Promise<void> | undefined
    b.sessions.open.mockImplementationOnce(() => {
      b.read.mockResolvedValueOnce({ sessions: ['s-moutai'] })
      openingSecond = b.controller.open(MOUTAI, '贵州茅台')
    })

    await b.controller.open(CATL, '宁德时代')
    if (openingSecond === undefined) throw new Error('selection did not start the newer navigation')
    await openingSecond

    expect(b.sessions.open.mock.calls).toEqual([['s-new'], ['s-moutai']])
    expect(b.focus.snapshot()).toMatchObject({
      instrument: MOUTAI, sessions: ['s-moutai'], sessionStatus: 'ready',
    })
  })

  it('carries the name the clicked surface drew, so the opening can say it', async () => {
    const b = bench(['s-1'])

    await b.controller.open(CATL, '宁德时代')

    expect(b.focus.snapshot().displayName).toBe('宁德时代')
  })

  it('opens a conversation at the archive for a name with none, bound before anything is said', async () => {
    const b = bench([])

    await b.controller.open(CATL, '宁德时代')

    // At the archive directory, belonging to no workspace: under a name, the
    // workspace picker would stand between the reader and their first word.
    expect(b.sessions.startAt).toHaveBeenCalledWith('/archive')
    expect(b.sessions.open).toHaveBeenCalledWith('s-new')
    // Bound at creation, not on the first turn: an unbound conversation is
    // one the next name opened can claim.
    expect(b.bind).toHaveBeenCalledWith(CATL, 's-new')
    expect(b.bind.mock.invocationCallOrder[0]).toBeLessThan(b.sessions.open.mock.invocationCallOrder[0] as number)
    expect(b.focus.snapshot().sessions).toEqual(['s-new'])
  })

  it('never lets one conversation belong to two names', async () => {
    const b = bench([])

    await b.controller.open(CATL, '宁德时代')
    b.read.mockResolvedValueOnce({ sessions: [] })
    b.sessions.startAt.mockResolvedValueOnce('s-second')
    await b.controller.open(MOUTAI, '贵州茅台')

    // The second name gets its own conversation. Sharing one blank
    // conversation is how a question about one stock lands under another.
    expect(b.bind.mock.calls).toEqual([[CATL, 's-new'], [MOUTAI, 's-second']])
  })

  it('shows an existing conversation of the open name', async () => {
    const b = bench(['s-1'])

    b.controller.show('s-1' as never)

    expect(b.sessions.open).toHaveBeenCalledWith('s-1')
    expect(b.sessions.startAt).not.toHaveBeenCalled()
  })

  it('does not reopen an archived conversation from a stale surface', () => {
    const b = bench(['s-1'], ['s-1'])
    b.focus.open(CATL, '宁德时代', ['s-1'] as never)

    b.controller.show('s-1' as never)

    expect(b.sessions.open).not.toHaveBeenCalled()
    expect(b.focus.snapshot().sessionStatus).toBe('ready')
  })

  it('marks an existing-conversation selection failure for retry', () => {
    const b = bench(['s-1'])
    b.focus.open(CATL, '宁德时代', ['s-1'] as never)
    b.sessions.open.mockImplementationOnce(() => { throw new Error('offline') })

    b.controller.show('s-1' as never)

    expect(b.focus.snapshot().sessionStatus).toBe('failed')
  })

  it('ignores a new-conversation request without the matching open name', async () => {
    const b = bench()

    await b.controller.start(CATL)
    b.focus.open(CATL, '宁德时代')
    await b.controller.start(MOUTAI)

    expect(b.archive).not.toHaveBeenCalled()
    expect(b.sessions.startAt).not.toHaveBeenCalled()
  })

  it('starts and readies a first conversation when the open name has none', async () => {
    const b = bench()
    b.focus.open(CATL, '宁德时代')

    await b.controller.start(CATL)

    expect(b.sessions.open).toHaveBeenCalledWith('s-new')
    expect(b.focus.snapshot()).toMatchObject({ sessions: ['s-new'], sessionStatus: 'ready' })
  })

  it('starts a further conversation about the open name, and binds that one too', async () => {
    const b = bench(['s-1'])
    await b.controller.open(CATL, '宁德时代')
    b.publish({ byId: { 's-1': { blank: false } }, current: 's-1' })

    await b.controller.start(CATL)

    expect(b.sessions.startAt).toHaveBeenCalledWith('/archive')
    expect(b.bind).toHaveBeenCalledWith(CATL, 's-new')
  })

  it('returns to the name\u2019s own blank conversation instead of adding a second', async () => {
    const b = bench(['s-1'])
    await b.controller.open(CATL, '宁德时代')
    b.publish({ byId: { 's-1': { blank: true } }, current: 's-1' })

    await b.controller.start(CATL)

    expect(b.sessions.startAt).not.toHaveBeenCalled()
    expect(b.sessions.open).toHaveBeenLastCalledWith('s-1')
    expect(b.focus.snapshot().sessionStatus).toBe('ready')
  })

  it('does not reuse an archived blank conversation', async () => {
    const b = bench(['s-1'], ['s-1'])
    b.focus.open(CATL, '宁德时代', ['s-1'] as never)
    b.publish({ byId: { 's-1': { blank: true } }, current: undefined })

    await b.controller.start(CATL)

    expect(b.sessions.open).toHaveBeenCalledWith('s-new')
    expect(b.sessions.startAt).toHaveBeenCalledWith('/archive')
  })

  it('selects the newest remaining conversation after archiving the current one', async () => {
    const b = bench(['s-1', 's-2'])
    b.focus.open(CATL, '宁德时代', ['s-1', 's-2'] as never)
    b.publish({ byId: {}, current: 's-2' })

    const result = await b.controller.archive('s-2' as never, async () => {
      b.publishArchives(['s-2'])
      b.publish({ byId: {}, current: undefined })
    })

    expect(result).toBe('selected')
    expect(b.sessions.open).toHaveBeenCalledWith('s-1')
    expect(b.focus.snapshot()).toMatchObject({
      instrument: CATL,
      sessions: ['s-1', 's-2'],
      sessionStatus: 'ready',
    })
  })

  it('selects the newest remaining conversation after a global archive clears the current one', async () => {
    const b = bench(['s-1', 's-2'])
    await b.controller.open(CATL, '宁德时代')
    b.publish({ byId: {}, current: 's-2' })
    b.sessions.open.mockClear()

    // WorkspaceRuntime clears the Session before publishing the archive set
    // from the same projection; reconciliation therefore runs in a microtask.
    b.publish({ byId: {}, current: undefined })
    b.publishArchives(['s-2'])

    await waitFor(() => { expect(b.sessions.open).toHaveBeenCalledWith('s-1') })
    expect(b.focus.snapshot()).toMatchObject({
      instrument: CATL,
      sessions: ['s-1', 's-2'],
      sessionStatus: 'ready',
    })
    expect(b.onFocusCleared).not.toHaveBeenCalled()
  })

  it('keeps a retryable selection failure after archiving the current conversation', async () => {
    const b = bench(['s-1', 's-2'])
    b.focus.open(CATL, '宁德时代', ['s-1', 's-2'] as never)
    b.publish({ byId: {}, current: 's-2' })
    b.sessions.open.mockImplementationOnce(() => { throw new Error('offline') })

    const result = await b.controller.archive('s-2' as never, async () => {
      b.publishArchives(['s-2'])
      b.publish({ byId: {}, current: undefined })
    })

    expect(result).toBe('unchanged')
    expect(b.focus.snapshot()).toMatchObject({
      instrument: CATL,
      sessionStatus: 'failed',
    })
  })

  it('preserves navigation started while selecting after an archive', async () => {
    const b = bench(['s-1', 's-2'])
    b.focus.open(CATL, '宁德时代', ['s-1', 's-2'] as never)
    b.publish({ byId: {}, current: 's-2' })
    let openingSecond: Promise<void> | undefined
    b.sessions.open.mockImplementationOnce(() => {
      b.read.mockResolvedValueOnce({ sessions: ['s-moutai'] })
      openingSecond = b.controller.open(MOUTAI, '贵州茅台')
    })

    const result = await b.controller.archive('s-2' as never, async () => {
      b.publishArchives(['s-2'])
      b.publish({ byId: {}, current: undefined })
    })
    if (openingSecond === undefined) throw new Error('selection did not start the newer navigation')
    await openingSecond

    expect(result).toBe('unchanged')
    expect(b.focus.snapshot()).toMatchObject({
      instrument: MOUTAI,
      sessions: ['s-moutai'],
      sessionStatus: 'ready',
    })
  })

  it('clears the name after archiving its last current conversation', async () => {
    const b = bench(['s-1'])
    b.focus.open(CATL, '宁德时代', ['s-1'] as never)
    b.publish({ byId: {}, current: 's-1' })

    const result = await b.controller.archive('s-1' as never, async () => {
      b.publishArchives(['s-1'])
      b.publish({ byId: {}, current: undefined })
    })

    expect(result).toBe('cleared')
    expect(b.sessions.open).not.toHaveBeenCalled()
    expect(b.focus.snapshot().instrument).toBeNull()
  })

  it('clears the name and details after a global archive removes its current conversation', async () => {
    const b = bench(['s-1'])
    await b.controller.open(CATL, '宁德时代')
    b.publish({ byId: {}, current: 's-1' })
    b.sessions.open.mockClear()

    b.publish({ byId: {}, current: undefined })
    b.publishArchives(['s-1'])

    await waitFor(() => { expect(b.focus.snapshot().instrument).toBeNull() })
    expect(b.sessions.open).not.toHaveBeenCalled()
    expect(b.onFocusCleared).toHaveBeenCalledTimes(1)
  })

  it('does not reclaim an explicit unarchived current-session clear', async () => {
    const b = bench(['s-1'])
    await b.controller.open(CATL, '宁德时代')
    b.publish({ byId: {}, current: 's-1' })
    b.sessions.open.mockClear()

    b.publish({ byId: {}, current: undefined })
    await Promise.resolve()
    b.publishArchives(['s-1'])
    await Promise.resolve()

    expect(b.sessions.open).not.toHaveBeenCalled()
    expect(b.focus.snapshot().instrument).toEqual(CATL)
    expect(b.onFocusCleared).not.toHaveBeenCalled()
  })

  it('defers archive reconciliation while another frame is active', async () => {
    const b = bench(['s-1', 's-2'])
    await b.controller.open(CATL, '宁德时代')
    b.publish({ byId: {}, current: 's-2' })
    b.sessions.open.mockClear()
    b.deactivate()

    b.publish({ byId: {}, current: undefined })
    b.publishArchives(['s-2'])
    await Promise.resolve()

    expect(b.sessions.open).not.toHaveBeenCalled()
    expect(b.focus.snapshot().instrument).toEqual(CATL)

    b.controller.activate()

    expect(b.sessions.open).toHaveBeenCalledWith('s-1')
    expect(b.focus.snapshot().sessionStatus).toBe('ready')
  })

  it('does not infer an inactive clear from an older archived conversation', async () => {
    const b = bench(['s-old', 's-current'], ['s-old'])
    await b.controller.open(CATL, '宁德时代')
    b.publish({ byId: {}, current: 's-current' })
    b.sessions.open.mockClear()
    b.deactivate()

    b.publish({ byId: {}, current: undefined })
    await Promise.resolve()
    b.controller.activate()

    expect(b.sessions.open).not.toHaveBeenCalled()
    expect(b.focus.snapshot().instrument).toEqual(CATL)
    expect(b.onFocusCleared).not.toHaveBeenCalled()
  })

  it('does not move navigation when a non-current conversation is archived', async () => {
    const b = bench(['s-1', 's-2'])
    b.focus.open(CATL, '宁德时代', ['s-1', 's-2'] as never)
    b.publish({ byId: {}, current: 's-2' })
    const persist = vi.fn(() => Promise.resolve())

    await expect(b.controller.archive('s-1' as never, persist)).resolves.toBe('unchanged')

    expect(persist).toHaveBeenCalledWith('s-1')
    expect(b.sessions.open).not.toHaveBeenCalled()
    expect(b.focus.snapshot().instrument).toEqual(CATL)
  })

  it('cancels an archive-baseline waiter when disposed', async () => {
    const b = bench(['s-1'], [], false)
    const opening = b.controller.open(CATL, '宁德时代')
    await waitFor(() => { expect(b.archiveListenerCount()).toBe(1) })
    expect(b.sessionListenerCount()).toBe(1)

    b.controller.dispose()
    await opening

    expect(b.archiveListenerCount()).toBe(0)
    expect(b.sessionListenerCount()).toBe(0)
    expect(b.sessions.open).not.toHaveBeenCalled()
    expect(b.sessions.startAt).not.toHaveBeenCalled()
  })

  it('cancels a queued global-archive reconciliation when disposed', async () => {
    const b = bench(['s-1'])
    await b.controller.open(CATL, '宁德时代')
    b.publish({ byId: {}, current: 's-1' })
    b.sessions.open.mockClear()
    b.publish({ byId: {}, current: undefined })
    b.publishArchives(['s-1'])

    b.controller.dispose()
    await Promise.resolve()

    expect(b.sessionListenerCount()).toBe(0)
    expect(b.sessions.open).not.toHaveBeenCalled()
    expect(b.focus.snapshot().instrument).toEqual(CATL)
    expect(b.onFocusCleared).not.toHaveBeenCalled()
  })

  it('marks a blank-conversation selection failure without creating another', async () => {
    const b = bench(['s-1'])
    await b.controller.open(CATL, '宁德时代')
    b.publish({ byId: { 's-1': { blank: true } }, current: 's-1' })
    b.sessions.open.mockImplementationOnce(() => { throw new Error('offline') })

    await b.controller.start(CATL)

    expect(b.sessions.startAt).not.toHaveBeenCalled()
    expect(b.focus.snapshot().sessionStatus).toBe('failed')
  })

  it('does not open a created conversation that could not be bound to the name', async () => {
    const b = bench([])
    b.bind.mockRejectedValueOnce(new Error('offline'))

    await b.controller.open(CATL, '宁德时代')

    expect(b.sessions.open).not.toHaveBeenCalled()
    expect(b.focus.snapshot().sessions).toEqual([])
    expect(b.focus.snapshot().sessionStatus).toBe('failed')
  })

  it.each(['archive', 'startAt', 'open'] as const)(
    'absorbs the latest %s failure and exposes a retryable state',
    async (failure) => {
      const b = bench(failure === 'open' ? ['s-1'] : [])
      switch (failure) {
        case 'archive': b.archive.mockRejectedValueOnce(new Error('offline')); break
        case 'startAt': b.sessions.startAt.mockRejectedValueOnce(new Error('offline')); break
        case 'open': b.sessions.open.mockImplementationOnce(() => { throw new Error('offline') }); break
      }

      await expect(b.controller.open(CATL, '宁德时代')).resolves.toBeUndefined()

      expect(b.focus.snapshot().sessionStatus).toBe('failed')
    },
  )

  it('opens the name even when its record cannot be read', async () => {
    const b = bench([])
    b.read.mockRejectedValueOnce(new Error('offline'))

    await b.controller.open(CATL, '宁德时代')

    expect(b.focus.snapshot().instrument).toEqual(CATL)
    expect(b.sessions.startAt).toHaveBeenCalled()
    expect(b.focus.snapshot().sessionStatus).toBe('ready')
  })
})

describe('the investing opening', () => {
  /** The opening over a focus the test drives. */
  function mountHero(focused = true) {
    const focus = new WorkbenchFocus()
    if (focused) focus.open(CATL, '宁德时代')
    const props = { focus, t } as unknown as Parameters<typeof InvestingHero>[0]
    return { view: render(<InvestingHero {...props} />), focus }
  }

  it('names what the conversation is about, with nothing to pick first', () => {
    const b = mountHero()

    expect(b.view.getByText('宁德时代')).toBeTruthy()
    expect(b.view.getByText('What do you want to ask about this name?')).toBeTruthy()
  })

  it('falls back to the code when the clicked surface had no name', () => {
    const focus = new WorkbenchFocus()
    focus.open(CATL, '')
    const props = { focus, t } as unknown as Parameters<typeof InvestingHero>[0]

    const view = render(<InvestingHero {...props} />)

    expect(view.getByText('SZSE:300750')).toBeTruthy()
  })

  it('asks for a name before one is open', () => {
    const b = mountHero(false)

    expect(b.view.getByText('Pick a name on the left to start a conversation about it.')).toBeTruthy()
  })

  it('follows the selection, so the opening never names the previous one', async () => {
    const b = mountHero()

    b.focus.open(MOUTAI, '贵州茅台')

    expect(await b.view.findByText('贵州茅台')).toBeTruthy()
  })
})

describe('the shared rows', () => {
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

  it('empties the rows on a failed read rather than showing stale prices', async () => {
    const feed = new WatchlistFeed(() => Promise.reject(new Error('offline')))

    await feed.refresh()

    expect(feed.snapshot()).toEqual({ status: 'error', rows: [] })
  })
})

describe('workbench registration', () => {
  /** The services the plugin declares, with both Remote namespaces stubbed. */
  async function bench() {
    const ctx = new Context()
    await ctx.plugin(SlotRegistry).await()
    const slots = ctx.get('slots') as SlotRegistry
    slots.register({
      name: 'root',
      children: {
        'sidebar.mode': { kind: 'list', scope: 'root' },
        'conversation.hero': { kind: 'keyed', scope: 'session-maybe' },
        'details': { kind: 'keyed', scope: 'session' },
      },
    } as never, () => null)
    ctx.provide('locale', new LocaleRuntime(ctx))
    const layout = { openDetails: vi.fn(), closeDetails: vi.fn(), toggleSidebar: vi.fn(), setMode: vi.fn() }
    ctx.provide('layout', layout)
    ctx.provide('sessions', {
      list: { getSnapshot: () => ({ byId: {}, current: undefined }), subscribe: () => () => {} },
      open: vi.fn(),
      startAt: vi.fn(() => Promise.resolve('s-new')),
    })
    const workspaces = {
      list: {
        getSnapshot: () => ({ archivedSessionIds: [], phase: 'ready', state: 'idle' }),
        subscribe: () => () => {},
      },
      archiveSession: vi.fn(() => Promise.resolve()),
    }
    ctx.provide('workspaces', workspaces)
    class RemoteService extends Service {
      constructor(serviceCtx: Context) { super(serviceCtx, 'remote') }
    }
    new RemoteService(ctx)
    const list = vi.fn().mockResolvedValue({ ok: true, value: { rows: [] } })
    ctx.provide('remote.watchlist', {
      list,
      search: vi.fn(),
      follow: vi.fn(),
      dossier: vi.fn(),
      archive: vi.fn().mockResolvedValue({ ok: true, value: { path: '/archive' } }),
    })
    ctx.provide('remote.nameRecord', {
      read: vi.fn().mockResolvedValue({ ok: true, value: recordOf() }),
      append: vi.fn(),
      bindSession: vi.fn().mockResolvedValue({ ok: true, value: ['s-new'] }),
    })
    return { ctx, slots, list, layout, workspaces }
  }

  it('declares only the services the two columns and their Remotes use', () => {
    expect(workbench.inject).toEqual([
      'slots', 'locale', 'layout', 'sessions', 'workspaces', 'remote', 'remote.watchlist', 'remote.nameRecord',
    ])
  })

  it('registers the frame\u2019s own conversation opening, so the workspace hero is out of the way', async () => {
    const b = await bench()
    const fiber = b.ctx.plugin({ inject: [...workbench.inject], apply: workbench.apply })
    await fiber.await()

    const opening = b.slots.entries('conversation.hero').find(e => e.options.key === workbench.NAMES_MODE)
    expect(opening?.component).toBe(InvestingHero)
  })

  it('registers the names frame and the details column under one frame id', async () => {
    const b = await bench()
    const fiber = b.ctx.plugin({ inject: [...workbench.inject], apply: workbench.apply })
    await fiber.await()

    const frame = b.slots.entries('sidebar.mode').find(entry => entry.options.id === workbench.NAMES_MODE)
    expect(frame?.component).toBe(NamesFrame)
    expect(frame?.options).toMatchObject({ id: 'names', order: 20 })
    const panel = b.slots.entries('details').find(entry => entry.options.key === workbench.NAMES_MODE)
    expect(panel?.component).toBe(NameDetails)
    // Registration must not read anything: each column reads when it mounts.
    expect(b.list).not.toHaveBeenCalled()
  })

  it('opens and closes the details column through the shared layout service', async () => {
    const b = await bench()
    const fiber = b.ctx.plugin({ inject: [...workbench.inject], apply: workbench.apply })
    await fiber.await()

    const frame = b.slots.entries('sidebar.mode').find(entry => entry.options.id === workbench.NAMES_MODE)
    const names = (frame?.inject as unknown as () => NamesFrameInjected)()
    names.open(CATL, '宁德时代')
    expect(b.layout.openDetails).toHaveBeenCalledTimes(1)

    const panel = b.slots.entries('details').find(entry => entry.options.key === workbench.NAMES_MODE)
    const details = (panel?.inject as unknown as () => NameDetailsInjected)()
    details.closeDetails()
    expect(b.layout.closeDetails).toHaveBeenCalledTimes(1)
  })

  it('archives a deleted investing conversation through the global workspace set', async () => {
    const b = await bench()
    const fiber = b.ctx.plugin({ inject: [...workbench.inject], apply: workbench.apply })
    await fiber.await()

    const frame = b.slots.entries('sidebar.mode').find(entry => entry.options.id === workbench.NAMES_MODE)
    const names = (frame?.inject as unknown as () => NamesFrameInjected)()
    await names.archiveConversation('s-old' as never)

    expect(b.workspaces.archiveSession).toHaveBeenCalledWith('s-old')
  })

  it('removes every registration when its fiber disposes (HMR safety)', async () => {
    const b = await bench()
    const fiber = b.ctx.plugin({ inject: [...workbench.inject], apply: workbench.apply })
    await fiber.await()

    await fiber.dispose()

    expect(b.slots.entries('sidebar.mode')).toEqual([])
    expect(b.slots.entries('conversation.hero')).toEqual([])
    expect(b.slots.entries('details')).toEqual([])
  })

  it('owns the watchlist locale namespace', () => {
    expect(NS).toBe('watchlist')
  })
})
