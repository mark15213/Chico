import { useSyncExternalStore, type ReactNode } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: the selection contract; plugins collaborate through services.
import type { WorkbenchSelection } from '@deepseek-ai/dsh-client-ui-watchlist/client'
import { firingsFor, type Automation, type TriggerFiring } from './automation-model.ts'
import { DeliveredPush } from './DeliveredPush.tsx'
import css from './PushedMessages.module.css'

/** Registration-side face the delivered pushes read through. */
export interface PushedMessagesInjected {
  /** Every rule, so a delivery can name the one that produced it. */
  automations: readonly Automation[]
  /** Every firing, newest first. */
  firings: readonly TriggerFiring[]
  /** Which name the workbench has open — the subject of this conversation. */
  focus: WorkbenchSelection
}

/** Full props of the delivered pushes. */
export type PushedMessagesProps =
  PropsRuntime<'conversation.chat.foot'>
  & PropsLocale<'automation'>
  & PushedMessagesInjected

/**
 * What automations pushed into this conversation, at the tail of the
 * transcript where new content arrives.
 *
 * Deliveries run oldest first: a rule's own history column reads newest first
 * because it is a list, and the transcript is a timeline. Continuing from one
 * seeds the composer rather than sending — the reader's question is theirs to
 * write, and the draft is only the part that is the same every time.
 *
 * **Binding, not the open name, is the test**, for the same reason the strip
 * above makes it: the workbench selection says which name the frame is
 * showing, and a delivery belongs to the conversation it was delivered to. A
 * conversation is bound to its name at creation and never reassigned.
 *
 * Nothing renders in a conversation bound to no name, or bound to one no rule
 * has spoken about.
 * @param props - the rules, the firings, the open name, and the locale seat.
 * @returns the deliveries, or null when this conversation has none.
 */
export function PushedMessages({
  firings, focus, sessionId, inputActions, t,
}: PushedMessagesProps): ReactNode {
  const { instrument, sessions } = useSyncExternalStore(focus.subscribe, focus.snapshot)
  const bound = sessions.includes(sessionId)
  const delivered = bound ? firingsFor(firings, instrument) : []
  if (delivered.length === 0) return null

  const ordered = [...delivered].reverse()

  return (
    <div className={css.pushes}>
      {ordered.map(firing => (
        <DeliveredPush
          key={firing.id}
          firing={firing}
          t={t}
          onAsk={() => {
            inputActions.setDraft(t('push.askDraft', { name: firing.displayName }))
          }}
        />
      ))}
    </div>
  )
}
