import { useState, type ReactNode } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { IconPlusOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import {
  conditionSummary, firingsFor, formatClock, watching, type Automation, type TriggerFiring,
} from './automation-model.ts'
import { AttachPanel } from './AttachPanel.tsx'
import css from './RecordSection.module.css'

/** Registration-side face the record block reads through. */
export interface RecordSectionInjected {
  /** Every rule. */
  automations: readonly Automation[]
  /** Every firing, newest first. */
  firings: readonly TriggerFiring[]
}

/** Full props of the record block. */
export type RecordSectionProps =
  PropsRuntime<'investing.record.section'>
  & PropsLocale<'automation'>
  & RecordSectionInjected

/**
 * What watches this name, in the name's own record.
 *
 * The record is where everything about one name lives — the stance, the
 * position, the decision chain — so it is where a reader looks to ask "what is
 * watching this?" and where attaching another rule belongs. The conversation's
 * floating capsule answers the same question while reading; this answers it
 * while working on the name, and both open the same panel.
 * @param props - the rules, the firings, the row's name, and the locale seat.
 * @returns the block, or its empty state when no rule covers this name.
 */
export function RecordSection({
  automations, firings, instrument, displayName, t,
}: RecordSectionProps): ReactNode {
  const [attaching, setAttaching] = useState(false)
  const active = watching(automations, instrument)
  const today = firingsFor(firings, instrument)

  return (
    <section className={css.section}>
      <header className={css.head}>
        <h3 className={css.title}>{t('record.title')}</h3>
        <button
          type="button"
          className={css.add}
          aria-label={t('attach.title', { name: displayName })}
          onClick={() => { setAttaching(true) }}
        >
          <IconPlusOutline16 size={13} />
          {t('record.add')}
        </button>
      </header>

      {active.length === 0 ? (
        <p className={css.quiet}>{t('record.none')}</p>
      ) : (
        <ul className={css.rules}>
          {active.map((automation) => {
            const hits = today.filter(firing => firing.automationId === automation.id)
            const latest = hits[0]
            return (
              <li key={automation.id} className={css.rule}>
                <span className={css.state} aria-hidden />
                <span className={css.identity}>
                  <span className={css.name}>{automation.name}</span>
                  <span className={css.condition}>{conditionSummary(automation.condition, t)}</span>
                </span>
                <span className={css.hits} data-fired={hits.length > 0 ? 'true' : undefined}>
                  {hits.length === 0
                    ? t('record.quiet')
                    : t('record.hits', { count: hits.length, at: formatClock(latest?.firedAt ?? '') })}
                </span>
              </li>
            )
          })}
        </ul>
      )}

      <AttachPanel
        open={attaching}
        instrument={instrument}
        displayName={displayName}
        automations={automations}
        t={t}
        onClose={() => { setAttaching(false) }}
      />
    </section>
  )
}
