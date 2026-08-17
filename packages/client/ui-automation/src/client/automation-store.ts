/**
 * Which rule the automation page has open, shared by the page and its detail
 * column. Neither column can hold it: the page is root-scoped and the detail
 * column is session-scoped, and a slot store handle carries one scope. So the
 * plugin owns the selection and hands both surfaces the same subscription —
 * the arrangement the name workbench already uses for its own two columns.
 */
import { useSyncExternalStore } from 'react'
import type { AutomationId } from './automation-model.ts'

/** The selection as a surface receives it. */
export interface AutomationSelection {
  /**
   * Watch for changes.
   * @param listener - called after every change.
   * @returns the unsubscribe function.
   */
  subscribe: (listener: () => void) => () => void
  /**
   * Which rule is open.
   * @returns the selected id, or null before one is picked.
   */
  snapshot: () => AutomationId | null
}

/** The one selection behind the page and its detail column. */
export class AutomationFocus implements AutomationSelection {
  private state: AutomationId | null = null
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
   * Which rule is open.
   * @returns the selected id, or null before one is picked.
   */
  snapshot = (): AutomationId | null => this.state

  /**
   * Open one rule in the detail column.
   * @param id - the rule to show, or null to clear the selection.
   */
  select = (id: AutomationId | null): void => {
    if (this.state === id) return
    this.state = id
    for (const listener of this.listeners) listener()
  }
}

/**
 * Subscribe a component to the open rule.
 * @param selection - the focus the registration handed this surface.
 * @returns the selected id, re-rendering on every change.
 */
export function useAutomationFocus(selection: AutomationSelection): AutomationId | null {
  return useSyncExternalStore(selection.subscribe, selection.snapshot)
}
