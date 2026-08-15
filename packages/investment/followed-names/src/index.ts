/**
 * Followed-names registry (`ctx.followedNames`): the durable record of every
 * instrument the user has followed, and the archive directory Chico's own work
 * lives in.
 *
 * Unfollowing clears a flag rather than deleting a record, so notes, insights,
 * and session associations survive and re-following restores them. Deletion is
 * deliberately absent, matching the harness's own stance that sessions and
 * workspace registrations are archived rather than destroyed.
 * @module @deepseek-ai/dsh-followed-names
 */

import { mkdir } from 'node:fs/promises'
import { isAbsolute, resolve } from 'node:path'
import { Context, Service } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { dshHomePath, expandHomePath } from '@deepseek-ai/dsh-home-paths'
import type { KvTable } from '@deepseek-ai/dsh-storage-domain'
import type { InstrumentRef } from '@deepseek-ai/dsh-market-data'
import { followedNamesDomainSpec } from './spec.ts'
import type { FollowedName } from './types.ts'
import { FollowedNameError } from './types.ts'

export { FollowedNameError } from './types.ts'
export type { FollowedName, FollowedNameErrorCode } from './types.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    followedNames: FollowedNamesService
  }
}

/**
 * Default archive location, under the single harness home the way `sessions`
 * and `storages` already are. A deployment that wants the directory visible or
 * synced points {@link FollowedNamesConfig.archivePath} elsewhere.
 */
export const DEFAULT_ARCHIVE_SEGMENTS = ['chico', 'archive'] as const

/** Config for the followed-names registry. */
export interface FollowedNamesConfig {
  /**
   * Directory Chico's own work lives in: notes, models, and research output.
   * Absolute, or `~`-prefixed. Omitted resolves under the harness home.
   *
   * The directory is deliberately never registered as a Workspace. The registry
   * adopts historical sessions only during its one-time bootstrap, so an
   * unregistered directory produces no workspace row and the user never sees a
   * workspace they did not create.
   */
  readonly archivePath?: string
}

/** Registry key for one instrument: the identity, not a generated id. */
function nameKey(instrument: InstrumentRef): string {
  return `${instrument.market}:${instrument.symbol}`
}

/**
 * The followed-names service. Registered as `ctx.followedNames` (one instance
 * per context).
 */
export class FollowedNamesService extends Service {
  static inject = ['storageDomain']

  /** Archive location; every field is a deployment choice, not a tunable. */
  static Config: z<FollowedNamesConfig> = z.object({
    archivePath: z.string(),
  })

  /** Resolved absolute archive directory, materialized at init. */
  readonly archivePath: string

  private table?: KvTable<string, FollowedName>

  /**
   * @param ctx - Host context carrying the storage-domain form.
   * @param config - Archive location.
   */
  constructor(ctx: Context, config: FollowedNamesConfig) {
    super(ctx, 'followedNames')
    const configured = config.archivePath
    this.archivePath = configured === undefined
      ? dshHomePath(...DEFAULT_ARCHIVE_SEGMENTS)
      : resolveArchivePath(configured)
  }

  /** Open the registry's own domain and materialize the archive directory. */
  protected async [Service.init](): Promise<void> {
    await mkdir(this.archivePath, { recursive: true })
    const domain = await this.ctx.storageDomain.open(followedNamesDomainSpec)
    this.ctx.effect(() => () => domain.close(), 'followed-names.domainClose')
    this.table = domain.table('names')
  }

  /**
   * Every record the registry holds, followed or not, in no guaranteed order.
   * @returns a snapshot array; iteration order is the table's own.
   */
  list(): readonly FollowedName[] {
    return [...this.requireTable().entries()].map(([, record]) => record)
  }

  /**
   * The records currently on the watchlist.
   * @returns a snapshot array of records whose `followed` is true.
   */
  listFollowed(): readonly FollowedName[] {
    return this.list().filter(record => record.followed)
  }

  /**
   * One instrument's record, followed or not.
   * @param instrument - the instrument to look up.
   * @returns the record, or `undefined` when the instrument was never followed.
   */
  get(instrument: InstrumentRef): FollowedName | undefined {
    return this.requireTable().get(nameKey(instrument))
  }

  /**
   * Follow an instrument, or re-follow one that was unfollowed. A re-follow
   * keeps `firstFollowedAt` and everything else the record carries, which is
   * what makes unfollowing safe.
   * @param instrument - the instrument to follow.
   * @param displayName - display name; must contain a non-whitespace character.
   * @param now - ISO-8601 instant to stamp, supplied by the caller so the
   *   registry stays free of a clock and its records stay reproducible in tests.
   * @returns the stored record.
   */
  async follow(instrument: InstrumentRef, displayName: string, now: string): Promise<FollowedName> {
    const trimmed = displayName.trim()
    if (trimmed.length === 0) {
      throw new FollowedNameError(
        'a followed name needs a display name with a non-whitespace character',
        'FOLLOWED_NAME_INVALID_DISPLAY_NAME',
      )
    }
    const key = nameKey(instrument)
    const existing = this.requireTable().get(key)
    const record: FollowedName = {
      instrument,
      displayName: trimmed,
      followed: true,
      firstFollowedAt: existing?.firstFollowedAt ?? now,
      updatedAt: now,
    }
    await this.requireTable().put(key, record)
    return record
  }

  /**
   * Take an instrument off the watchlist without losing anything recorded
   * about it. Unfollowing an already-unfollowed name is a no-op that still
   * resolves, so a repeated action is not an error.
   * @param instrument - the instrument to unfollow.
   * @param now - ISO-8601 instant to stamp.
   * @returns the stored record.
   */
  async unfollow(instrument: InstrumentRef, now: string): Promise<FollowedName> {
    const key = nameKey(instrument)
    const existing = this.requireTable().get(key)
    if (existing === undefined) {
      throw new FollowedNameError(
        `no followed-name record for ${key}`,
        'FOLLOWED_NAME_UNKNOWN',
      )
    }
    if (!existing.followed) return existing
    return this.requireTable().update(key, current => ({ ...current, followed: false, updatedAt: now }))
  }

  /** The open table, or a loud failure if a caller beat `Service.init`. */
  private requireTable(): KvTable<string, FollowedName> {
    const table = this.table
    /* v8 ignore next -- Service.init opens the table before any consumer can inject the service. */
    if (table === undefined) throw new Error('followed-names domain is not open')
    return table
  }
}

/** Expand and absolutize a configured archive path, or fail loud. */
function resolveArchivePath(configured: string): string {
  const expanded = expandHomePath(configured)
  if (!isAbsolute(expanded)) {
    throw new Error(`followed-names: archivePath must be absolute or ~-prefixed, got ${JSON.stringify(configured)}`)
  }
  return resolve(expanded)
}

export default FollowedNamesService
