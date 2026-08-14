/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-market-data`.
 * @module @deepseek-ai/dsh-market-data/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-market-data'

/** Cordis companion plugin name. */
export const name = 'market-data-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: this package owns only a provider registry keyed by id
 * and a pure selection rule over it. It emits no cordis events and holds no
 * cross-plugin mutable state; registration lifetime is proved by the effect
 * disposal spec, and selection has no authoritative event stream to audit.
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
