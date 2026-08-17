import type { ReactNode } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { IconGoalOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import { watching, type Automation } from './automation-model.ts'
import css from './NameMark.module.css'

/** Registration-side face the mark reads through. */
export interface NameMarkInjected {
  /** Every rule; the mark decides its own applicability per row. */
  automations: readonly Automation[]
}

/** Full props of the followed-name mark. */
export type NameMarkProps =
  PropsRuntime<'investing.name.mark'>
  & PropsLocale<'automation'>
  & NameMarkInjected

/**
 * The mark on a followed name whose row something is watching.
 *
 * Non-interactive by the slot's contract — the row is already the button that
 * opens the name — so the count travels in the accessible name rather than in
 * a control. A name no rule covers draws nothing rather than an empty slot.
 * @param props - the rules, the row's instrument, and the locale seat.
 * @returns the mark, or null when nothing watches this name.
 */
export function NameMark({ automations, instrument, t }: NameMarkProps): ReactNode {
  const active = watching(automations, instrument)
  if (active.length === 0) return null
  const label = t('mark.watching', { count: active.length })
  return (
    <span className={css.mark} title={label} aria-label={label} role="img">
      <IconGoalOutline16 size={11} />
    </span>
  )
}
