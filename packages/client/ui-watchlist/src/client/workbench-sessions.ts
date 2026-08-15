/**
 * The centre column's half of the workbench: opening a name navigates the
 * conversation to that name's own, and a conversation started under an open
 * name is bound to it.
 *
 * Binding happens when the conversation stops being blank, not when it is
 * created. A blank session is the New Session view, which every name would
 * otherwise claim in turn; a session that has run a turn is one the user
 * actually held about this name.
 */
import type { InstrumentRef, SessionId } from '@deepseek-ai/dsh-api-remotes/client'

/** The session-list facts this controller reads. */
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
  /** Clear the selection into the New Session view. */
  clear: () => void
}

/** What the controller needs from the host record. */
export interface RecordFace {
  /** The conversations already bound to one name, oldest first. */
  read: (instrument: InstrumentRef) => Promise<{ sessions: readonly SessionId[] }>
  /** Bind one conversation to one name. */
  bind: (instrument: InstrumentRef, sessionId: SessionId) => Promise<readonly SessionId[]>
}

/** Where the controller publishes what it learned. */
export interface FocusFace {
  /** Show one name with its conversations. */
  open: (instrument: InstrumentRef, sessions: readonly SessionId[]) => void
  /** Replace the open name's conversation list. */
  setSessions: (sessions: readonly SessionId[]) => void
}

/**
 * Navigates the centre column with the workbench and binds what the user
 * starts there. One instance per plugin; `watch` runs for the plugin's life.
 */
export class WorkbenchSessions {
  /** The name a newly non-blank conversation should be bound to, if any. */
  private awaiting: InstrumentRef | null = null

  /**
   * @param sessions - the navigation face.
   * @param record - the host record's read and bind.
   * @param focus - where the open name and its conversations are published.
   */
  constructor(
    private readonly sessions: SessionsFace,
    private readonly record: RecordFace,
    private readonly focus: FocusFace,
  ) {}

  /**
   * Show one name: publish it, then navigate the centre column to its most
   * recent conversation, or to a blank one that binds as soon as it is used.
   * @param instrument - the name to open.
   * @returns when the record has been read and the column navigated.
   */
  open = async (instrument: InstrumentRef): Promise<void> => {
    // Published before the read so the other two columns move on the click
    // rather than after a round trip.
    this.focus.open(instrument, [])
    const bound = await this.record.read(instrument).then(view => view.sessions, () => [])
    this.focus.open(instrument, bound)
    const latest = bound.at(-1)
    if (latest !== undefined) {
      this.awaiting = null
      this.sessions.open(latest)
      return
    }
    this.start(instrument)
  }

  /**
   * Open one of the name's existing conversations.
   * @param id - the conversation to select.
   */
  show = (id: SessionId): void => {
    this.awaiting = null
    this.sessions.open(id)
  }

  /**
   * Begin a new conversation about one name. Nothing is bound yet: a blank
   * session is the New Session view, and binding it would give the name a
   * conversation the user never held.
   * @param instrument - the name the next conversation is about.
   */
  start = (instrument: InstrumentRef): void => {
    this.awaiting = instrument
    this.sessions.clear()
  }

  /**
   * Bind a conversation to the awaited name once it stops being blank.
   * @returns the unsubscribe function; call it when the plugin unloads.
   */
  watch = (): (() => void) => this.sessions.list.subscribe(() => {
    const instrument = this.awaiting
    if (instrument === null) return
    const { byId, current } = this.sessions.list.getSnapshot()
    if (current === undefined || byId[current]?.blank !== false) return
    this.awaiting = null
    void this.record.bind(instrument, current).then(this.focus.setSessions, () => {
      // A failed bind loses the association, not the conversation: the user
      // keeps talking, and the name simply does not list this one.
    })
  })
}
