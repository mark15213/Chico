# Watchlist

English | [中文](watchlist.zh.md)

The watchlist projection: the browser-facing join of the [followed-names registry](followed-names.md) with quotes from the [market-data seam](market-data.md), exposed as the `watchlist` Typert Remote namespace.

Source: [`packages/investment/watchlist/src/types.ts`](../../packages/investment/watchlist/src/types.ts)

## A Consumer of two seams, not a third seam

The registry knows nothing about prices, and the market-data seam knows nothing about what a user follows. Keeping it that way is deliberate: a record survives a provider change, and a provider serves consumers that have never heard of a watchlist. A surface that shows a name beside its price needs both, so the join lives in a Consumer package that depends on each and is depended on by neither.

Rows are a presentation of the record, not the record itself. `followed` and `updatedAt` stay behind `ctx.followedNames` because a list of followed names has no unfollowed rows to distinguish and no consumer for the last-change instant.

```ts type-equiv
/**
 * One followed name as the watchlist presents it: the durable record joined
 * with the instrument's current quote.
 */
interface WatchlistRow {
  /** The instrument this row describes. */
  readonly instrument: InstrumentRef
  /**
   * The name as the record holds it. This is what the user follows by and is
   * not rewritten when a venue renames a listing, so it can differ from
   * {@link Quote.name} on the same row.
   */
  readonly displayName: string
  /** ISO-8601 instant of the first follow, which is the row's age. */
  readonly firstFollowedAt: string
  /**
   * Current quote, or `null` when the provider could not price this
   * instrument. A row that cannot be priced still belongs on the watchlist:
   * a suspended or delisted name is exactly the one a user needs to see.
   */
  readonly quote: Quote | null
}
```

## One row degrades, the whole call does not

A quote that fails degrades its own row to `quote: null`. A watchlist that disappears because one holding cannot be priced is worse than one showing a dash, and the name that stopped trading is usually the one being looked for.

Provider *selection* failures are the exception and raise for the whole call: no usable provider, a configured provider that is missing or unavailable, and an ambiguous choice are composition errors rather than facts about an instrument. Every row would degrade identically, so a watchlist of dashes would present a misconfigured deployment as a quiet data gap.

## Lookup is how a name reaches the list

`search` takes what the user typed and returns the listings it names, each marked with whether it is already followed. That flag is what makes the operation belong here rather than on the market-data seam: a picker that offers to add a name already on the list asks the user to make a mistake, and only the registry knows.

The caller passes the `limit` it will draw rather than receiving a number this package chose, because the surface rendering the list is what knows how many it can show. The seam refuses anything above its own ceiling.

An unfollowed record is reported as *not* followed. The picker is therefore also the way back to a name taken off the list: re-following restores the record with its original `firstFollowedAt`.

## Following resolves the name from the venue

`follow` takes a venue and a code and reads the quote before recording anything, which both proves the listing exists and supplies the display name. A caller does not pass a name: a user typing `SZSE:300750` does not know it, and a browser that guessed would write a wrong name into a durable record.

An unlisted code is the one failure a user causes by typing, so it travels as a value rather than a thrown error — the RPC layer flattens a thrown error into an internal failure with no machine-readable reason, which would leave a UI unable to say what went wrong.

```ts type-equiv
/**
 * Outcome of following an instrument. A code the venue does not list is the
 * one failure a user causes by typing, so it travels as a value rather than a
 * thrown error, which the RPC layer would flatten into an internal failure.
 */
type WatchlistFollowResult =
  | {
    /** The instrument was followed. */
    readonly ok: true
    /** The stored row, carrying the quote that resolved the display name. */
    readonly row: WatchlistRow
  }
  | {
    /** Nothing was recorded. */
    readonly ok: false
    /** The venue does not list this code. */
    readonly reason: 'unknown-instrument'
  }
```

Both writes stamp the current instant. The registry takes time as a parameter so its records stay reproducible under test; this projection is the caller that knows a user action happens now.

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — this section is byte-identical in both language sides of the page. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

<a id="ctxwatchlist--watchlistservice"></a>

### `ctx.watchlist` — `WatchlistService`

The watchlist service. Registered as `ctx.watchlist` (one instance per context) and reachable from a browser as the `watchlist` Remote namespace.

```ts cordis-catalog
/**
 * Every followed name with its current quote, priced concurrently.
 *
 * A quote that fails degrades its own row to `quote: null`, except when the
 * failure is provider selection, which raises for the whole call.
 * @param signal - optional cancellation signal, forwarded to each quote.
 * @returns the current rows in the registry's own order.
 * @throws {@link MarketDataError} when no usable provider can be selected.
 */
@Remote('list') async list(signal?: AbortSignal): Promise<WatchlistSnapshot>

/**
 * Find the listings a typed query names, each marked with whether it is
 * already followed. This is the path onto the watchlist: a user knows a name
 * far more often than a venue and a code.
 * @param query - what the user typed: a code, a name, or part of either.
 * @param limit - how many matches the caller will present. Passed rather
 *   than fixed here, because the surface drawing the list is what knows how
 *   many it can show; the seam refuses a limit above its own ceiling.
 * @param signal - optional cancellation signal, so a keystroke supersedes
 *   the lookup the previous one started.
 * @returns the matched listings, best first.
 * @throws {@link MarketDataError} when no usable provider can be selected,
 *   when the limit is above the seam's ceiling, or when the selected
 *   provider's feed has no lookup endpoint.
 */
@Remote('search') async search(query: string, limit: number, signal?: AbortSignal): Promise<WatchlistSearchResult>

/**
 * Follow an instrument named by venue and code, taking its display name from
 * the venue rather than from the caller. Re-following a name that was
 * unfollowed restores it with its original `firstFollowedAt`.
 * @param instrument - the venue and code to follow.
 * @param signal - optional cancellation signal for the resolving quote.
 * @returns the stored row, or the unknown-instrument outcome.
 * @throws {@link MarketDataError} when no usable provider can be selected.
 */
@Remote('follow') async follow(instrument: InstrumentRef, signal?: AbortSignal): Promise<WatchlistFollowResult>

/**
 * Take an instrument off the watchlist. The record survives, so a later
 * re-follow keeps everything recorded about the name.
 * @param instrument - the venue and code to unfollow.
 * @returns the followed count after the change, so a caller can reconcile
 *   without a second round trip.
 * @throws {@link FollowedNameError} when no record exists for the instrument.
 */
@Remote('unfollow') async unfollow(instrument: InstrumentRef): Promise<number>
```

Types: [InstrumentRef](market-data.md)

Source: [`packages/investment/watchlist/src/index.ts:63`](../../packages/investment/watchlist/src/index.ts)
<!-- END GENERATED cordis-surface -->
