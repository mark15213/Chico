import type { ReactNode } from 'react'
import { IconSparkle16 } from '@deepseek-ai/dsh-client-ui-primitives'
import {
  directionOf, formatClock, formatPercent, type Translate, type TriggerFiring,
} from './automation-model.ts'
import css from './TriggerCard.module.css'

/** What the card needs; it holds no state and reads nothing of its own. */
export interface TriggerCardProps {
  /** The firing to state. */
  firing: TriggerFiring
  /** The package's bound translate. */
  t: Translate
}

/**
 * The observation one rule made about one name at one instant.
 *
 * The figures are what the condition was decided on, not the current quote: a
 * card that refreshed itself would stop being a record of why the rule spoke.
 * It states nothing the model wrote — the reading belongs to
 * {@link DeliveredPush}, beside these numbers rather than inside them, because
 * one was observed and the other was written.
 *
 * The rule is not named here: every place this appears has already said which
 * rule it belongs to, above it or around it.
 * @param props - the firing and the locale seat.
 * @returns the card.
 */
export function TriggerCard({ firing, t }: TriggerCardProps): ReactNode {
  const direction = directionOf(firing.changePercent)
  return (
    <article className={css.card} data-direction={direction} data-firing={firing.id}>
      <header className={css.head}>
        <span className={css.badge} aria-hidden><IconSparkle16 size={13} /></span>
        <span className={css.clock}>{formatClock(firing.firedAt)}</span>
        <span className={css.ordinal}>{t('card.ordinal', { count: firing.ordinalToday })}</span>
      </header>

      <div className={css.figures}>
        <span className={css.name}>{firing.displayName}</span>
        <span className={css.code}>{firing.instrument.market}:{firing.instrument.symbol}</span>
        <span className={css.last}>{firing.last.toFixed(2)}</span>
        <span className={css.change} data-direction={direction}>{formatPercent(firing.changePercent)}</span>
      </div>

      <div className={css.facts}>
        {firing.windowMovePercent === null || firing.windowMinutes === null ? null : (
          <span className={css.fact}>
            {t('card.window', {
              minutes: firing.windowMinutes,
              move: formatPercent(firing.windowMovePercent),
            })}
          </span>
        )}
        {firing.volumeRatio === null ? null : (
          <span className={css.fact}>{t('card.volume', { ratio: firing.volumeRatio.toFixed(1) })}</span>
        )}
      </div>

    </article>
  )
}
