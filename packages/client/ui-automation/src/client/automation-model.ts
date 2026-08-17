/**
 * What an automation is, and the pure derivations its columns draw. Three
 * objects, deliberately separate: a **rule** belongs to no name, a **firing**
 * belongs to one name at one instant, and a **delivery** puts that firing in
 * one conversation. One rule over twelve names fires per name and lands per
 * name, so a single object holding all three would have to lie about one of
 * them.
 */
import type { InstrumentRef } from '@deepseek-ai/dsh-api-remotes/client'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: this package's LocaleNamespaceMap merge, so TranslateNS resolves.
import type {} from './locales.ts'

/** Identifies one rule. */
export type AutomationId = string

/**
 * What makes a rule true of one name at one instant. A closed union: a fourth
 * condition is a new member with its own parameters, never an optional field
 * bolted onto an existing one.
 */
export type TriggerCondition =
  /** Change against the previous close, the figure every quote already carries. */
  | { readonly kind: 'dayChange'; readonly direction: 'up' | 'down'; readonly thresholdPercent: number }
  /**
   * Change across a trailing window. Stateful: deciding it needs the samples
   * taken over that window, which a single quote cannot answer.
   */
  | {
    readonly kind: 'windowMove'
    readonly direction: 'up' | 'down'
    readonly windowMinutes: number
    readonly thresholdPercent: number
  }
  /** A level crossed. Meaningful for one named instrument, never for a set. */
  | { readonly kind: 'priceLevel'; readonly direction: 'above' | 'below'; readonly price: number }

/**
 * Which names a rule watches. `posture` reads the name record's stance, so a
 * holdings rule follows the book without a second list to maintain.
 */
export type AutomationScope =
  | { readonly kind: 'watchlist' }
  | { readonly kind: 'posture'; readonly posture: 'holding' }
  | { readonly kind: 'names'; readonly instruments: readonly InstrumentRef[] }

/**
 * What keeps one rule from filling a conversation. A threshold crossed back
 * and forth is one event to a reader and many to a comparison, so both bounds
 * are part of the rule rather than a global the user cannot see.
 */
export interface AutomationThrottle {
  /**
   * Minutes before the same name may fire again, or null for once per trading
   * day.
   */
  readonly perNameCooldownMinutes: number | null
  /** Deliveries this rule may make in one day across every name it covers. */
  readonly dailyCap: number
}

/** One name a rule currently covers, resolved for display. */
export interface CoveredName {
  readonly instrument: InstrumentRef
  readonly displayName: string
}

/** One rule, with the coverage and today's count its columns report. */
export interface Automation {
  readonly id: AutomationId
  readonly name: string
  readonly condition: TriggerCondition
  readonly scope: AutomationScope
  readonly throttle: AutomationThrottle
  /** Whether a firing also asks the model for a short read of the move. */
  readonly interpret: boolean
  /** Whether the engine evaluates this rule at all. */
  readonly enabled: boolean
  /** The names the scope resolves to right now. */
  readonly covers: readonly CoveredName[]
  /** Deliveries made today, against `throttle.dailyCap`. */
  readonly firedToday: number
}

/** One rule proving true of one name at one instant. */
export interface TriggerFiring {
  readonly id: string
  readonly automationId: AutomationId
  readonly automationName: string
  readonly instrument: InstrumentRef
  readonly displayName: string
  /** ISO-8601 instant the condition was decided. */
  readonly firedAt: string
  /** The observation the decision was made on. */
  readonly last: number
  readonly changePercent: number
  /** Movement across the rule's window, or null for a rule without one. */
  readonly windowMovePercent: number | null
  /** The window that movement was measured over; null exactly when the movement is. */
  readonly windowMinutes: number | null
  /** Volume against its own recent average, or null when the feed omits it. */
  readonly volumeRatio: number | null
  /** Which delivery of this rule today this one was. */
  readonly ordinalToday: number
  /** The model's read, or null when the rule does not ask for one. */
  readonly interpretation: string | null
}

/** Price direction, carried as data so a mark survives grayscale. */
export type Direction = 'up' | 'down' | 'flat'

/**
 * Direction of a signed percentage.
 * @param percent - the signed change.
 * @returns the direction token the theme keys colour off.
 */
