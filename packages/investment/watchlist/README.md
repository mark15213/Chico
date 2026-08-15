# @deepseek-ai/dsh-watchlist

English | [中文](README.zh.md)

Watchlist projection (`ctx.watchlist`) for the DeepSeek Harness: the browser-facing join of the [followed-names registry](../followed-names/README.md) with current quotes from the [market-data seam](../market-data/README.md), exposed as the `watchlist` Typert Remote namespace.

## A Consumer, not a seam

The registry knows nothing about prices and the market-data seam knows nothing about what a user follows. A surface that shows a name beside its price needs both, so the join lives in this package rather than in either seam — neither one grows a dependency on the other, and a second surface that wants the same join reuses this one.

The rows this package returns are a presentation of the record, not the record itself: `followed` and `updatedAt` stay behind `ctx.followedNames`, because a list of followed names has no unfollowed rows to distinguish and no consumer for the last-change instant.

## An unpriceable row is still a row

A quote that fails degrades its own row to `quote: null` rather than failing the list. A suspended or delisted name is exactly the one a user needs to see, and a watchlist that disappears because one holding cannot be priced is worse than one showing a dash.

Provider *selection* failures are the exception and raise for the whole call: no usable provider, a configured provider that is missing or unavailable, and an ambiguous choice are composition errors. Every row would degrade identically, so a watchlist of dashes would hide the real cause behind what looks like missing prices.

## Lookup is how a name reaches the list

`search` takes what the user typed and returns the listings it names, each marked with whether it is already followed. That flag is what makes the operation belong here rather than on the market-data seam: a picker that offers to add a name already on the list asks the user to make a mistake, and only the registry knows.

The caller passes the `limit` it will draw rather than receiving a number this package chose, because the surface rendering the list is what knows how many it can show. The seam refuses anything above its own ceiling.

An unfollowed record is reported as *not* followed. The picker is therefore also the way back to a name taken off the list: re-following restores the record with its original `firstFollowedAt`.

## Following resolves the name from the venue

`follow` takes a venue and a code, reads the quote, and records the venue's own name for the instrument. The caller does not supply a display name, because a user who types `SZSE:300750` does not know it, and a browser that guessed one would write a wrong name into a durable record.

Reading the quote first also proves the listing exists. That failure is the one a user causes by typing, so it travels as `{ ok: false, reason: 'unknown-instrument' }` rather than as a thrown error, which the RPC layer flattens into an internal failure with no machine-readable reason.

Both writes stamp the current instant. The registry deliberately takes time as a parameter so its records stay reproducible under test; this package is the caller that knows a user action happens now.

## Model Experience

None, as the projection serves a browser surface behind `ctx.watchlist`; it registers no tools, injects no prompts, and writes no session events. A tool that puts a watchlist in front of a model owns that surface.

#### KV Cache effect

None; the package never touches a request prefix.

## Known Limitations and Deferred Work

- **Quotes are read once per call with no caching or push.** A browser refreshes by calling `list` again, so an open watchlist is as stale as its last read, and a thirty-name list costs thirty provider calls each time.
- **No model-facing tools.** The watchlist can only be changed from a UI; an agent asked to follow a name has no way to do it, which is the next piece of this surface rather than a permanent split.
- **Lookup inherits the provider's ranking with no contract over it.** `search` forwards whatever order the provider returns, so two providers can rank the same query differently and this package cannot say which is better.
- **Only lookup reaches an unfollowed record.** `list` returns followed rows, and a removed name is reachable only by searching for it again; there is no way to browse what was once followed.
