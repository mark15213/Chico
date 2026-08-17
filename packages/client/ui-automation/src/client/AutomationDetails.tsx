import { useState, type ReactNode } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { IconChevronRightOutline14, IconGoalOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import {
  conditionSummary, directionOf, formatClock, formatPercent, scopeSummary, throttleSummary,
  type Automation, type TriggerFiring,
} from './automation-model.ts'
import { useAutomationFocus, type AutomationSelection } from './automation-store.ts'
import { DeliveredPush } from './DeliveredPush.tsx'
import css from './AutomationDetails.module.css'

/** Registration-side face the detail column calls through. */
export interface AutomationDetailsInjected {
  /** Every rule. */
  automations: readonly Automation[]
  /** Every firing, newest first. */
  firings: readonly TriggerFiring[]
  /** Which rule the page has open. */
  focus: AutomationSelection
  /** Return the column's width to the page. */
  closeDetails: () => void
}

/** Full props of the automation detail column. */
export type AutomationDetailsProps =
  PropsRuntime<'details'>
  & PropsLocale<'automation'>
  & AutomationDetailsInjected

/**
 * The detail column while the automation page holds the centre: one rule's
 * condition, what it covers, and what it has actually said today.
 *
 * The history is the point of the column. A rule's parameters can be read off
 * the card in the centre; whether it has been useful or noisy can only be read
 * from what it produced, so a hit expands to exactly the card the conversation
 * received.
 * @param props - the rules, the firings, the selection, and the collapse action.
 * @returns the column body, or its empty state before a rule is picked.
 */
export function AutomationDetails({
  automations, firings, focus, closeDetails, t,
}: AutomationDetailsProps): ReactNode {
  const selected = useAutomationFocus(focus)
  const [expanded, setExpanded] = useState<string | null>(null)
  const automation = automations.find(entry => entry.id === selected) ?? null

  if (automation === null) {
    return (
      <div className={css.column}>
        <div className={css.empty}>
          <span className={css.emptyIcon}><IconGoalOutline16 size={16} /></span>
          <p>{t('detail.none')}</p>
        </div>
      </div>
    )
  }

  const history = firings.filter(firing => firing.automationId === automation.id)

  return (
    <div className={css.column}>
      <header className={css.head}>
        <span className={css.state} data-enabled={automation.enabled ? 'true' : undefined} aria-hidden />
        <h2 className={css.title}>{automation.name}</h2>
        <button
          type="button"
          className={css.collapse}
          aria-label={t('detail.close')}
          title={t('detail.close')}
          onClick={closeDetails}
        >
          <IconChevronRightOutline14 size={14} />
        </button>
      </header>

      <div className={css.body}>
        <dl className={css.facts}>
          <div>
            <dt>{t('detail.condition')}</dt>
            <dd>{conditionSummary(automation.condition, t)}</dd>
          </div>
          <div>
            <dt>{t('detail.scope')}</dt>
            <dd>{scopeSummary(automation.scope, automation.covers.length, t)}</dd>
          </div>
          <div>
            <dt>{t('detail.throttle')}</dt>
            <dd>{throttleSummary(automation.throttle, t)}</dd>
          </div>
          <div>
            <dt>{t('detail.interpret')}</dt>
            <dd>{automation.interpret ? t('detail.interpretOn') : t('detail.interpretOff')}</dd>
          </div>
        </dl>

        <section className={css.section}>
          <h3 className={css.sectionTitle}>{t('detail.covers')}</h3>
          <ul className={css.covers}>
            {automation.covers.map(name => (
              <li key={`${name.instrument.market}:${name.instrument.symbol}`} className={css.cover}>
                <span className={css.coverName}>{name.displayName}</span>
                <span className={css.coverCode}>
                  {name.instrument.market}:{name.instrument.symbol}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className={css.section}>
          <h3 className={css.sectionTitle}>{t('detail.history')}</h3>
          {history.length === 0 ? (
            <p className={css.quiet}>{t('detail.historyEmpty')}</p>
          ) : (
            <ul className={css.history}>
              {history.map(firing => (
                <li key={firing.id}>
                  <button
                    type="button"
                    className={css.hit}
                    aria-expanded={expanded === firing.id}
                    onClick={() => { setExpanded(current => current === firing.id ? null : firing.id) }}
                  >
                    <span className={css.hitClock}>{formatClock(firing.firedAt)}</span>
                    <span className={css.hitName}>{firing.displayName}</span>
                    <span className={css.hitChange} data-direction={directionOf(firing.changePercent)}>
                      {formatPercent(firing.changePercent)}
                    </span>
                  </button>
                  {expanded === firing.id ? (
                    <div className={css.preview}>
                      <span className={css.previewLabel}>{t('detail.preview')}</span>
                      <DeliveredPush firing={firing} t={t} />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
