import { useState, useSyncExternalStore, type ReactNode } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: the selection contract. A value import across plugins is
// forbidden by the client bundle's purity gate — plugins collaborate through
// cordis services, and `ctx.investingFocus` is the whole of what this needs.
import type { WorkbenchSelection } from '@deepseek-ai/dsh-client-ui-watchlist/client'
import {
  IconChevronDownOutline14, IconChevronUpOutline14, IconGoalOutline16, IconPlusOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import {
  conditionSummary, firingsFor, formatClock, watching, type Automation, type TriggerFiring,
} from './automation-model.ts'
import { AttachPanel } from './AttachPanel.tsx'
import css from './ConversationStrip.module.css'

/** Registration-side face the strip reads through. */
export interface ConversationStripInjected {
  /** Every rule. */
  automations: readonly Automation[]
  /** Every firing, newest first. */
  firings: readonly TriggerFiring[]
  /** Which name the workbench has open — the subject of this conversation. */
  focus: WorkbenchSelection
  /** Open the automations page so a listed rule can be changed. */
  openPage: () => void
}

/** Full props of the conversation strip. */
export type ConversationStripProps =
  PropsRuntime<'conversation.session.strip'>
  & PropsLocale<'automation'>
  & ConversationStripInjected

/**
 * The capsule at the top of a name's conversation: what is watching this name,
 * and how often it has spoken today.
 *
 * **Binding, not the open name, is the test.** The workbench's selection says
 * which name the investing frame is showing, which is not the same question as
 * what THIS conversation is about — reading it directly put the capsule over
 * every conversation the reader opened, including ones about a codebase. A
 * conversation is bound to its name at creation and never reassigned, so the
 * capsule appears exactly where it means something. This is the same test the
 * workbench chart makes for the same reason.
 *
 * It stays visible whenever a rule watches the name, dimmed until something
 * has fired: what is running is worth knowing before it speaks, and a control
 * that only appears after a hit cannot answer "is anything watching this?".
 * @param props - the rules, the firings, the open name, and the way to manage them.
 * @returns the capsule, or null when this conversation is about no watched name.
 */
export function ConversationStrip({
  automations, firings, focus, sessionId, openPage, t,
}: ConversationStripProps): ReactNode {
  const { instrument, displayName, sessions } = useSyncExternalStore(focus.subscribe, focus.snapshot)
  const [open, setOpen] = useState(false)
  const [attaching, setAttaching] = useState(false)
  const bound = sessions.includes(sessionId)
  const active = bound ? watching(automations, instrument) : []
  if (active.length === 0 || instrument === null || displayName === null) return null

  const today = firingsFor(firings, instrument)
  const fired = today.length > 0
  const latest = today[0]

  return (
    <div className={css.strip} data-open={open ? 'true' : undefined}>
      <button
        type="button"
        className={css.capsule}
        data-fired={fired ? 'true' : undefined}
        aria-expanded={open}
        onClick={() => { setOpen(value => !value) }}
      >
        <IconGoalOutline16 size={13} />
        <span className={css.count}>{t('strip.watching', { count: active.length })}</span>
        {fired ? (
          <>
            <span className={css.sep} aria-hidden>·</span>
            <span className={css.fired}>{t('strip.firedToday', { count: today.length })}</span>
            {latest === undefined ? null : (
              <span className={css.clock}>{formatClock(latest.firedAt)}</span>
            )}
          </>
        ) : null}
        {open ? <IconChevronUpOutline14 size={12} /> : <IconChevronDownOutline14 size={12} />}
      </button>

      {open ? (
        <div className={css.panel} aria-label={t('strip.panel', { name: displayName })}>
          <ul className={css.rules}>
            {active.map(automation => (
              <li key={automation.id} className={css.rule}>
                <span className={css.state} aria-hidden />
                <span className={css.ruleName}>{automation.name}</span>
                <span className={css.ruleCondition}>{conditionSummary(automation.condition, t)}</span>
              </li>
            ))}
          </ul>
          <div className={css.actions}>
            <button
              type="button"
              className={css.attach}
              onClick={() => { setAttaching(true) }}
            >
              <IconPlusOutline16 size={13} />
              {t('attach.open')}
            </button>
            <button type="button" className={css.manage} onClick={openPage}>{t('strip.manage')}</button>
          </div>
        </div>
      ) : null}

      <AttachPanel
        open={attaching}
        instrument={instrument}
        displayName={displayName}
        automations={automations}
        t={t}
        onClose={() => { setAttaching(false) }}
      />
    </div>
  )
}
