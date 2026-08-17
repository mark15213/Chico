import { useState, type ReactNode } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import {
  IconCloseOutline16, IconGoalOutline16, IconPauseOutline16, IconPlayOutline16, IconPlusOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import {
  conditionSummary, scopeSummary, throttleSummary, type Automation, type AutomationId,
} from './automation-model.ts'
import { useAutomationFocus, type AutomationSelection } from './automation-store.ts'
import { AutomationEditor } from './AutomationEditor.tsx'
import css from './AutomationPage.module.css'

/** Registration-side face the page calls through. */
export interface AutomationPageInjected {
  /** Every rule, in the order the user built them. */
  automations: readonly Automation[]
  /** Which rule the detail column is showing. */
  focus: AutomationSelection
  /** Open one rule in the detail column, revealing it. */
  select: (id: AutomationId) => void
}

/** Full props of the automation page. */
export type AutomationPageProps =
  PropsRuntime<'page'>
  & PropsLocale<'automation'>
  & AutomationPageInjected

/**
 * The automations page: every rule the reader owns, and the way to add one.
 *
 * It takes the centre column rather than a panel because managing rules is not
 * a conversation and not a detail of one — the reader is looking at a set, and
 * a set needs the width. The conversation stays mounted underneath, so leaving
 * returns to exactly what was there.
 * @param props - the rules, the selection, and the frame's way back.
 * @returns the page body.
 */
export function AutomationPage({
  automations, focus, select, closePage, t,
}: AutomationPageProps): ReactNode {
  const selected = useAutomationFocus(focus)
  const [composing, setComposing] = useState(false)

  return (
    <div className={css.page}>
      <header className={css.head}>
        <div className={css.headCopy}>
          <h1 className={css.title}>{t('page.title')}</h1>
          <p className={css.lede}>{t('page.lede')}</p>
        </div>
        <div className={css.headActions}>
          <button
            type="button"
            className={css.primary}
            onClick={() => { setComposing(value => !value) }}
          >
            <IconPlusOutline16 size={14} />
            {t('page.new')}
          </button>
          <button
            type="button"
            className={css.iconButton}
            aria-label={t('page.close')}
            title={t('page.close')}
            onClick={closePage}
          >
            <IconCloseOutline16 size={15} />
          </button>
        </div>
      </header>

      <p className={css.staticNote} role="note">{t('page.static')}</p>

      <div className={css.body}>
        {composing ? (
          <AutomationEditor t={t} onCancel={() => { setComposing(false) }} />
        ) : null}

        {automations.length === 0 && !composing ? (
          <div className={css.empty}>
            <span className={css.emptyIcon}><IconGoalOutline16 size={18} /></span>
            <p className={css.emptyTitle}>{t('page.empty')}</p>
            <p className={css.emptyHint}>{t('page.emptyHint')}</p>
          </div>
        ) : null}

        <ul className={css.list}>
          {automations.map(automation => (
            <li key={automation.id}>
              <div
                className={css.card}
                data-on={automation.id === selected ? 'true' : undefined}
                data-enabled={automation.enabled ? 'true' : undefined}
              >
                <button
                  type="button"
                  className={css.cardOpen}
                  aria-label={t('card.open', { name: automation.name })}
                  aria-current={automation.id === selected ? 'true' : undefined}
                  onClick={() => { select(automation.id) }}
                >
                  <span className={css.cardHead}>
                    <span className={css.state} data-enabled={automation.enabled ? 'true' : undefined} aria-hidden />
                    <span className={css.cardName}>{automation.name}</span>
                    <span className={css.stateWord}>
                      {automation.enabled ? t('card.on') : t('card.off')}
                    </span>
                  </span>
                  <span className={css.cardCondition}>{conditionSummary(automation.condition, t)}</span>
                  <span className={css.cardMeta}>
                    <span>{scopeSummary(automation.scope, automation.covers.length, t)}</span>
                    <span className={css.dot} aria-hidden>·</span>
                    <span>{t('card.firedToday', { count: automation.firedToday })}</span>
                    <span className={css.dot} aria-hidden>·</span>
                    <span>{throttleSummary(automation.throttle, t)}</span>
                    {automation.interpret ? (
                      <span className={css.tag}>{t('card.interpret')}</span>
                    ) : null}
                  </span>
                </button>
                {/* The enable control is a sibling of the open button, not a
                    child of it: a button inside a button is not a control a
                    keyboard can reach. */}
                <button
                  type="button"
                  className={css.toggle}
                  aria-label={automation.enabled ? t('card.disable') : t('card.enable')}
                  title={automation.enabled ? t('card.disable') : t('card.enable')}
                  disabled
                >
                  {automation.enabled ? <IconPauseOutline16 size={14} /> : <IconPlayOutline16 size={14} />}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
