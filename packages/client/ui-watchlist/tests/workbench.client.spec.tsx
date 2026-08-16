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
import { NamesFrame } from '../src/client/NamesFrame.tsx'
import { NameDetails } from '../src/client/NameDetails.tsx'
import { RecordPanel } from '../src/client/RecordPanel.tsx'
import { WatchlistFeed } from '../src/client/watchlist-store.ts'
import { WorkbenchFocus } from '../src/client/workbench-store.ts'
import { WorkbenchSessions } from '../src/client/workbench-sessions.ts'
import * as workbench from '../src/client/index.ts'

afterEach(cleanup)

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
  over?: { search?: unknown; follow?: unknown; wide?: boolean },
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
  const useSessions = (select: (state: unknown) => unknown) => select({
    byId: { 's-1': { displayTitle: '本周储能订单节奏' }, 's-2': { displayTitle: 'Q2 财报速读' } },
    current: 's-2',
  })
  const props = {
    rows: feed, search, follow, focus, open, openConversation, startConversation, useSessions,
    wide: over?.wide ?? true, t,
  } as unknown as Parameters<typeof NamesFrame>[0]
  return {
    view: render(<NamesFrame {...props} />),
    list, feed, focus, search, follow, open, openConversation, startConversation,
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

    const mark = await view.findByLabelText('2 thesis waiting to be settled')
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
    expect(view.getByText('Q2 财报速读').getAttribute('data-current')).toBe('true')
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

    fireEvent.click(await view.findByText('+ New conversation'))

    expect(startConversation).toHaveBeenCalledWith(CATL)
  })

  it('selects one of the listed conversations', async () => {
    const { view, focus, openConversation } = mountFrame()
    await view.findByText('宁德时代')
    focus.open(CATL, '宁德时代', ['s-1'] as never)

    fireEvent.click(await view.findByText('本周储能订单节奏'))

    expect(openConversation).toHaveBeenCalledWith('s-1')
  })

  it('says how to start when nothing is followed', async () => {
    const { view } = mountFrame({ rows: [] })

    expect(await view.findByText('The watchlist is empty.')).toBeTruthy()
  })

  it('renders nothing on the rail, where a name beside a price does not fit', () => {
    const { view } = mountFrame(undefined, { wide: false })

    expect(view.container.textContent).toBe('')
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
  focused?: boolean
}) {
  const focus = new WorkbenchFocus()
  if (over?.focused !== false) focus.open(CATL, '宁德时代')
  const read = vi.fn(() => Promise.resolve(record))
  const dossier = over?.dossier ?? vi.fn(() => Promise.resolve(dossierOf()))
  const append = over?.append ?? vi.fn(() => Promise.resolve(thesis()))
  const props = { focus, read, dossier, append, t } as unknown as Parameters<typeof RecordPanel>[0]
  return { view: render(<RecordPanel {...props} />), focus, read, dossier, append }
}

describe('the record panel', () => {
  it('asks for a name before it shows one', () => {
    const { view } = mountPanel(undefined, { focused: false })

    expect(view.getByText('Pick a name on the left.')).toBeTruthy()
  })

  it('shows the open name with its figures and chart', async () => {
    const { view } = mountPanel()

    expect(await view.findByText('SZSE:300750')).toBeTruthy()
    expect(view.getByText('212.30 CNY')).toBeTruthy()
    expect(view.getByRole('img').getAttribute('aria-label')).toContain('3 sessions')
  })

  it('reads the record and the figures for the open name', async () => {
    const { view, read, dossier } = mountPanel()

    await view.findByText('SZSE:300750')
    expect(read).toHaveBeenCalledWith(CATL)
    expect(dossier).toHaveBeenCalledWith(CATL, 60)
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
    await view.findByText('SZSE:300750')

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
    await view.findByText('SZSE:300750')

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
    expect(focus.snapshot()).toEqual({ instrument: MOUTAI, displayName: '贵州茅台', sessions: ['s-1'] })
  })
})

describe('the centre column', () => {
  /** A session list the test drives, plus the controller over it. */
  function bench(bound: readonly string[] = []) {
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
    const controller = new WorkbenchSessions(
      sessions as never, { read, bind, archive } as never, focus,
    )
    return { controller, sessions, read, bind, archive, focus, publish }
  }

  it('navigates to the name\u2019s newest conversation', async () => {
    const b = bench(['s-1', 's-2'])

    await b.controller.open(CATL, '宁德时代')

    expect(b.sessions.open).toHaveBeenCalledWith('s-2')
    expect(b.sessions.startAt).not.toHaveBeenCalled()
    expect(b.focus.snapshot()).toMatchObject({ instrument: CATL, sessions: ['s-1', 's-2'] })
  })

  it('publishes the name before the read, so the other columns move on the click', async () => {
    const b = bench(['s-1'])
    const seen: unknown[] = []
    b.focus.subscribe(() => { seen.push(b.focus.snapshot().instrument) })

    await b.controller.open(CATL, '宁德时代')

    // First publish carries the name with no conversations yet.
    expect(seen[0]).toEqual(CATL)
    expect(seen).toHaveLength(2)
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
  })

  it('keeps the conversation when the bind fails, and simply does not list it', async () => {
    const b = bench([])
    b.bind.mockRejectedValueOnce(new Error('offline'))

    await b.controller.open(CATL, '宁德时代')

    expect(b.sessions.open).toHaveBeenCalledWith('s-new')
    expect(b.focus.snapshot().sessions).toEqual([])
  })

  it('opens the name even when its record cannot be read', async () => {
    const b = bench([])
    b.read.mockRejectedValueOnce(new Error('offline'))

    await b.controller.open(CATL, '宁德时代')

    expect(b.focus.snapshot().instrument).toEqual(CATL)
    expect(b.sessions.startAt).toHaveBeenCalled()
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
    ctx.provide('layout', { openDetails: vi.fn(), closeDetails: vi.fn(), toggleSidebar: vi.fn(), setMode: vi.fn() })
    ctx.provide('sessions', {
      list: { getSnapshot: () => ({ byId: {}, current: undefined }), subscribe: () => () => {} },
      open: vi.fn(),
      startAt: vi.fn(),
    })
    class RemoteService extends Service {
      constructor(serviceCtx: Context) { super(serviceCtx, 'remote') }
    }
    new RemoteService(ctx)
    const list = vi.fn().mockResolvedValue({ ok: true, value: { rows: [] } })
    ctx.provide('remote.watchlist', { list })
    ctx.provide('remote.nameRecord', { read: vi.fn() })
    return { ctx, slots, list }
  }

  it('declares only the services the two columns and their Remotes use', () => {
    expect(workbench.inject).toEqual([
      'slots', 'locale', 'layout', 'sessions', 'remote', 'remote.watchlist', 'remote.nameRecord',
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
