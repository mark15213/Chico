/**
 * The investing frame's own opening for a conversation nobody has spoken in.
 *
 * It replaces the harness's Workspace hero for this frame, which is what
 * takes the Workspace out of the way: the Workspace hero holds the composer
 * inert until a project is picked, and here the name is already the unit of
 * work. What it says is which name the conversation is about, because that is
 * the one fact the reader needs before typing and the only thing that
 * distinguishes this blank conversation from the last one.
 */
// Type-only: pulls the conversation plugin's SlotMap merge (conversation.hero).
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { WorkbenchSelection } from './workbench-store.ts'
import { useWorkbenchFocus } from './workbench-store.ts'
import css from './InvestingHero.module.css'

/** Business share the registration hands this opening. */
export interface InvestingHeroInjected {
  /** The open name, shared with the other two columns. */
  focus: WorkbenchSelection
}

/** Full props of the investing frame's conversation opening. */
export type InvestingHeroProps =
  PropsRuntime<'conversation.hero'> & InvestingHeroInjected & PropsLocale<'watchlist'>

/**
 * The line above a blank investing conversation.
 * @param props - the open name and the locale seat.
 * @returns the opening, or nothing before a name is open.
 */
export function InvestingHero({ focus, t }: InvestingHeroProps) {
  const { instrument, displayName } = useWorkbenchFocus(focus)
  if (instrument === null) return <p className={css.prompt}>{t('hero.noName')}</p>
  // The code, not a blank heading, when the clicked surface had no name for
  // it: a listing the venue has not named is still one the reader can ask about.
  const heading = displayName === null || displayName === ''
    ? `${instrument.market}:${instrument.symbol}`
    : displayName
  return (
    <div className={css.hero}>
      <h2 className={css.name}>{heading}</h2>
      <p className={css.prompt}>{t('hero.prompt')}</p>
    </div>
  )
}
