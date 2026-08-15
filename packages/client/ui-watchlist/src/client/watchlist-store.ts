/**
 * The watchlist rows, held once and read by both surfaces this package
 * registers: the tab in the conversation view ring and the pinned sidebar
 * list. Two independent readers would disagree the moment one of them followed
 * a name, so the rows live in one feed and both registrations receive it.
 *
 * The feed is a plain observable rather than a slot `store` handle, because a
 * handle carries one scope and these two slots do not share one: the view ring
 * is session-scoped and the sidebar is root-scoped. The rows are neither —
 * they are one book, the same in every session — so the plugin owns them and
 * hands each surface the same subscription.
 */
import { useSyncExternalStore } from 'react'
import type { WatchlistRow, WatchlistSnapshot } from '@deepseek-ai/dsh-api-remotes/client'

/** What both surfaces read: the rows and how the last read went. */
export interface WatchlistState {
  /** `loading` until the first read settles, then `ready` or `error`. */
  readonly status: 'loading' | 'ready' | 'error'
  /** The current rows; empty while loading and after a failed read. */
  readonly rows: readonly WatchlistRow[]
}

/** The rows as a surface receives them: a subscription plus a way to reload. */
export interface WatchlistSource {
  /**
   * Watch for changes.
   * @param listener - called after every state change.
   * @returns the unsubscribe function.
   */
  subscribe: (listener: () => void) => () => void
  /**
   * The current state.
   * @returns the state object, stable by reference until it changes.
   */
  snapshot: () => WatchlistState
  /**
   * Read the rows again.
   * @returns when the state carries the outcome.
   */
  refresh: () => Promise<void>
}

const INITIAL: WatchlistState = { status: 'loading', rows: [] }

/**
 * The one read behind both surfaces, and the state it produces. A failed read
 * empties the rows rather than leaving the previous ones on screen: a
 * watchlist that cannot be read is not a watchlist quietly showing yesterday's
 * prices.
 */
export class WatchlistFeed implements WatchlistSource {
  private state: WatchlistState = INITIAL
  private readonly listeners = new Set<() => void>()
  private inFlight: Promise<void> | undefined

  /**
   * @param read - the Remote list call, supplied by the plugin body.
   */
  constructor(private readonly read: () => Promise<WatchlistSnapshot>) {}

  /**
   * Watch for changes.
   * @param listener - called after every state change.
   * @returns the unsubscribe function.
   */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  /**
   * The current state.
   * @returns the state object, stable by reference until it changes.
   */
  snapshot = (): WatchlistState => this.state

  /**
   * Read the rows into the feed. A refresh requested while one is in flight
   * joins it rather than starting a second: both surfaces refresh on mount,
   * and the pair would otherwise cost two reads for one answer.
   * @returns when the state carries the outcome.
   */
  refresh = async (): Promise<void> => {
    if (this.inFlight !== undefined) return this.inFlight
    this.publish(INITIAL)
    const run = this.read().then(
      (snapshot) => { this.publish({ status: 'ready', rows: snapshot.rows }) },
      () => { this.publish({ status: 'error', rows: [] }) },
    ).finally(() => { this.inFlight = undefined })
    this.inFlight = run
    return run
  }

  private publish(state: WatchlistState): void {
    this.state = state
    for (const listener of this.listeners) listener()
  }
}

/**
 * Subscribe a component to the shared rows.
 * @param source - the feed the registration handed this surface.
 * @returns the current state, re-rendering the caller on every change.
 */
export function useWatchlist(source: WatchlistSource): WatchlistState {
  return useSyncExternalStore(source.subscribe, source.snapshot)
}
