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

/** The registry-global archived-session snapshot used for navigation filtering. */
export interface ArchivedSessionsFace {
  /** Read the current archive baseline and its loading state. */
  getSnapshot: () => {
    archivedSessionIds: readonly SessionId[]
    phase: 'pending' | 'ready'
    state: 'idle' | 'loading' | 'error'
  }
  /** Watch for baseline and archive-set changes. */
  subscribe: (fn: () => void) => () => void
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
  /** Clear the selected name when it no longer has an active conversation. */
  clear: () => void
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
  private archiveReadiness: Promise<boolean> | null = null
  private cancelArchiveReadiness: (() => void) | null = null
  private selectedSession: { readonly id: SessionId; readonly epoch: number } | null = null
  private localArchive: { readonly id: SessionId; readonly epoch: number } | null = null
  private deferredArchivedSession: SessionId | null = null
  private sessionObservation = 0
  private activeConsumers = 0
  private readonly unsubscribeSessions: () => void
  private disposed = false

  /**
   * @param sessions - the navigation face.
   * @param record - the host record's read, bind, and archive directory.
   * @param focus - where the open name and its conversations are published.
   * @param archivedSessions - the registry-global archive-set snapshot.
   * @param onFocusCleared - close details after an archived current leaves no replacement.
   */
  constructor(
    private readonly sessions: SessionsFace,
    private readonly record: RecordFace,
    private readonly focus: FocusFace,
    private readonly archivedSessions: ArchivedSessionsFace,
    private readonly onFocusCleared: () => void,
  ) {
    this.unsubscribeSessions = sessions.list.subscribe(this.observeSessions)
  }

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
    const archivesReady = this.waitForArchives()
    let bound: readonly SessionId[]
    try {
      bound = (await this.record.read(instrument)).sessions
    } catch {
      // Binding before selection remains the ownership check when the session
      // list cannot be read.
      bound = []
    }
    if (!await archivesReady) {
      this.fail(epoch)
      return
    }
    if (!this.isLatest(epoch)) return
    const newest = this.visible(bound).at(-1)
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
    if (!this.archivesReady() || this.isArchived(id)) return
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
    if (!await this.waitForArchives()) {
      this.fail(epoch)
      return
    }
    if (!this.isLatest(epoch)) return
    const bound = this.visible(selection.sessions)
    const newest = bound.at(-1)
    if (newest !== undefined && this.sessions.list.getSnapshot().byId[newest]?.blank === true) {
      if (this.select(newest, epoch)) this.focus.setSessionStatus('ready')
      return
    }
    await this.create(instrument, epoch)
  }

  /**
   * Archive one conversation and reconcile navigation if it was current.
   * Another navigation that wins while the archive is in flight is preserved.
   * @param id - the conversation to archive.
   * @param persist - the durable global archive operation.
   * @returns whether another conversation was selected, the focus was cleared, or navigation was unchanged.
   */
  archive = async (
    id: SessionId,
    persist: (sessionId: SessionId) => Promise<void>,
  ): Promise<'selected' | 'cleared' | 'unchanged'> => {
    const wasCurrent = this.sessions.list.getSnapshot().current === id
    const selection = this.focus.snapshot()
    const ownsSelection = selection.instrument !== null && selection.sessions.includes(id)
    const token = wasCurrent && ownsSelection
      ? { id, epoch: this.nextNavigation() }
      : undefined
    if (token !== undefined) {
      this.selectedSession = token
      this.localArchive = token
    }
    try {
      await persist(id)
    } finally {
      if (this.localArchive === token) this.localArchive = null
    }
    if (token === undefined) return 'unchanged'
    return this.reconcileArchivedSelection(token)
  }

  /**
   * Reconcile global archive changes only while the investing frame is active.
   * Returning to the frame converges archive changes received while another
   * frame was active without navigating on that frame's behalf.
   * @returns a disposer that marks this mounted consumer inactive.
   */
  activate = (): (() => void) => {
    if (this.disposed) return () => {}
    this.activeConsumers += 1
    if (this.activeConsumers === 1) this.reconcileActivation()
    let active = true
    return () => {
      if (!active) return
      active = false
      if (this.disposed) return
      this.activeConsumers -= 1
      if (this.activeConsumers !== 0) return
      this.navigationEpoch += 1
      this.sessionObservation += 1
      const selected = this.selectedSession
      if (selected !== null && this.sessions.list.getSnapshot().current === undefined) {
        if (this.isArchived(selected.id)) this.deferredArchivedSession = selected.id
        this.selectedSession = null
      }
    }
  }

  /** Stop session observation and pending archive-baseline navigation during plugin disposal. */
  dispose = (): void => {
    if (this.disposed) return
    this.disposed = true
    this.navigationEpoch += 1
    this.sessionObservation += 1
    this.unsubscribeSessions()
    this.activeConsumers = 0
    this.selectedSession = null
    this.localArchive = null
    this.deferredArchivedSession = null
    this.cancelArchiveReadiness?.()
    this.cancelArchiveReadiness = null
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
    if (!this.isLatest(epoch)) return
    if (this.isArchived(id)) {
      this.fail(epoch)
      return
    }
    if (!this.select(id, epoch)) return
    this.focus.setSessions(listed)
    this.focus.setSessionStatus('ready')
  }

  /** Begin an operation that supersedes every earlier navigation. */
  private nextNavigation(): number {
    this.deferredArchivedSession = null
    this.navigationEpoch += 1
    return this.navigationEpoch
  }

  /** Whether an asynchronous continuation still owns navigation. */
  private isLatest(epoch: number): boolean {
    return !this.disposed && epoch === this.navigationEpoch
  }

  /** Whether the complete archive baseline is already safe to consult. */
  private archivesReady(): boolean {
    return this.archivedSessions.getSnapshot().phase === 'ready'
  }

  /**
   * Wait for the complete archive baseline; a failed baseline leaves
   * navigation retryable instead of treating an unknown set as empty.
   */
  private waitForArchives(): Promise<boolean> {
    if (this.disposed) return Promise.resolve(false)
    const current = this.archivedSessions.getSnapshot()
    if (current.phase === 'ready') return Promise.resolve(true)
    if (current.state === 'error') return Promise.resolve(false)
    if (this.archiveReadiness !== null) return this.archiveReadiness
    let cancel = (): void => {}
    const readiness = new Promise<boolean>((resolve) => {
      let settled = false
      let unsubscribe = (): void => {}
      const finish = (ready: boolean): void => {
        if (settled) return
        settled = true
        unsubscribe()
        resolve(ready)
      }
      const inspect = (): void => {
        const snapshot = this.archivedSessions.getSnapshot()
        if (snapshot.phase === 'ready') finish(true)
        else if (snapshot.state === 'error') finish(false)
      }
      unsubscribe = this.archivedSessions.subscribe(inspect)
      cancel = () => { finish(false) }
      this.cancelArchiveReadiness = cancel
      inspect()
    })
    this.archiveReadiness = readiness
    void readiness.then(() => {
      if (this.archiveReadiness === readiness) this.archiveReadiness = null
      if (this.cancelArchiveReadiness === cancel) this.cancelArchiveReadiness = null
    })
    return readiness
  }

  /** Sessions still available for navigation, preserving binding order. */
  private visible(bound: readonly SessionId[]): readonly SessionId[] {
    const archived = this.archivedSessions.getSnapshot().archivedSessionIds
    return bound.filter(id => !archived.includes(id))
  }

  /** Whether one session is hidden by the registry-global archive set. */
  private isArchived(id: SessionId): boolean {
    return this.archivedSessions.getSnapshot().archivedSessionIds.includes(id)
  }

  /**
   * Defer current-session loss until the workspace projection has published
   * the archive set from the same update. An ordinary New Session clear drops
   * ownership without reopening the workbench.
   */
  private observeSessions = (): void => {
    const observation = ++this.sessionObservation
    const current = this.sessions.list.getSnapshot().current
    if (current !== undefined) {
      if (this.selectedSession?.id !== current) this.selectedSession = null
      this.deferredArchivedSession = null
      return
    }
    const selected = this.selectedSession
    if (selected === null) return
    queueMicrotask(() => {
      if (this.disposed || observation !== this.sessionObservation || this.selectedSession !== selected) return
      const latest = this.sessions.list.getSnapshot().current
      if (latest !== undefined) {
        if (latest !== selected.id) this.selectedSession = null
        return
      }
      if (this.localArchive === selected) return
      if (!this.isArchived(selected.id)) {
        this.selectedSession = null
        this.deferredArchivedSession = null
        return
      }
      if (this.activeConsumers === 0) {
        this.deferredArchivedSession = selected.id
        this.selectedSession = null
        return
      }
      this.reconcileArchivedSelection(selected)
    })
  }

  /** Reconcile one controller-owned selection after the runtime clears it as archived. */
  private reconcileArchivedSelection(
    selected: { readonly id: SessionId; readonly epoch: number },
  ): 'selected' | 'cleared' | 'unchanged' {
    if (this.activeConsumers === 0) {
      const focus = this.focus.snapshot()
      if (this.sessions.list.getSnapshot().current === undefined
        && focus.instrument !== null
        && focus.sessions.includes(selected.id)
        && this.isArchived(selected.id)) this.deferredArchivedSession = selected.id
      if (this.selectedSession === selected) this.selectedSession = null
      return 'unchanged'
    }
    if (!this.isLatest(selected.epoch)
      || this.sessions.list.getSnapshot().current !== undefined) {
      if (this.selectedSession === selected) this.selectedSession = null
      return 'unchanged'
    }
    const focus = this.focus.snapshot()
    if (focus.instrument === null || !focus.sessions.includes(selected.id) || !this.isArchived(selected.id)) {
      if (this.selectedSession === selected) this.selectedSession = null
      return 'unchanged'
    }
    const newest = this.visible(focus.sessions).at(-1)
    if (newest !== undefined) {
      this.focus.setSessionStatus('pending')
      if (this.select(newest, selected.epoch)) {
        this.focus.setSessionStatus('ready')
        return 'selected'
      }
      return 'unchanged'
    }
    this.selectedSession = null
    this.focus.clear()
    this.onFocusCleared()
    return 'cleared'
  }

  /** Restore or clear stale workbench focus when its frame becomes active. */
  private reconcileActivation(): void {
    const focus = this.focus.snapshot()
    if (focus.instrument === null) return
    if (!this.archivesReady()) {
      const observation = this.sessionObservation
      void this.waitForArchives().then((ready) => {
        if (ready && this.activeConsumers > 0 && observation === this.sessionObservation) {
          this.reconcileActivation()
        }
      })
      return
    }
    const current = this.sessions.list.getSnapshot().current
    if (current !== undefined) {
      this.selectedSession = focus.sessions.includes(current) && !this.isArchived(current)
        ? { id: current, epoch: this.navigationEpoch }
        : null
      return
    }
    const archived = this.deferredArchivedSession
    if (archived === null || !focus.sessions.includes(archived) || !this.isArchived(archived)) return
    const selected = { id: archived, epoch: this.nextNavigation() }
    this.selectedSession = selected
    this.reconcileArchivedSelection(selected)
  }

  /** Select a session without allowing a thrown adapter error to escape. */
  private select(id: SessionId, epoch: number): boolean {
    if (!this.isLatest(epoch)) return false
    this.deferredArchivedSession = null
    const previous = this.selectedSession
    const selected = { id, epoch }
    this.selectedSession = selected
    try {
      this.sessions.open(id)
    } catch {
      if (this.selectedSession === selected) {
        const current = this.sessions.list.getSnapshot().current
        this.selectedSession = previous?.id === current ? previous : null
      }
      this.fail(epoch)
      return false
    }
    if (this.isLatest(epoch)) return true
    if (this.selectedSession === selected) this.selectedSession = null
    return false
  }

  /** Publish a retryable failure only for the navigation that still owns focus. */
  private fail(epoch: number): void {
    if (this.isLatest(epoch)) this.focus.setSessionStatus('failed')
  }
}
