/**
 * Browser watchlist plugin. It registers two surfaces over one set of rows:
 * the tab in the conversation view ring, and the pinned list above the
 * sidebar's session browser. Neither is session-scoped data — the watchlist is
 * one book, the same in every session — and both receive the same feed, so
 * following a name in the tab moves the sidebar with it.
 *
 * The sidebar registration rides `ctx.slots.inject`, so a composition without
 * `ui-sidebar` simply never gets that half.
 */
import type { InstrumentRef, WatchlistSnapshot } from '@deepseek-ai/dsh-api-remotes/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: the 'conversation.view' and 'sidebar.pinned' SlotMap rows
// (declared by the slots' owning packages) must be in the program for the
// register calls to type.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { WatchlistView, type WatchlistViewInjected } from './WatchlistView.tsx'
import { WatchlistRail, type WatchlistRailInjected } from './WatchlistRail.tsx'
import { WatchlistFeed } from './watchlist-store.ts'
import { en, NS, zh, type WatchlistLocaleKey } from './locales.ts'

export type { WatchlistViewInjected, WatchlistViewProps } from './WatchlistView.tsx'
export type { WatchlistRailInjected, WatchlistRailProps } from './WatchlistRail.tsx'
export type { WatchlistSource, WatchlistState } from './watchlist-store.ts'
export { useWatchlist, WatchlistFeed } from './watchlist-store.ts'
export type { WatchlistLocaleKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Watchlist tab and sidebar copy. */
    'watchlist': WatchlistLocaleKey
  }
}

/** Services required by the registrations and the generated Remote face. */
export const inject = ['slots', 'locale', 'remote', 'remote.watchlist']

/**
 * Client plugin body: register the watchlist tab and the pinned sidebar list
 * over one store. Both registrations ride the slot service's effect wrapper,
 * so plugin unload removes both.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-watchlist: dictionaries')
  // Registration-time text (the view tab label) reads through the bound
  // translate as a thunk, so it follows the active locale without
  // re-registration.
  const t = ctx.locale.bind(NS)

  const list = async (): Promise<WatchlistSnapshot> => {
    const result = await ctx.remote.watchlist.list()
    if (!result.ok) throw new Error(`watchlist.list failed: ${result.error.code}: ${result.error.message}`)
    return result.value
  }
  const search: WatchlistViewInjected['search'] = async (query, limit, signal) => {
    const result = await ctx.remote.watchlist.search(query, limit, signal)
    if (!result.ok) throw new Error(`watchlist.search failed: ${result.error.code}: ${result.error.message}`)
    return result.value
  }
  const dossier: WatchlistViewInjected['dossier'] = async (instrument, sessions) => {
    const result = await ctx.remote.watchlist.dossier(instrument, sessions)
    if (!result.ok) throw new Error(`watchlist.dossier failed: ${result.error.code}: ${result.error.message}`)
    return result.value
  }
  const follow: WatchlistViewInjected['follow'] = async (instrument: InstrumentRef) => {
    const result = await ctx.remote.watchlist.follow(instrument)
    if (!result.ok) throw new Error(`watchlist.follow failed: ${result.error.code}: ${result.error.message}`)
    return result.value
  }
  const unfollow: WatchlistViewInjected['unfollow'] = async (instrument: InstrumentRef) => {
    const result = await ctx.remote.watchlist.unfollow(instrument)
    if (!result.ok) throw new Error(`watchlist.unfollow failed: ${result.error.code}: ${result.error.message}`)
  }

  // One feed, both surfaces. It is not a slot store handle: a handle carries
  // one scope, and the view ring is session-scoped while the sidebar is
  // root-scoped, while the rows are neither.
  const feed = new WatchlistFeed(list)

  ctx.slots.inject('conversation.view', () => ctx.slots.register({
    name: 'conversation.view',
    id: 'watchlist',
    order: 20,
    locale: NS,
    label: () => t('view.watchlist'),
    inject: (): WatchlistViewInjected => ({ rows: feed, search, dossier, follow, unfollow }),
  }, WatchlistView))

  ctx.slots.inject('sidebar.pinned', () => ctx.slots.register({
    name: 'sidebar.pinned',
    locale: NS,
    inject: (): WatchlistRailInjected => ({ rows: feed }),
  }, WatchlistRail))
}
