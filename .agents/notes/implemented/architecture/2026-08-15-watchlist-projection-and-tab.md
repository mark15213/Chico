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

### Lookup belongs to the projection, not to the seam

`search` sits on `ctx.watchlist` as well as on the seam, and the difference is one field: each match says whether it is already followed. Only the registry knows that, and a picker that offers to add a name already on the list asks the user to make a mistake. Without the flag this method would be a pass-through worth deleting.

The caller passes the `limit` it will draw. The surface rendering the list is what knows how many it can show, and the seam already refuses anything above its own ceiling, so a number chosen here would be a third opinion nobody asked for.

An unfollowed record is reported as not followed, which makes the picker the way back to a name taken off the list — the only way, since nothing lists what was once followed.

### The browser Consumer is the investing frame

`packages/client/ui-watchlist` registers the `names` frame: followed names and their conversations on the left, the shared conversation body in the centre, and the open name's record in the keyed details column. The [frame-mode decision](2026-08-15-frame-modes-and-name-workbench.md) owns why the watchlist is not a session-scoped tab and why the ordinary session browser and tool inspector remain together under the `sessions` frame.

The projection stays independent of that presentation. `ctx.watchlist` is the Host-side data source for the names frame, and another browser Consumer can reuse it without adopting Chico's layout.

`dossier` returns the record, its quote, and its history in one call. A page assembled from three round trips shows three different instants, and a professional comparing a figure against a chart needs them to be the same observation.

### An unlisted code is a value, not a thrown error

`follow` takes a venue and a code, reads the quote, and records the venue's own name. Reading first proves the listing exists and supplies the name a browser cannot know.

That failure returns `{ ok: false, reason: 'unknown-instrument' }`. The gateway flattens any thrown error into `code: 'internal'` with only a message, so a thrown refusal would leave the UI unable to say what went wrong — and typing a wrong code is the single most likely thing a user does in that field. Every other failure still throws, because none of them is caused by typing.

Both writes stamp `new Date().toISOString()`. The registry takes time as a parameter so its records stay reproducible under test; this package is the caller that knows a user action happens now, and the tests assert the arc rather than the instant.

### One feed drives the names frame

The followed rows are one book, the same in every session, so `ui-watchlist` owns a plain observable rather than a session- or root-scoped slot store. The names column receives that observable; following a name refreshes it, and a refresh requested while another is in flight joins the existing read.

Every state is useful with an empty record: an empty watchlist states how to fill it rather than rendering a blank panel, and an unpriceable row reads **No quote** instead of disappearing.

Direction is carried three ways — the sign in the text, a `data-direction` attribute, and color from theme tokens — so a row survives grayscale, color vision deficiency, and a test that reads the DOM. Red is up and green is down, the convention of the market this product serves.

## Alternatives considered

**`@Remote` methods on `FollowedNamesService` plus a separate market-data Remote, joined in the browser.** Rejected: a thirty-name watchlist becomes thirty-one round trips, and the quote is the reason the row exists. Keeping both seams pure at the cost of N+1 wire calls trades the user's latency for an abstraction neither seam asked for.

**A batch `quotes(refs[])` on the market-data seam.** Rejected for now: it would be shaped by one consumer, which the packages policy forbids, and there is no second caller. A portfolio surface with the same need is what would justify it.

**A `watchlist()` method on `FollowedNamesService` with an optional `marketData` injection.** Rejected: it contradicts that package's own stated position that a consumer rendering a watchlist owns that surface, and it makes the durable registry depend on a price feed to answer a question about records.

**Returning `void` from `unfollow`.** Rejected in favor of the remaining followed count: the browser reloads either way today, but a count lets a caller reconcile without a second round trip, and a Remote method that returns nothing tells a client nothing about whether state moved.

**Model-facing watchlist tools first, then the browser Consumer.** Considered and deferred by the product owner. Tools need no Remote and would have made the capability reachable in conversation sooner, but the investing frame is the product surface this decision serves and the tools' argument design remains separate.

## Consequences

`market-data` gained a `./types` subpath. Typert requires every Remote boundary type to be reachable outside the package root, and `InstrumentRef` appears in two of the three method signatures. Its `files` list now ships `lib/types/**/*.js` as well, because `types.ts` carries the `MarketDataError` class.

The watchlist reads once per mount or explicit refresh. There is no provider push or cache, so an open names frame is as stale as its last read and a thirty-name list costs thirty provider calls each time. Push and caching are their own decisions and neither is needed to make the surface usable.

The picker inherits whatever order the provider returns. The seam states no ranking contract, so two providers can answer one query differently and neither this package nor the names frame can say which is better.

The names frame now reads and writes the separate name record beside the quote and chart. Entries remain manual, and no fundamentals, filings, ownership, or attribution capability contributes to the panel.

## Testing

`packages/investment/watchlist/tests` boots the real registry, storage, and market-data composition: the join, the recorded-versus-venue name, the omission of unfollowed records, the empty list, per-row degradation for both a seam refusal and a raw socket error, the selection failure that raises instead, the venue-resolved display name, the unlisted code as a value, the preserved `firstFollowedAt` across a re-follow, the remaining count from `unfollow`, and service withdrawal on fiber disposal. Lookup adds matching by code and by name, the followed flag over a followed and an unfollowed record, the empty query, and the refused over-ceiling limit.

`packages/client/ui-watchlist/tests` covers the names frame over stubbed Remote faces: followed and unpriceable rows, search and follow outcomes, stable direction semantics, refresh joining, opening a name, and registration disposal. The later [frame-mode](2026-08-15-frame-modes-and-name-workbench.md) and [conversation-opening](2026-08-15-frame-owned-conversation-opening.md) decisions own coverage of the record panel and name-bound conversation lifecycle.

`packages/bundle/chico-web-app/tests` asserts the shipped patch inserts the projection with no config and the `ui-watchlist` row that consumes it.
