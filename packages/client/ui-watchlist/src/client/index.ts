/**
 * Browser watchlist plugin contributing one entry to the conversation view
 * ring. The tab is not session-scoped data — the watchlist is one book, the
 * same in every session — but it lives in the ring because that is where a
 * professional switches between reading a conversation and reading positions.
 */
import type { InstrumentRef } from '@deepseek-ai/dsh-api-remotes/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: the 'conversation.view' SlotMap row (declared by the slot's
// owning package) must be in the program for the register call to type.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { WatchlistView, type WatchlistViewInjected } from './WatchlistView.tsx'
import { en, NS, zh, type WatchlistLocaleKey } from './locales.ts'

export type { WatchlistViewInjected, WatchlistViewProps } from './WatchlistView.tsx'
export type { WatchlistLocaleKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Watchlist tab copy. */
    'watchlist': WatchlistLocaleKey
  }
}

/** Services required by the view registration and the generated Remote face. */
export const inject = ['slots', 'locale', 'remote', 'remote.watchlist']

/**
 * Client plugin body: register the watchlist view tab. The registration rides
 * the slot service's effect wrapper, so plugin unload removes the tab.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-watchlist: dictionaries')
  // Registration-time text (the view tab label) reads through the bound
  // translate as a thunk, so it follows the active locale without
  // re-registration.
  const t = ctx.locale.bind(NS)

  const list: WatchlistViewInjected['list'] = async () => {
    const result = await ctx.remote.watchlist.list()
    if (!result.ok) throw new Error(`watchlist.list failed: ${result.error.code}: ${result.error.message}`)
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
  const injected = (): WatchlistViewInjected => ({ list, follow, unfollow })

  ctx.slots.inject('conversation.view', () => ctx.slots.register({
    name: 'conversation.view',
    id: 'watchlist',
    order: 20,
    locale: NS,
    label: () => t('view.watchlist'),
    inject: injected,
  }, WatchlistView))
}
