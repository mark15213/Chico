# Agent Note: Watchlist Projection and Tab

Status: implemented

English | [中文](2026-08-15-watchlist-projection-and-tab.zh.md)

## Problem

The [followed-names registry](../../../../docs/subsystems/followed-names.md) shipped with durable records, tests, and documentation, and no way to reach it. Nothing listed a followed name, nothing followed one, and no tool put it in front of a model — the capability existed and the product did not change.

A watchlist row is a name beside its price, which needs the registry and the [market-data seam](2026-08-15-market-data-capability-seam.md) at once. Neither owns the other: a record must survive a provider change, and a provider serves consumers that never heard of a watchlist. So the join had nowhere obvious to live, and putting it on either side would have been the first dependency between them.

The browser could not read either one regardless. A client bundle cannot import a Node service, so any surface needed a Remote first.

## Decision

### The join is a Consumer package, not a third seam

`packages/investment/watchlist` injects `followedNames` and `marketData` and is injected by neither. `ctx.watchlist` extends `TypertRemoteService`, so the same class is both the host service and the `watchlist` Remote namespace — the arrangement `GoalService` and `CommandRuntime` already use, rather than the separate gateway `PluginInventoryGateway` needs because the Loader is not its own service.

Rows are a presentation of the record. `followed` and `updatedAt` stay behind `ctx.followedNames`: a list of followed names has no unfollowed rows to distinguish, and no consumer wants the last-change instant. `displayName` is the recorded name rather than `Quote.name`, so a venue renaming a listing does not silently rewrite what the user follows; the two travel on the same row and can differ.

### One row degrades, the whole call does not

A quote that fails leaves its row with `quote: null`. A watchlist that vanishes because one holding cannot be priced is worse than one showing a dash, and the name that stopped trading is usually the one being looked for.

Provider *selection* failures are the exception and raise for the whole call. `MARKET_DATA_PROVIDER_CONFIGURED_MISSING`, `_CONFIGURED_UNAVAILABLE`, `_AMBIGUOUS`, and `_UNAVAILABLE` describe the composition, not an instrument: every row would degrade identically, so a screen of dashes would present a misconfigured deployment as a quiet data gap. Everything else degrades, including a failure that is not a `MarketDataError` at all — a socket hangup is about one call, not about the list.

### An unlisted code is a value, not a thrown error

`follow` takes a venue and a code, reads the quote, and records the venue's own name. Reading first proves the listing exists and supplies the name a browser cannot know.

That failure returns `{ ok: false, reason: 'unknown-instrument' }`. The gateway flattens any thrown error into `code: 'internal'` with only a message, so a thrown refusal would leave the UI unable to say what went wrong — and typing a wrong code is the single most likely thing a user does in that field. Every other failure still throws, because none of them is caused by typing.

Both writes stamp `new Date().toISOString()`. The registry takes time as a parameter so its records stay reproducible under test; this package is the caller that knows a user action happens now, and the tests assert the arc rather than the instant.

### The tab lives in the conversation view ring

`packages/client/ui-watchlist` registers one `conversation.view` entry at order 20, beside chat and trajectory. The slot is session-scoped and the watchlist is one book, the same in every session; the component reads nothing from the session snapshot, so every session shows the same rows. The ring is still the right place, because it is where a professional switches between reading a conversation and reading positions.

Every state is useful with an empty record: an empty watchlist states how to fill it rather than rendering a blank panel, and an unpriceable row reads **No quote** instead of disappearing.

Direction is carried three ways — the sign in the text, a `data-direction` attribute, and color from theme tokens — so a row survives grayscale, color vision deficiency, and a test that reads the DOM. Red is up and green is down, the convention of the market this product serves.

## Alternatives considered

**`@Remote` methods on `FollowedNamesService` plus a separate market-data Remote, joined in the browser.** Rejected: a thirty-name watchlist becomes thirty-one round trips, and the quote is the reason the row exists. Keeping both seams pure at the cost of N+1 wire calls trades the user's latency for an abstraction neither seam asked for.

**A batch `quotes(refs[])` on the market-data seam.** Rejected for now: it would be shaped by one consumer, which the packages policy forbids, and there is no second caller. A portfolio surface with the same need is what would justify it.

**A `watchlist()` method on `FollowedNamesService` with an optional `marketData` injection.** Rejected: it contradicts that package's own stated position that a consumer rendering a watchlist owns that surface, and it makes the durable registry depend on a price feed to answer a question about records.

**Returning `void` from `unfollow`.** Rejected in favor of the remaining followed count: the browser reloads either way today, but a count lets a caller reconcile without a second round trip, and a Remote method that returns nothing tells a client nothing about whether state moved.

**Model-facing watchlist tools first, then the UI.** Considered and deferred by the product owner. Tools need no Remote and would have made the capability reachable in conversation sooner, but the tab is the surface the design calls for and the tools' argument design is its own discussion.

## Consequences

`market-data` gained a `./types` subpath. Typert requires every Remote boundary type to be reachable outside the package root, and `InstrumentRef` appears in two of the three method signatures. Its `files` list now ships `lib/types/**/*.js` as well, because `types.ts` carries the `MarketDataError` class.

The watchlist reads once per mount or explicit refresh. There is no subscription and no cache, so an open tab is as stale as its last read and a thirty-name list costs thirty provider calls each time. Push and caching are their own decisions and neither is needed to make the surface usable.

A name can only be followed by code, because no symbol lookup exists. That was invisible while the registry had no surface; the add form makes it the first thing a user hits.

A row is a figure and not a way into the name. The details-column dossier the [workbench design](../../../../products/chico/workbench-design.md) specifies is the next surface, and until it exists the tab reads rather than navigates.

## Testing

`packages/investment/watchlist/tests` boots the real registry, storage, and market-data composition: the join, the recorded-versus-venue name, the omission of unfollowed records, the empty list, per-row degradation for both a seam refusal and a raw socket error, the selection failure that raises instead, the venue-resolved display name, the unlisted code as a value, the preserved `firstFollowedAt` across a re-follow, the remaining count from `unfollow`, and service withdrawal on fiber disposal.

`packages/client/ui-watchlist/tests` covers the pure derivations (sign, direction including flat, currency, the no-quote nulls, venue coverage, code normalization) and the view over a stubbed Remote face: the populated list, the direction attribute, the surviving unpriceable row, the empty state, retry after a failed read, the normalized follow request, the disabled submit for a blank code, the unlisted-code message distinct from a transport failure, the reload and cleared field after a follow, and the named row after a failed unfollow — plus view-ring registration with fiber teardown proving removal.

`packages/bundle/chico-web-app/tests` asserts the shipped patch inserts the projection with no config and the one browser row that makes it visible.