export function directionOf(percent: number): Direction {
  if (percent > 0) return 'up'
  if (percent < 0) return 'down'
  return 'flat'
}

/**
 * A signed percentage at a fixed width, so a column of them aligns.
 * @param percent - the signed change.
 * @returns the percentage with an explicit sign and two decimals.
 */
export function formatPercent(percent: number): string {
  return `${percent > 0 ? '+' : ''}${percent.toFixed(2)}%`
}

/**
 * The clock face of an instant, in the reader's own zone.
 * @param iso - ISO-8601 instant.
 * @returns hours and minutes, zero-padded.
 */
export function formatClock(iso: string): string {
  const at = new Date(iso)
  return `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`
}

/**
 * Translate face the pure summaries read their vocabulary through: this
 * package's own namespace, so a summary cannot reach a key it does not own.
 */
export type Translate = TranslateNS<'automation'>

/**
 * One line stating what a condition tests, in the vocabulary of the market
 * rather than of the union that models it.
 * @param condition - the rule's condition.
 * @param t - the package's bound translate.
 * @returns the summary line.
 */
export function conditionSummary(condition: TriggerCondition, t: Translate): string {
  switch (condition.kind) {
    case 'dayChange':
      return t(`condition.dayChange.${condition.direction}`, { percent: condition.thresholdPercent })
    case 'windowMove':
      return t(`condition.windowMove.${condition.direction}`, {
        minutes: condition.windowMinutes,
        percent: condition.thresholdPercent,
      })
    case 'priceLevel':
      return t(`condition.priceLevel.${condition.direction}`, { price: condition.price })
    default:
      return assertNever(condition)
  }
}

/**
 * One line naming which names a rule watches.
 * @param scope - the rule's coverage.
 * @param count - how many names it currently resolves to.
 * @param t - the package's bound translate.
 * @returns the summary line.
 */
export function scopeSummary(scope: AutomationScope, count: number, t: Translate): string {
  switch (scope.kind) {
    case 'watchlist':
      return t('scope.watchlist', { count })
    case 'posture':
      return t('scope.holding', { count })
    case 'names':
      return t('scope.names', { count })
    default:
      return assertNever(scope)
  }
}

/**
 * One line stating how often a rule may speak.
 * @param throttle - the rule's bounds.
 * @param t - the package's bound translate.
 * @returns the summary line.
 */
export function throttleSummary(throttle: AutomationThrottle, t: Translate): string {
  const perName = throttle.perNameCooldownMinutes === null
    ? t('throttle.daily')
    : t('throttle.cooldown', { minutes: throttle.perNameCooldownMinutes })
  return t('throttle.line', { perName, cap: throttle.dailyCap })
}

/**
 * Whether a rule watches one named instrument.
 * @param automation - the rule.
 * @param instrument - the name to test.
 * @returns true when the rule's resolved coverage contains it.
 */
export function covers(automation: Automation, instrument: InstrumentRef): boolean {
  return automation.covers.some(name =>
    name.instrument.market === instrument.market && name.instrument.symbol === instrument.symbol)
}

/**
 * The enabled rules watching one name.
 * @param automations - every rule.
 * @param instrument - the name in question, or null for no name at all.
 * @returns the rules a strip above that name's conversation should list.
 */
export function watching(
  automations: readonly Automation[],
  instrument: InstrumentRef | null,
): readonly Automation[] {
  if (instrument === null) return []
  return automations.filter(automation => automation.enabled && covers(automation, instrument))
}

/**
 * The firings recorded against one name, newest first.
 * @param firings - every firing.
 * @param instrument - the name in question, or null for no name at all.
 * @returns that name's firings.
 */
export function firingsFor(
  firings: readonly TriggerFiring[],
  instrument: InstrumentRef | null,
): readonly TriggerFiring[] {
  if (instrument === null) return []
  return firings.filter(firing =>
    firing.instrument.market === instrument.market && firing.instrument.symbol === instrument.symbol)
}

/** Closed-union exhaustiveness. */
function assertNever(value: never): never {
  throw new Error(`unreachable automation variant: ${JSON.stringify(value)}`)
}
