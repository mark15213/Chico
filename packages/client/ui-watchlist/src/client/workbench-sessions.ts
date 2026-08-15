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
  open: (instrument: InstrumentRef, displayName: string, sessions: readonly SessionId[]) => void
  /** Replace the open name's conversation list. */
  setSessions: (sessions: readonly SessionId[]) => void
  /** The open name and its conversations. */
  snapshot: () => { readonly sessions: readonly SessionId[] }
}

/**
 * Navigates the centre column with the workbench, and owns the conversations
 * started there. One instance per plugin.
 */
export class WorkbenchSessions {
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
    // Published before the read so the other two columns move on the click
    // rather than after a round trip.
    this.focus.open(instrument, displayName, [])
    const bound = await this.record.read(instrument).then(view => view.sessions, () => [])
    this.focus.open(instrument, displayName, bound)
    const newest = bound.at(-1)
    if (newest !== undefined) {
      this.sessions.open(newest)
      return
    }
    await this.create(instrument, bound)
  }

  /**
   * Open one of the name's existing conversations.
   * @param id - the conversation to select.
   */
  show = (id: SessionId): void => {
    this.sessions.open(id)
  }

  /**
   * Begin a new conversation about the open name, at the archive directory
   * and belonging to no workspace. A newest conversation nobody has spoken in
   * is opened instead of adding a second empty one.
   * @param instrument - the name the conversation is about.
   * @returns when the conversation is open.
   */
  start = async (instrument: InstrumentRef): Promise<void> => {
    const bound = this.focus.snapshot().sessions
    const newest = bound.at(-1)
    if (newest !== undefined && this.sessions.list.getSnapshot().byId[newest]?.blank === true) {
      this.sessions.open(newest)
      return
    }
    await this.create(instrument, bound)
  }

  /**
   * Create one conversation for one name and bind it before anything else can
   * claim it.
   * @param instrument - the name the conversation is about.
   * @param bound - the name's conversations before this one.
   */
  private async create(instrument: InstrumentRef, bound: readonly SessionId[]): Promise<void> {
    const { path } = await this.record.archive()
    const id = await this.sessions.startAt(path)
    this.sessions.open(id)
    const listed = await this.record.bind(instrument, id).catch(() => bound)
    this.focus.setSessions(listed)
  }
}
