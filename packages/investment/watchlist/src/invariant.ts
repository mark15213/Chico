/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-watchlist`.
 * @module @deepseek-ai/dsh-watchlist/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-watchlist'

/** Cordis companion plugin name. */
export const name = 'watchlist-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: the projection stores nothing and emits no cordis
 * events — every row is derived per call from the registry and the market-data
 * seam, which own their own data. Its one owned relationship, that a row
 * degrades its quote rather than the list, is asserted by the package spec
 * against a provider that refuses one instrument.
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
