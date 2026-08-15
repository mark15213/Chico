# Followed Names

English | [中文](followed-names.zh.md)

The followed-names registry: the durable record of every instrument the user has followed, and the archive directory Chico's own work lives in. It is one service over its own storage domain rather than a capability seam — there is nothing to swap a provider for.

Source: [`packages/investment/followed-names/src/types.ts`](../../packages/investment/followed-names/src/types.ts)

## Unfollowing keeps the record

The record is the point. Notes, insights, and a name's history are worth more than the flag that says whether it is on today's watchlist, so `unfollow` clears the flag and nothing else. Re-following restores everything and keeps `firstFollowedAt`, which makes the record's age the first follow rather than the latest one.

There is no delete. That matches the harness's existing stance rather than inventing an exception: sessions can be archived but not deleted, and deleting a workspace registration deliberately leaves its directory and logs alone.

```ts type-equiv
/**
 * One instrument the user has followed at some point. Unfollowing clears
 * {@link FollowedName.followed} rather than deleting the record, so notes,
 * insights, and session associations survive and re-following restores them.
 */
interface FollowedName {
  /** The instrument this record describes. */
  readonly instrument: InstrumentRef
  /** Display name as the user should see it, in the venue's own language. */
  readonly displayName: string
  /** Whether the name is currently on the watchlist. */
  readonly followed: boolean
  /** ISO-8601 instant of the first follow; never rewritten by a later re-follow. */
  readonly firstFollowedAt: string
  /** ISO-8601 instant of the last follow or unfollow. */
  readonly updatedAt: string
}
```

Records are keyed by instrument identity (`MARKET:SYMBOL`) rather than by a generated id, because the instrument *is* the identity: two records for one listing would make the watchlist ambiguous, and the same code on two venues is genuinely two names.

## The archive directory

One directory holds Chico's own work — notes, models, research output — and every Chico session runs with it as cwd, so produced files land somewhere durable and the existing produced-files surface lists and links them unchanged.

`archivePath` defaults under the harness home (`chico/archive`), beside `sessions` and `storages`, because the harness keeps all user data under one root. A relative path is refused rather than resolved against an ambient working directory.

**The directory is deliberately never registered as a Workspace.** The [workspace registry](workspace.md) adopts historical sessions only during its one-time bootstrap, after which later cwd-only sessions remain Ungrouped. An unregistered directory therefore produces no workspace row at all, which is what keeps a user from ever seeing a workspace they did not create — with no hiding mechanism and no durable format change.

## Time is a parameter

`follow` and `unfollow` take the instant to stamp rather than reading a clock. A registry that stamped its own records could not be asserted against a fixed expectation, and every caller already knows what time it means.

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — this section is byte-identical in both language sides of the page. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

<a id="ctxfollowednames--followednamesservice"></a>

### `ctx.followedNames` — `FollowedNamesService`

The followed-names service. Registered as `ctx.followedNames` (one instance per context).

```ts cordis-catalog
/**
 * Every record the registry holds, followed or not, in no guaranteed order.
 * @returns a snapshot array; iteration order is the table's own.
 */
list(): readonly FollowedName[]

/**
 * The records currently on the watchlist.
 * @returns a snapshot array of records whose `followed` is true.
 */
listFollowed(): readonly FollowedName[]

/**
 * One instrument's record, followed or not.
 * @param instrument - the instrument to look up.
 * @returns the record, or `undefined` when the instrument was never followed.
 */
get(instrument: InstrumentRef): FollowedName | undefined

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
async follow(instrument: InstrumentRef, displayName: string, now: string): Promise<FollowedName>

/**
 * Take an instrument off the watchlist without losing anything recorded
 * about it. Unfollowing an already-unfollowed name is a no-op that still
 * resolves, so a repeated action is not an error.
 * @param instrument - the instrument to unfollow.
 * @param now - ISO-8601 instant to stamp.
 * @returns the stored record.
 */
async unfollow(instrument: InstrumentRef, now: string): Promise<FollowedName>
```

Types: [InstrumentRef](market-data.md)

Source: [`packages/investment/followed-names/src/index.ts:63`](../../packages/investment/followed-names/src/index.ts)
<!-- END GENERATED cordis-surface -->
