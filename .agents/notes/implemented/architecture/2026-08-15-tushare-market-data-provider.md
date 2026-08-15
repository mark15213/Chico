# Agent Note: A Real Venue Feed Behind the Market-Data Seam

Status: implemented

English | [中文](2026-08-15-tushare-market-data-provider.zh.md)

## Problem

Chico shipped with one market-data provider, and it was a fixture: three hardcoded instruments and a closed-form price series anchored at a fixed date. The seam, the tools, the watchlist, and the workbench were all built and correct, and every number any of them showed was invented. The user asked which stock interfaces exist and picked Tushare Pro, ruling intraday out of scope — end-of-day data is what a workbench for reading and writing theses needs.

Two things blocked a real provider that the fixture had never exercised.

**`available()` could not answer.** The seam consults it per call so a provider that loses its entitlement stops being selected, and it was declared `(): boolean`. Every real answer is a credential lookup, which is asynchronous. A synchronous provider could only mirror a cached flag, refreshed on a `credentials/updated` subscription — which is precisely the stale mirror that per-call consultation exists to avoid, and it races the first request at startup.

**No code said "this provider does not reach that venue."** `MarketDataErrorCode` had a refusal for a code the venue does not list and four for provider selection, but nothing for a source that serves Shanghai and not Hong Kong.

## Decision

### `available()` returns a promise, and candidates are asked concurrently

The signature is now `available(): Promise<boolean>`, and `resolveProvider()` is async. With no id configured it asks every registered provider at once rather than in sequence, so selection costs one round of lookups instead of one per provider — availability is now I/O, and a roster the caller did not choose must not multiply its latency.

The blast radius was five files, which is what makes this the right time: the interface was written when the only implementation was a table that returns `true`.

### `MARKET_DATA_VENUE_UNSUPPORTED`, on the request side

A provider that serves some venues refuses the rest with this code. It sits with the per-request refusals rather than with the `PROVIDER_*` selection failures, because the provider was correctly selected and is correctly declining one name — so `WatchlistService.degrade` leaves that row without a price and keeps the rest of the list, which is exactly what should happen to a Hong Kong name on a mainland feed.

### The provider covers the mainland venues, end of day

`dsh-market-data-tushare` reads `stock_basic`, `daily`, and optionally `adj_factor` over Tushare's single POST endpoint. Four decisions inside it are not obvious from the API:

**Units are converted once, at the edge.** `daily` reports volume in lots, so it is multiplied by 100 to reach the shares the seam promises. `previousClose` and `changePercent` are taken from the venue's `pre_close` and `pct_chg` rather than recomputed, so they agree with what the venue published.

**`session` is always `closed` and `asOf` is the venue's close.** Tushare dates a session without timing it. Reporting the wall clock, or guessing `open` during trading hours, would let a reader believe a stale close was live.

**Restatement is configured, defaulted off.** `adj_factor` sits behind a higher Tushare point threshold than the bars. Defaulting to `backward` would break every account that has only the bars, so `adjustment` defaults to `none` and an entitled account opts in. The two directions are named for what they move — `backward` restates onto today's basis (前复权), `forward` onto the first bar's basis (后复权) — and the code says so, because the names invert the Chinese convention.

**The roster is single-flight.** Tushare has no lookup endpoint, so `search` matches locally over the full listing roster, and `quote` reads it for a display name. A watchlist prices every row at once, so without shared inflight the first glance would download the roster once per followed name. The shared fetch deliberately does not honour any one caller's `AbortSignal` — aborting it would cancel it for every reader awaiting the same promise — and the per-call time budget bounds it instead. A rejected fetch clears the inflight slot, or every later read would await a promise that already failed.

### The Chico bundle drops the fixture

`market-data-fixture` is out of `chico-web-app` and `market-data-tushare` is in. The bundle's own comment had already written down this move: *a deployment that must not present synthetic prices as real disables this row when it adds a feed.* Without a token the provider reports itself unusable, no provider is selectable, and every read fails with `MARKET_DATA_PROVIDER_UNAVAILABLE` — a loud, actionable failure rather than a column of dashes over a composition that cannot price anything.

The token is a credential reference (`TUSHARE_TOKEN`), never a value in a shipped file, resolved per operation through the credentials seam the base bundle mounts.

## Alternatives considered

**Keeping `available()` synchronous and caching the credential answer.** Rejected: the cache needs a `credentials/updated` subscription in every credentialed provider, and it still races the first request before the initial probe resolves. Async moves the fix into the seam once instead of into every implementation forever.

**Returning `true` unconditionally and letting the token failure surface at request time.** Works while Tushare is the only provider and breaks the moment there are two: the fixture is always available, so a composition holding both would call selection ambiguous rather than picking the configured feed.

**Shipping both providers in the bundle with `provider` pinned to `tushare`.** Rejected: the fixture would be dead weight in the product composition, and a missing token would report `CONFIGURED_UNAVAILABLE` — a message about the pin rather than about the token the reader actually has to supply.

**Reusing `MARKET_DATA_UNKNOWN_INSTRUMENT` for an unserved venue.** Rejected as a lie: 00700.HK is listed, and telling a reader their code does not exist would send them looking for a typo.

**Reading `trade_cal` to size the history window.** Deferred. The window is a heuristic — 1.75 calendar days per session plus a 14-day floor — which the seam permits, since a provider may return fewer sessions than asked for. A calendar read is a second call on every history request, and the heuristic has not yet cost a bar.

## Consequences

Nothing in the watchlist, the workbench, or the tools changed. They read the seam, and the seam is what gained a real implementation — which is the payoff of having built the capability seam first.

Chico now needs configuration before it shows anything. That is a real regression in first-run experience and the correct trade: the alternative is a workbench that presents invented closes as the venue's own.

`market-data-fixture` keeps its job. It backs package tests and keyless replay, where a provider whose output moved with wall time could not back a replayable snapshot.

Funds remain unreachable. `Market` is a closed set of exchanges and `Quote` describes a traded price, so an open-end fund fits neither. Serving them is a seam decision that has to happen before a provider can carry them.

## Testing

`packages/investment/market-data-tushare/tests` covers the provider against a stubbed endpoint at 100% of statements, branches, and functions: what it posts, the column-array decoding, every refusal path (non-zero code with and without a reason, non-200, transport failure, its own timeout, the caller's own cancellation handed back untranslated, four malformed bodies), unit conversion, newest-session selection whatever order the server returned, the roster's single-flight and TTL and its cleared slot after a rejection, both restatement directions and the three ways restatement is refused, venue rejection without spending a call, and the token re-read that needs no restart.

`packages/bundle/chico-web-app/tests` boots the shipped rows over a stubbed credential plane and asserts both outcomes: a configured token serves a quote through the real seam, and an absent one refuses loudly. It also asserts the composition ships no synthetic provider and no token value.

`packages/investment/market-data/tests` and `packages/investment/watchlist/tests` carry the async `available()` through their provider doubles.
