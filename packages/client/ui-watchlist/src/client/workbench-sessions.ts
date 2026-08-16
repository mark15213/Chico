/**
 * The centre column's half of the workbench: opening a name navigates the
 * conversation to that name's own, and a conversation started under an open
 * name belongs to it from the moment it exists.
 *
 * Conversations here belong to no workspace. The workspace flow is the right
 * way in when the reader's unit of work is a project; under a name it would
 * ask them to pick a project before they could say anything about a stock.
 * They run at the archive directory instead, which is never registered as a
 * workspace, so produced files land somewhere durable and no folder appears
 * for a name someone merely glanced at.
 *
 * **A conversation is created for one name and bound at creation.** Nothing
 * is shared and nothing is claimed later: an unbound conversation the reader
 * is typing into cannot be adopted by whichever name they open next, which is
 * how a conversation about one stock ends up filed under another.
 *
 * The reuse that keeps blank conversations from piling up is per name, and
 * reads that name's own list: opening a name returns to its newest
 * conversation, and starting a new one while its newest is still blank
 * returns to that blank rather than adding a second.
 */
import type { InstrumentRef, SessionId } from '@deepseek-ai/dsh-api-remotes/client'
import { sameInstrument } from './watchlist-model.ts'
import type { WorkbenchSessionStatus } from './workbench-store.ts'

/** The session facts and moves this controller uses. */
export interface SessionsFace {
  /** The list feed: rows, and which one is current. */
  list: {
    getSnapshot: () => {
      byId: Record<string, { blank: boolean } | undefined>
      current: SessionId | undefined
    }
    subscribe: (fn: () => void) => () => void
  }
  /** Select an existing conversation. */
  open: (id: SessionId) => void
  /** Create a conversation at a directory, belonging to no workspace. */
  startAt: (cwd: string) => Promise<SessionId>
}

/** What the controller needs from the host record. */
export interface RecordFace {
  /** The conversations already bound to one name, oldest first. */
  read: (instrument: InstrumentRef) => Promise<{ sessions: readonly SessionId[] }>
  /** Bind one conversation to one name. */
  bind: (instrument: InstrumentRef, sessionId: SessionId) => Promise<readonly SessionId[]>
  /** The directory a conversation about a name runs in. */
  archive: () => Promise<{ path: string }>
}

/** Where the controller publishes what it learned, and reads it back. */
export interface FocusFace {
  /** Show one name with its conversations. */
  open: (
    instrument: InstrumentRef,
    displayName: string,
    sessions: readonly SessionId[],
    sessionStatus: WorkbenchSessionStatus,
  ) => void
  /** Replace the open name's conversation list. */
  setSessions: (sessions: readonly SessionId[]) => void
  /** Mark whether the selected name's conversation can be shown. */
  setSessionStatus: (status: WorkbenchSessionStatus) => void
  /** The open name and its conversations. */
  snapshot: () => {
    readonly instrument: InstrumentRef | null
    readonly sessions: readonly SessionId[]
  }
}

/**
 * Navigates the centre column with the workbench, and owns the conversations
 * started there. One instance per plugin.
 */
export class WorkbenchSessions {
  private navigationEpoch = 0

  /**
   * @param sessions - the navigation face.
   * @param record - the host record's read, bind, and archive directory.
   * @param focus - where the open name and its conversations are published.
   */
  constructor(
    private readonly sessions: SessionsFace,
    private readonly record: RecordFace,
    private readonly focus: FocusFace,
  ) {}

  /**
   * Show one name: publish it, then navigate the centre column to its newest
   * conversation, or open its first.
   * @param instrument - the name to open.
   * @param displayName - that name as the clicked surface knows it.
   * @returns when the record has been read and the column navigated.
   */
  open = async (instrument: InstrumentRef, displayName: string): Promise<void> => {
    const epoch = this.nextNavigation()
    // Published before the read so the other two columns move on the click
    // rather than after a round trip.
    this.focus.open(instrument, displayName, [], 'pending')
    let bound: readonly SessionId[]
    try {
      bound = (await this.record.read(instrument)).sessions
    } catch {
      // Binding before selection remains the ownership check when the session
      // list cannot be read.
      bound = []
    }
    if (!this.isLatest(epoch)) return
    const newest = bound.at(-1)
    if (newest !== undefined) {
      if (this.select(newest, epoch)) this.focus.open(instrument, displayName, bound, 'ready')
      return
    }
    await this.create(instrument, epoch)
  }

  /**
   * Open one of the name's existing conversations.
   * @param id - the conversation to select.
   */
  show = (id: SessionId): void => {
    const epoch = this.nextNavigation()
    this.focus.setSessionStatus('pending')
    if (this.select(id, epoch)) this.focus.setSessionStatus('ready')
  }

  /**
   * Begin a new conversation about the open name, at the archive directory
   * and belonging to no workspace. A newest conversation nobody has spoken in
   * is opened instead of adding a second empty one.
   * @param instrument - the name the conversation is about.
   * @returns when the conversation is open.
   */
  start = async (instrument: InstrumentRef): Promise<void> => {
    const selection = this.focus.snapshot()
    if (selection.instrument === null || !sameInstrument(selection.instrument, instrument)) return
    const epoch = this.nextNavigation()
    this.focus.setSessionStatus('pending')
    const bound = selection.sessions
    const newest = bound.at(-1)
    if (newest !== undefined && this.sessions.list.getSnapshot().byId[newest]?.blank === true) {
      if (this.select(newest, epoch)) this.focus.setSessionStatus('ready')
      return
    }
    await this.create(instrument, epoch)
  }

  /**
   * Create one conversation for one name and bind it before anything else can
   * claim it.
   * @param instrument - the name the conversation is about.
   * @param epoch - the navigation that requested the conversation.
   */
  private async create(instrument: InstrumentRef, epoch: number): Promise<void> {
    let path: string
    try {
      path = (await this.record.archive()).path
    } catch {
      this.fail(epoch)
      return
    }
    if (!this.isLatest(epoch)) return
    let id: SessionId
    try {
      id = await this.sessions.startAt(path)
    } catch {
      this.fail(epoch)
      return
    }
    // Once creation succeeds, binding is completed even if another navigation
    // wins while the record write is in flight. The created conversation must
    // never become an unowned candidate for a later name.
    let listed: readonly SessionId[]
    try {
      listed = await this.record.bind(instrument, id)
    } catch {
      this.fail(epoch)
      return
    }
    if (!this.isLatest(epoch) || !this.select(id, epoch)) return
    this.focus.setSessions(listed)
    this.focus.setSessionStatus('ready')
  }

  /** Begin an operation that supersedes every earlier navigation. */
  private nextNavigation(): number {
    this.navigationEpoch += 1
    return this.navigationEpoch
  }

  /** Whether an asynchronous continuation still owns navigation. */
  private isLatest(epoch: number): boolean {
    return epoch === this.navigationEpoch
  }

  /** Select a session without allowing a thrown adapter error to escape. */
  private select(id: SessionId, epoch: number): boolean {
    try {
      this.sessions.open(id)
    } catch {
      this.fail(epoch)
      return false
    }
    return this.isLatest(epoch)
  }

  /** Publish a retryable failure only for the navigation that still owns focus. */
  private fail(epoch: number): void {
    if (this.isLatest(epoch)) this.focus.setSessionStatus('failed')
  }
}
