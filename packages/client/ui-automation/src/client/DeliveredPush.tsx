import type { ReactNode } from 'react'
import { IconGoalOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { Translate, TriggerFiring } from './automation-model.ts'
import { TriggerCard } from './TriggerCard.tsx'
import css from './DeliveredPush.module.css'

/** What one delivery needs; it holds no state and reads nothing of its own. */
export interface DeliveredPushProps {
  /** The firing that was delivered. */
  firing: TriggerFiring
  /** Continue from this delivery, or absent where there is no composer to seed. */
  onAsk?: (() => void) | undefined
  /** The package's bound translate. */
  t: Translate
}

/**
 * One delivery, exactly as the conversation receives it.
 *
 * This is the single rendering of a push, so the preview in a rule's history
 * and the thing in the transcript cannot drift: a preview that showed a
 * different composition would be a claim about delivery rather than a picture
 * of it.
 *
 * It takes the assistant flow's own measure, because the reader continues from
 * it in the same breath — the point of pushing into the conversation rather
 * than into a notification tray. The attribution line above is what keeps it
 * from reading as an answer to a question nobody asked: the card states an
 * observation the rule made, and the prose under it is the model's reading of
 * that observation, in the assistant's own type.
 * @param props - the firing, the optional follow-up, and the locale seat.
 * @returns the delivery.
 */
export function DeliveredPush({ firing, onAsk, t }: DeliveredPushProps): ReactNode {
  return (
    <article className={css.push} data-push={firing.id}>
      <div className={css.attribution}>
        <span className={css.attributionIcon} aria-hidden><IconGoalOutline16 size={12} /></span>
        <span>{t('push.attribution', { name: firing.automationName })}</span>
      </div>

      <TriggerCard firing={firing} t={t} />

      {firing.interpretation === null ? null : (
        <p className={css.reading}>{firing.interpretation}</p>
      )}

      {onAsk === undefined ? null : (
        <div className={css.followUp}>
          <button type="button" className={css.ask} onClick={onAsk}>{t('push.ask')}</button>
        </div>
      )}
    </article>
  )
}
