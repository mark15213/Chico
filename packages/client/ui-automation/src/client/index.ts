/**
 * Automations, browser half: seven registrations over one set of rules.
 *
 * | Where | What it contributes |
 * |---|---|
 * | `investing.workbench.section` | the row above the followed names, and the way into the page |
 * | `page` (key `automation`) | the management surface, taking the centre column |
 * | `details` (key `automation`) | the open rule's condition, coverage, and hits |
 * | `conversation.session.strip` | the capsule pinned above the transcript: what watches this conversation's name |
 * | `conversation.chat.foot` | what a rule already delivered into this conversation |
 * | `investing.record.section` | the same rules in the name's own record, with the way to attach more |
 * | `investing.name.mark` | the mark on a followed name a rule covers |
 *
 * The page and its detail column share one selection. Neither can hold it —
 * the page is root-scoped and the column session-scoped, and a slot store
 * handle carries one scope — so the plugin owns it and hands both the same
 * subscription, the arrangement the name workbench uses for its own columns.
 *
 * **The rules and firings are a fixture** ({@link ./fixture.ts}). No condition
 * is evaluated and nothing is written back: the engine that decides conditions
 * and the registry that stores rules are host-side and not built yet. Every
 * component takes its data as props, so wiring replaces one module.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// The layout service opens the page; its SlotMap merge declares the `page` and
// `details` rows these registrations fill.
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
// The conversation plugin declares the pinned strip and the transcript foot
// this package fills.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
// The investing frame declares the workbench block, the record block, and the
// name mark, and publishes the open name these surfaces are about.
import type {} from '@deepseek-ai/dsh-client-ui-watchlist/client'
import { AutomationDetails, type AutomationDetailsInjected } from './AutomationDetails.tsx'
import { AutomationPage, type AutomationPageInjected } from './AutomationPage.tsx'
import { AutomationFocus } from './automation-store.ts'
import { ConversationStrip, type ConversationStripInjected } from './ConversationStrip.tsx'
import { PushedMessages, type PushedMessagesInjected } from './PushedMessages.tsx'
import { RecordSection, type RecordSectionInjected } from './RecordSection.tsx'
import { NameMark, type NameMarkInjected } from './NameMark.tsx'
import { WorkbenchEntry, AUTOMATION_PAGE, type WorkbenchEntryInjected } from './WorkbenchEntry.tsx'
import { AUTOMATIONS, FIRINGS } from './fixture.ts'
import { en, NS, zh } from './locales.ts'

export { AUTOMATION_PAGE, WorkbenchEntry } from './WorkbenchEntry.tsx'
export type { WorkbenchEntryInjected, WorkbenchEntryProps } from './WorkbenchEntry.tsx'
export { AutomationPage } from './AutomationPage.tsx'
export type { AutomationPageInjected, AutomationPageProps } from './AutomationPage.tsx'
export { AutomationEditor } from './AutomationEditor.tsx'
export type { AutomationEditorProps } from './AutomationEditor.tsx'
export { AutomationDetails } from './AutomationDetails.tsx'
export type { AutomationDetailsInjected, AutomationDetailsProps } from './AutomationDetails.tsx'
export { ConversationStrip } from './ConversationStrip.tsx'
export type { ConversationStripInjected, ConversationStripProps } from './ConversationStrip.tsx'
export { DeliveredPush } from './DeliveredPush.tsx'
export type { DeliveredPushProps } from './DeliveredPush.tsx'
export { PushedMessages } from './PushedMessages.tsx'
export type { PushedMessagesInjected, PushedMessagesProps } from './PushedMessages.tsx'
export { RecordSection } from './RecordSection.tsx'
export type { RecordSectionInjected, RecordSectionProps } from './RecordSection.tsx'
export { AttachPanel } from './AttachPanel.tsx'
export type { AttachPanelProps } from './AttachPanel.tsx'
export { NameMark } from './NameMark.tsx'
export type { NameMarkInjected, NameMarkProps } from './NameMark.tsx'
export { TriggerCard } from './TriggerCard.tsx'
export type { TriggerCardProps } from './TriggerCard.tsx'
export { AutomationFocus, useAutomationFocus } from './automation-store.ts'
export type { AutomationSelection } from './automation-store.ts'
export type {
  Automation, AutomationId, AutomationScope, AutomationThrottle, CoveredName, Direction,
  TriggerCondition, TriggerFiring, Translate,
} from './automation-model.ts'
export {
  conditionSummary, covers, directionOf, firingsFor, formatClock, formatPercent, scopeSummary,
  throttleSummary, watching,
} from './automation-model.ts'
export { AUTOMATIONS, FIRINGS } from './fixture.ts'
export type { AutomationLocaleKey } from './locales.ts'

/** Services required by the registrations. */
export const inject = ['slots', 'locale', 'layout', 'investingFocus']

