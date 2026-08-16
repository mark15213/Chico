/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-market-data-mock`.
 * @module @deepseek-ai/dsh-market-data-mock/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-market-data-mock'

/** Cordis companion plugin name. */
export const name = 'market-data-mock-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: this package answers every read from a compiled,
 * immutable dataset, holds no mutable state, and emits no cordis events. That
 * the served bars equal the compiled columns is a fixed-input check the package
 * spec makes directly, not an owned relationship the registry can audit.
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
