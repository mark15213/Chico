/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-name-record`.
 * @module @deepseek-ai/dsh-name-record/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-name-record'

/** Cordis companion plugin name. */
export const name = 'name-record-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: the record owns one domain table keyed by instrument
 * identity and emits no cordis events of its own. Its one owned relationship,
 * that a verification settles exactly one open thesis and leaves both carrying
 * the same verdict, is asserted directly by the package spec against the
 * stored row.
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
