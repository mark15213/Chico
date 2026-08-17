/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-client-ui-automation`.
 * @module @deepseek-ai/dsh-client-ui-automation/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-client-ui-automation'

/** Cordis companion plugin name. */
export const name = 'client-ui-automation-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: this package renders browser columns over rules and
 * firings it does not own. It emits no cordis events, holds no cross-plugin
 * mutable state beyond one selection observable local to its own columns, and
 * its slot registrations prove disposal through the HMR-safety spec.
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
