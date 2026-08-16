/**
 * The investing frame: what Chico adds to the harness frame.
 *
 * It registers one navigation frame in the sidebar (`sidebar.mode`, id
 * `names`), one detail panel keyed to that frame (`details`), and that
 * frame's own blank-conversation opening (`conversation.hero`). Switching to
 * the frame swaps the left column to the followed names, the right column to
 * the open name's record, and the centre column's opening to the name being
 * discussed — which is what keeps a conversation about a stock out of the
 * Workspace flow. The conversation body itself stays ui-conversation's.
 *
 * Both columns share two plugin-owned observables — the rows and the open
 * name. Neither can be a slot store handle: a handle carries one scope, the
 * sidebar is root-scoped and the details column is session-scoped, and both
 * values are neither. They are one book and one selection, the same in every
 * session.
 */
import type { InstrumentRef, SessionId, WatchlistSnapshot } from '@deepseek-ai/dsh-api-remotes/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// The layout service opens the record column; its SlotMap merge also declares
// the 'details' row these registrations need.
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
// The conversation plugin declares the frame-keyed opening this package fills.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
// The price-series row declares the chart seat this package fills.
import type {} from '@deepseek-ai/dsh-client-ui-tool/client'
import { WorkbenchChart } from './chart/WorkbenchChart.tsx'
import { InvestingHero, type InvestingHeroInjected } from './InvestingHero.tsx'
import { NamesFrame, type NamesFrameInjected } from './NamesFrame.tsx'
import { RecordPanel, type RecordPanelInjected } from './RecordPanel.tsx'
import { WatchlistFeed } from './watchlist-store.ts'
import { WorkbenchFocus, type WorkbenchSelection } from './workbench-store.ts'
import { WorkbenchSessions } from './workbench-sessions.ts'
import { en, NS, zh, type WatchlistLocaleKey } from './locales.ts'

export type { InvestingHeroInjected, InvestingHeroProps } from './InvestingHero.tsx'
export { InvestingHero } from './InvestingHero.tsx'
export type { NamesFrameInjected, NamesFrameProps } from './NamesFrame.tsx'
export type { RecordPanelInjected, RecordPanelProps } from './RecordPanel.tsx'
export type { WatchlistSource, WatchlistState } from './watchlist-store.ts'
export { useWatchlist, WatchlistFeed } from './watchlist-store.ts'
export type { WorkbenchFocusState, WorkbenchSelection } from './workbench-store.ts'
export { useWorkbenchFocus, WorkbenchFocus } from './workbench-store.ts'
export type { ProChartProps } from './chart/ProChart.tsx'
export { ProChart } from './chart/ProChart.tsx'
export type { WorkbenchChartProps } from './chart/WorkbenchChart.tsx'
export { WorkbenchChart } from './chart/WorkbenchChart.tsx'
export { WorkbenchSessions } from './workbench-sessions.ts'
export type { WatchlistLocaleKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Name workbench copy. */
    'watchlist': WatchlistLocaleKey
  }
}

/**
 * The frame id this package registers under. The sidebar switch and the
 * details column both key off it, which is what keeps the two columns
 * describing the same thing.
 */
export const NAMES_MODE = 'names'

/** Services required by the registrations and the generated Remote faces. */
export const inject = [
  'slots', 'locale', 'layout', 'sessions', 'remote', 'remote.watchlist', 'remote.nameRecord',
]

