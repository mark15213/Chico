/**
 * Followed-names registry over the real storage/domain composition: the
 * follow and re-follow arc, the decision that unfollowing keeps everything,
 * archive-path resolution, and the loud refusals.
 */
import { mkdtempSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import InvariantRegistry from '@deepseek-ai/dsh-invariants'
import Storage from '@deepseek-ai/dsh-storage'
import { MemoryMediaPool, MemoryStorageBackend } from '../../../storage/storage-domain/tests/helpers/memory-backend.ts'
import { DomainFacility } from '@deepseek-ai/dsh-storage-domain'
import FollowedNamesService, { DEFAULT_ARCHIVE_SEGMENTS, FollowedNameError } from '../src/index.ts'
import * as FollowedNamesInvariant from '../src/invariant.ts'

const instrument = { market: 'SZSE', symbol: '300750' } as const
const other = { market: 'SSE', symbol: '600519' } as const

const T1 = '2026-08-14T07:00:00.000Z'
const T2 = '2026-08-20T07:00:00.000Z'
const T3 = '2026-09-01T07:00:00.000Z'

let roots: string[] = []

afterEach(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true })
  roots = []
})

/** A throwaway archive root outside the developer's real harness home. */
function archiveRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'dsh-followed-names-'))
  roots.push(root)
  return join(root, 'archive')
}

/** Boot the registry over the real storage/domain composition. */
async function bench(archivePath = archiveRoot()) {
  const ctx = new Context()
  await ctx.plugin(Storage)
  ctx.storage.backend.register('memory', new MemoryStorageBackend(new MemoryMediaPool()))
  const facility = new DomainFacility(ctx, { backend: 'memory', routes: {} })
  ctx.storage.mount('domain', facility)
  ctx.provide('storageDomain', facility)
  await ctx.plugin(FollowedNamesService, { archivePath }).await()
  return { ctx, archivePath }
}

describe('following and unfollowing', () => {
  it('records a followed name and lists it', async () => {
    const { ctx } = await bench()
    const record = await ctx.followedNames.follow(instrument, '宁德时代', T1)

    expect(record).toEqual({
      instrument,
      displayName: '宁德时代',
      followed: true,
      firstFollowedAt: T1,
      updatedAt: T1,
    })
    expect(ctx.followedNames.listFollowed()).toEqual([record])
    expect(ctx.followedNames.get(instrument)).toEqual(record)
  })

  it('keeps the record when a name is unfollowed', async () => {
    const { ctx } = await bench()
    await ctx.followedNames.follow(instrument, '宁德时代', T1)
    const unfollowed = await ctx.followedNames.unfollow(instrument, T2)

    expect(unfollowed.followed).toBe(false)
    expect(unfollowed.updatedAt).toBe(T2)
    // Off the watchlist, still on the record.
    expect(ctx.followedNames.listFollowed()).toEqual([])
    expect(ctx.followedNames.get(instrument)).toEqual(unfollowed)
    expect(ctx.followedNames.list()).toHaveLength(1)
  })

  it('restores everything on a re-follow and keeps the first-follow instant', async () => {
    const { ctx } = await bench()
    await ctx.followedNames.follow(instrument, '宁德时代', T1)
    await ctx.followedNames.unfollow(instrument, T2)
    const refollowed = await ctx.followedNames.follow(instrument, '宁德时代', T3)

    expect(refollowed.followed).toBe(true)
    // The first follow is the record's age; a re-follow is not a new record.
    expect(refollowed.firstFollowedAt).toBe(T1)
    expect(refollowed.updatedAt).toBe(T3)
  })

  it('treats a repeated unfollow as a no-op rather than an error', async () => {
    const { ctx } = await bench()
    await ctx.followedNames.follow(instrument, '宁德时代', T1)
    const first = await ctx.followedNames.unfollow(instrument, T2)
    const again = await ctx.followedNames.unfollow(instrument, T3)

    // The second call must not restamp: nothing changed.
    expect(again).toEqual(first)
  })

  it('keys records by instrument identity, so two venues are two records', async () => {
    const { ctx } = await bench()
    await ctx.followedNames.follow(instrument, '宁德时代', T1)
    await ctx.followedNames.follow(other, '贵州茅台', T1)
    await ctx.followedNames.follow({ market: 'HKEX', symbol: '300750' }, 'Different listing', T1)

    expect(ctx.followedNames.list()).toHaveLength(3)
  })

  it('renames in place rather than creating a second record', async () => {
    const { ctx } = await bench()
    await ctx.followedNames.follow(instrument, '宁德时代', T1)
    const renamed = await ctx.followedNames.follow(instrument, 'CATL', T2)

    expect(ctx.followedNames.list()).toHaveLength(1)
    expect(renamed.displayName).toBe('CATL')
  })
})

describe('refusals', () => {
  it('refuses a blank display name', async () => {
    const { ctx } = await bench()

    await expect(ctx.followedNames.follow(instrument, '   ', T1)).rejects
      .toThrow(expect.objectContaining({ code: 'FOLLOWED_NAME_INVALID_DISPLAY_NAME' }))
    expect(ctx.followedNames.list()).toEqual([])
  })

  it('trims a padded display name rather than storing the padding', async () => {
    const { ctx } = await bench()
    const record = await ctx.followedNames.follow(instrument, '  宁德时代  ', T1)

    expect(record.displayName).toBe('宁德时代')
  })

  it('refuses to unfollow an instrument it has no record for', async () => {
    const { ctx } = await bench()

    await expect(ctx.followedNames.unfollow(instrument, T1)).rejects
      .toThrow(expect.objectContaining({ code: 'FOLLOWED_NAME_UNKNOWN' }))
  })

  it('carries its code and a distinguishable name', () => {
    const error = new FollowedNameError('nope', 'FOLLOWED_NAME_UNKNOWN')
    expect(error.code).toBe('FOLLOWED_NAME_UNKNOWN')
    expect(error.name).toBe('FollowedNameError')
    expect(error).toBeInstanceOf(Error)
  })
})

describe('archive directory', () => {
  it('materializes the configured directory at init', async () => {
    const { archivePath } = await bench()

    expect(statSync(archivePath).isDirectory()).toBe(true)
  })

  it('defaults under the harness home rather than a second root', async () => {
    // Constructed directly: the default path is a property of the resolved
    // config, and asserting it must not create a directory in the real home.
    const ctx = new Context()
    const service = new FollowedNamesService(ctx, {})

    expect(service.archivePath.endsWith(join(...DEFAULT_ARCHIVE_SEGMENTS))).toBe(true)
  })

  it('refuses a relative archive path instead of resolving it against the cwd', () => {
    const ctx = new Context()

    expect(() => new FollowedNamesService(ctx, { archivePath: 'chico/archive' }))
      .toThrow(/must be absolute or ~-prefixed/)
  })
})

describe('followed-names invariant companion', () => {
  it('reserves package ownership under its declared companion name', async () => {
    const ctx = new Context()
    await ctx.plugin(InvariantRegistry, { enabled: true })
    const fiber = ctx.plugin(FollowedNamesInvariant)
    await fiber.await()

    expect(FollowedNamesInvariant.name).toBe('followed-names-invariant')
    expect(FollowedNamesInvariant.inject).toEqual(['invariants'])
    await fiber.dispose()
  })
})
