/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-market-data-tushare`.
 * @module @deepseek-ai/dsh-market-data-tushare/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-market-data-tushare'

/** Cordis companion plugin name. */
export const name = 'market-data-tushare-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: this package emits no cordis events, and its one piece
 * of mutable state is the listing roster held inside a provider instance the
 * registry has no route to. Its relationships are with the Tushare API, whose
 * responses the transport validates per call, so there is nothing here the
 * registry could audit that the wire decoding does not already refuse.
 */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