/**
 * Client plugin body: register the names frame and the record panel over one
 * set of rows and one selection. Both registrations ride the slot service's
 * effect wrapper, so plugin unload removes both.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-watchlist: dictionaries')
  // Registration-time text (the frame switch label) reads through the bound
  // translate as a thunk, so it follows the active locale.
  const t = ctx.locale.bind(NS)

  const list = async (): Promise<WatchlistSnapshot> => {
    const result = await ctx.remote.watchlist.list()
    if (!result.ok) throw new Error(`watchlist.list failed: ${result.error.code}: ${result.error.message}`)
    return result.value
  }
  const search: NamesFrameInjected['search'] = async (query, limit, signal) => {
    const result = await ctx.remote.watchlist.search(query, limit, signal)
    if (!result.ok) throw new Error(`watchlist.search failed: ${result.error.code}: ${result.error.message}`)
    return result.value
  }
  const follow: NamesFrameInjected['follow'] = async (instrument: InstrumentRef) => {
    const result = await ctx.remote.watchlist.follow(instrument)
    if (!result.ok) throw new Error(`watchlist.follow failed: ${result.error.code}: ${result.error.message}`)
    return result.value
  }
  const dossier: RecordPanelInjected['dossier'] = async (instrument, sessions) => {
    const result = await ctx.remote.watchlist.dossier(instrument, sessions)
    if (!result.ok) throw new Error(`watchlist.dossier failed: ${result.error.code}: ${result.error.message}`)
    return result.value
  }
  const read: RecordPanelInjected['read'] = async (instrument) => {
    const result = await ctx.remote.nameRecord.read(instrument)
    if (!result.ok) throw new Error(`nameRecord.read failed: ${result.error.code}: ${result.error.message}`)
    return result.value
  }
  const append: RecordPanelInjected['append'] = async (instrument, request) => {
    const result = await ctx.remote.nameRecord.append(instrument, request)
    if (!result.ok) throw new Error(`nameRecord.append failed: ${result.error.code}: ${result.error.message}`)
    return result.value
  }

  const bind = async (
    instrument: InstrumentRef, sessionId: SessionId,
  ): Promise<readonly SessionId[]> => {
    const result = await ctx.remote.nameRecord.bindSession(instrument, sessionId)
    if (!result.ok) throw new Error(`nameRecord.bindSession failed: ${result.error.code}: ${result.error.message}`)
    return result.value
  }

  const archive = async (): Promise<{ path: string }> => {
    const result = await ctx.remote.watchlist.archive()
    if (!result.ok) throw new Error(`watchlist.archive failed: ${result.error.code}: ${result.error.message}`)
    return result.value
  }

  const feed = new WatchlistFeed(list)
  const focus = new WorkbenchFocus()
  const conversations = new WorkbenchSessions(ctx.sessions, { read, bind, archive }, focus)

  /** Show one name: every column moves, and the record panel is revealed. */
  const openName = (instrument: InstrumentRef, displayName: string): void => {
    ctx.layout.openDetails()
    void conversations.open(instrument, displayName)
  }

  ctx.slots.inject('sidebar.mode', () => ctx.slots.register({
    name: 'sidebar.mode',
    id: NAMES_MODE,
    order: 20,
    locale: NS,
    label: () => t('mode.names'),
    inject: (): NamesFrameInjected => ({
      rows: feed,
      search,
      follow,
      focus,
      open: openName,
      openConversation: conversations.show,
      startConversation: conversations.start,
    }),
  }, NamesFrame))

  ctx.slots.inject('conversation.hero', () => ctx.slots.register({
    name: 'conversation.hero',
    key: NAMES_MODE,
    locale: NS,
    inject: (): InvestingHeroInjected => ({ focus }),
  }, InvestingHero))

  ctx.slots.inject('details', () => ctx.slots.register({
    name: 'details',
    key: NAMES_MODE,
    locale: NS,
    inject: (): RecordPanelInjected => ({
      focus,
      read,
      dossier,
      append,
      closeDetails: () => { ctx.layout.closeDetails() },
    }),
  }, RecordPanel))

  // The workbench chart on the price-series row's chart seat. Taking the seat
  // is composition-wide, but the occupant decides per conversation, so a
  // conversation about a codebase in this same app keeps the shipped candles.
  ctx.slots.inject('tool.call.priceSeries', () => ctx.slots.register({
    name: 'tool.call.priceSeries',
    locale: NS,
    inject: (): { selection: WorkbenchSelection } => ({ selection: focus }),
  }, WorkbenchChart))
}
