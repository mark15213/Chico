/**
 * The name workbench: the two columns Chico adds to the harness frame.
 *
 * It registers one navigation frame in the sidebar (`sidebar.mode`, id
 * `names`) and one detail panel keyed to that frame (`details`). Switching to
 * the frame swaps the left column to the followed names and the right column
 * to the open name's record; the centre column stays the conversation, which
 * ui-conversation owns.
 *
 * Both columns share two plugin-owned observables — the rows and the open
 * name. Neither can be a slot store handle: a handle carries one scope, the
 * sidebar is root-scoped and the details column is session-scoped, and both
 * values are neither. They are one book and one selection, the same in every
 * session.
 */
import type { InstrumentRef, WatchlistSnapshot } from '@deepseek-ai/dsh-api-remotes/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// The layout service opens the record column; its SlotMap merge also declares
// the 'details' row these registrations need.
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { NamesFrame, type NamesFrameInjected } from './NamesFrame.tsx'
import { RecordPanel, type RecordPanelInjected } from './RecordPanel.tsx'
import { WatchlistFeed } from './watchlist-store.ts'
import { WorkbenchFocus } from './workbench-store.ts'
import { en, NS, zh, type WatchlistLocaleKey } from './locales.ts'

export type { NamesFrameInjected, NamesFrameProps } from './NamesFrame.tsx'
export type { RecordPanelInjected, RecordPanelProps } from './RecordPanel.tsx'
export type { WatchlistSource, WatchlistState } from './watchlist-store.ts'
export { useWatchlist, WatchlistFeed } from './watchlist-store.ts'
export type { WorkbenchSelection } from './workbench-store.ts'
export { useWorkbenchFocus, WorkbenchFocus } from './workbench-store.ts'
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
export const inject = ['slots', 'locale', 'layout', 'remote', 'remote.watchlist', 'remote.nameRecord']

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

  const feed = new WatchlistFeed(list)
  const focus = new WorkbenchFocus()

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
      // The record column starts closed, like every details panel. Opening a
      // name has to open it: a selection that moves a column nobody can see
      // is not navigation, which is exactly how the first build read.
      revealRecord: () => { ctx.layout.openDetails() },
    }),
  }, NamesFrame))

  ctx.slots.inject('details', () => ctx.slots.register({
    name: 'details',
    key: NAMES_MODE,
    locale: NS,
    inject: (): RecordPanelInjected => ({ focus, read, dossier, append }),
  }, RecordPanel))
}
