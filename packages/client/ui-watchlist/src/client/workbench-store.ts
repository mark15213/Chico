/**
 * Which name the workbench is showing. It is one selection shared by the two
 * columns the workbench owns — the names frame on the left and the record
 * panel on the right — and neither can hold it: the sidebar is root-scoped and
 * the details column is session-scoped, so a slot store handle, which carries
 * one scope, cannot span them. The plugin owns it and hands both the same
 * subscription, exactly as it does for the rows.
 */
import { useSyncExternalStore } from 'react'
import type { InstrumentRef } from '@deepseek-ai/dsh-api-remotes/client'

/** The selection as a surface receives it: a subscription plus the way to move it. */
export interface WorkbenchSelection {
  /**
   * Watch for changes.
   * @param listener - called after every change.
   * @returns the unsubscribe function.
   */
  subscribe: (listener: () => void) => () => void
  /**
   * The instrument the workbench is showing.
   * @returns the instrument, or null before one is opened.
   */
  snapshot: () => InstrumentRef | null
  /**
   * Show one instrument. Both columns follow.
   * @param instrument - the instrument to open.
   */
  open: (instrument: InstrumentRef) => void
}

/** The one selection behind both workbench columns. */
export class WorkbenchFocus implements WorkbenchSelection {
  private instrument: InstrumentRef | null = null
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
   * The instrument the workbench is showing.
   * @returns the instrument, or null before one is opened.
   */
  snapshot = (): InstrumentRef | null => this.instrument

  /**
   * Show one instrument. Both columns follow.
   * @param instrument - the instrument to open.
   */
  open = (instrument: InstrumentRef): void => {
    this.instrument = instrument
    for (const listener of this.listeners) listener()
  }
}

/**
 * Subscribe a component to the workbench selection.
 * @param selection - the focus the registration handed this surface.
 * @returns the open instrument, re-rendering the caller on every change.
 */
export function useWorkbenchFocus(selection: WorkbenchSelection): InstrumentRef | null {
  return useSyncExternalStore(selection.subscribe, selection.snapshot)
}
