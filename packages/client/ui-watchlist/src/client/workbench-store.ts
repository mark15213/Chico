/**
 * Which name the workbench is showing, and which conversations belong to it.
 *
 * It is one selection shared by all three columns, and none of them can hold
 * it: the sidebar is root-scoped, the details column is session-scoped, and
 * the centre column belongs to another package. A slot store handle carries
 * one scope, so the plugin owns the selection and hands each surface the same
 * subscription — the same arrangement the rows use.
 */
import { useSyncExternalStore } from 'react'
import type { InstrumentRef, SessionId } from '@deepseek-ai/dsh-api-remotes/client'

/** The open name and the conversations recorded against it. */
export interface WorkbenchFocusState {
  /** The instrument the workbench is showing, or null before one is opened. */
  readonly instrument: InstrumentRef | null
  /**
   * That name as the surface the reader clicked knows it. It travels with the
   * selection because the surfaces that show the name — the conversation
   * opening among them — have no other way to it: the record holds no name,
   * and a round trip for a heading would leave the column blank on every
   * click.
   */
  readonly displayName: string | null
  /** Conversations bound to that name, in the order they were bound. */
  readonly sessions: readonly SessionId[]
}

/** The selection as a surface receives it. */
export interface WorkbenchSelection {
  /**
   * Watch for changes.
   * @param listener - called after every change.
   * @returns the unsubscribe function.
   */
  subscribe: (listener: () => void) => () => void
  /**
   * The open name and its conversations.
   * @returns the state object, stable by reference until it changes.
   */
  snapshot: () => WorkbenchFocusState
}

const EMPTY: WorkbenchFocusState = { instrument: null, displayName: null, sessions: [] }

/** The one selection behind every workbench column. */
export class WorkbenchFocus implements WorkbenchSelection {
  private state: WorkbenchFocusState = EMPTY
  private readonly listeners = new Set<() => void>()

  /**
   * Watch for changes.
   * @param listener - called after every change.
   * @returns the unsubscribe function.
   */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  /**
   * The open name and its conversations.
   * @returns the state object, stable by reference until it changes.
   */
  snapshot = (): WorkbenchFocusState => this.state

  /**
   * Show one name with the conversations recorded against it.
   * @param instrument - the instrument to show.
   * @param displayName - that name as the clicked surface knows it.
   * @param sessions - its bound conversations, oldest first.
   */
  open = (
    instrument: InstrumentRef, displayName: string, sessions: readonly SessionId[] = [],
  ): void => {
    this.publish({ instrument, displayName, sessions })
  }

  /**
   * Replace the open name's conversation list, leaving the name alone. Called
   * after a conversation is bound, so the column that lists them updates
   * without re-reading the whole record.
   * @param sessions - the bound conversations, oldest first.
   */
  setSessions = (sessions: readonly SessionId[]): void => {
    if (this.state.instrument === null) return
    this.publish({ ...this.state, sessions })
  }

  private publish(state: WorkbenchFocusState): void {
    this.state = state
    for (const listener of this.listeners) listener()
  }
}

/**
 * Subscribe a component to the workbench selection.
 * @param selection - the focus the registration handed this surface.
 * @returns the open name and its conversations, re-rendering on every change.
 */
export function useWorkbenchFocus(selection: WorkbenchSelection): WorkbenchFocusState {
  return useSyncExternalStore(selection.subscribe, selection.snapshot)
}