/**
 * Client plugin body: register the workbench entry, the page, its detail
 * column, the pinned capsule, the delivered pushes, the record block, and
 * the followed-name mark over one set of rules and one selection. Every
 * registration rides the slot service's effect wrapper, so plugin unload
 * removes all seven.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-automation: dictionaries')

  const focus = new AutomationFocus()

  /** Show one rule: the detail column has to be revealed along with it. */
  const select: AutomationPageInjected['select'] = (id) => {
    focus.select(id)
    ctx.layout.openDetails()
  }

  ctx.slots.inject('investing.workbench.section', () => ctx.slots.register({
    name: 'investing.workbench.section',
    id: 'automation',
    order: 10,
    locale: NS,
    inject: (): WorkbenchEntryInjected => ({ automations: AUTOMATIONS }),
  }, WorkbenchEntry))

  ctx.slots.inject('page', () => ctx.slots.register({
    name: 'page',
    key: AUTOMATION_PAGE,
    locale: NS,
    inject: (): AutomationPageInjected => ({ automations: AUTOMATIONS, focus, select }),
  }, AutomationPage))

  ctx.slots.inject('details', () => ctx.slots.register({
    name: 'details',
    key: AUTOMATION_PAGE,
    locale: NS,
    inject: (): AutomationDetailsInjected => ({
      automations: AUTOMATIONS,
      firings: FIRINGS,
      focus,
      closeDetails: () => { ctx.layout.closeDetails() },
    }),
  }, AutomationDetails))

  ctx.slots.inject('conversation.session.strip', () => ctx.slots.register({
    name: 'conversation.session.strip',
    id: 'automation',
    order: 10,
    locale: NS,
    inject: (): ConversationStripInjected => ({
      automations: AUTOMATIONS,
      firings: FIRINGS,
      focus: ctx.investingFocus,
      openPage: () => { ctx.layout.openPage(AUTOMATION_PAGE) },
    }),
  }, ConversationStrip))

  // What a rule already delivered to this conversation. It rides the
  // transcript's own foot rather than a session event, because the event that
  // will carry a delivery into the log does not exist yet.
  ctx.slots.inject('conversation.chat.foot', () => ctx.slots.register({
    name: 'conversation.chat.foot',
    id: 'automation',
    order: 10,
    locale: NS,
    inject: (): PushedMessagesInjected => ({
      automations: AUTOMATIONS,
      firings: FIRINGS,
      focus: ctx.investingFocus,
    }),
  }, PushedMessages))

  ctx.slots.inject('investing.record.section', () => ctx.slots.register({
    name: 'investing.record.section',
    id: 'automation',
    order: 10,
    locale: NS,
    inject: (): RecordSectionInjected => ({ automations: AUTOMATIONS, firings: FIRINGS }),
  }, RecordSection))

  ctx.slots.inject('investing.name.mark', () => ctx.slots.register({
    name: 'investing.name.mark',
    id: 'automation',
    order: 10,
    locale: NS,
    inject: (): NameMarkInjected => ({ automations: AUTOMATIONS }),
  }, NameMark))
}
