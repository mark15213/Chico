/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-followed-names`.
 * @module @deepseek-ai/dsh-followed-names/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-followed-names'

/** Cordis companion plugin name. */
export const name = 'followed-names-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: the registry owns one domain table keyed by instrument
 * identity and emits no cordis events of its own — `domain/changed` belongs to
 * the storage layer. Its one owned relationship, that a record survives
 * unfollowing, is asserted directly by the package spec against the stored row.
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
