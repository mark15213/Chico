/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-chico-web-app`.
 * @module @deepseek-ai/dsh-chico-web-app/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-chico-web-app'

/** Cordis companion plugin name. */
export const name = 'chico-web-app-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: this bundle contributes a patch layer and an empty
 * plugin body. It emits no cordis events and owns no mutable state; what the
 * layer composes is asserted by the bundle spec against the parsed patch.
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
