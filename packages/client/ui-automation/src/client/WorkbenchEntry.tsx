import type { ReactNode } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { IconGoalOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { Automation } from './automation-model.ts'
import css from './WorkbenchEntry.module.css'

/** The page id this entry opens, shared with the page and detail registrations. */
export const AUTOMATION_PAGE = 'automation'

/** Registration-side face the workbench entry reads through. */
export interface WorkbenchEntryInjected {
  /** Every rule, so the row can state how many are running. */
  automations: readonly Automation[]
}

/** Full props of the workbench entry row. */
export type WorkbenchEntryProps =
  PropsRuntime<'investing.workbench.section'>
  & PropsLocale<'automation'>
  & WorkbenchEntryInjected

/**
 * The automations row in the investing frame's workbench block: what is
 * running, and the way into managing it. The count is the row's whole status —
 * a reader glancing at the column wants to know that something is watching,
 * not which rules exist.
 * @param props - the rules, the column width, the open page, and the locale seat.
 * @returns the row when the sidebar is wide; its icon on the collapsed rail.
 */
export function WorkbenchEntry({
  automations, wide, page, openPage, closePage, t,
}: WorkbenchEntryProps): ReactNode {
  const running = automations.filter(automation => automation.enabled).length
  const on = page === AUTOMATION_PAGE
  // Pressing the open entry again returns the centre column to the
  // conversation: the row is the toggle for its own page, so a reader is never
  // stranded on a page whose entry looks like the only way forward.
  const activate = (): void => {
    if (on) closePage()
    else openPage(AUTOMATION_PAGE)
  }
  const status = running > 0 ? t('entry.running', { count: running }) : t('entry.idle')

  if (!wide) {
    return (
      <button
        type="button"
        className={css.rail}
        data-on={on ? 'true' : undefined}
        aria-label={`${t('entry.label')} · ${status}`}
        title={`${t('entry.label')} · ${status}`}
        aria-pressed={on}
        onClick={activate}
      >
        <IconGoalOutline16 size={16} />
        {running > 0 ? <span className={css.railDot} aria-hidden /> : null}
      </button>
    )
  }

  return (
    <button
      type="button"
      className={css.row}
      data-on={on ? 'true' : undefined}
      aria-pressed={on}
      onClick={activate}
    >
      <span className={css.icon}><IconGoalOutline16 size={15} /></span>
      <span className={css.label}>{t('entry.label')}</span>
      <span className={css.status} data-running={running > 0 ? 'true' : undefined}>{status}</span>
    </button>
  )
}
