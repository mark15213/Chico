# Agent Note: Market Data Capability Seam

Status: implemented

English | [中文](2026-08-15-market-data-capability-seam.zh.md)

## Problem

The Chico workbench needs prices: a followed name's latest quote for the sidebar row and its recent session bars for a chart. Nothing in the harness reaches a trading venue, and the sources that could serve one differ in entitlement, coverage, adjustment convention, and licence terms.

Putting a venue client directly in a tool would fix the product to one source, and the first deployment that had to swap feeds would rewrite the tool. Prices also carry two facts that are easy to lose and expensive to lose: **when** an observation was made, and **which corporate-action adjustment** a historical price already includes. A consumer that compares an adjusted bar against a price recorded before a split gets a wrong answer with no error.

## Decision

`ctx.marketData` is a capability seam with two operations, `quote` and `priceHistory`, over a registry of named providers. It follows the [web seam](2026-06-24-web-capability-seam.md) exactly where the problems are the same — registration by id, duplicate rejection, execution-time selection that never depends on registration order, `available()` consulted per call — and departs from it only where market data differs.

### Time and adjustment are in the value, not in a convention

`Quote.asOf` is the event time the venue priced the instrument. It is not the request time and not a render time, and the JSDoc says so, because the three are routinely conflated and only one of them makes a staleness check correct. `Quote.session` reports whether the venue was open at that instant, which is what separates "this has not moved because the market is closed" from "this should be moving and is not".

`PriceBar.date` is a trading date rather than a timestamp, because a bar covers a session. `PriceHistory.adjustment` is a required result field with three members (`none`, `backward`, `forward`) rather than a request option with a default: a caller comparing a bar against a recorded price must know what it received, and a default would let one silently arrive.

### Instrument identity is a pair, not an opaque id

`InstrumentRef` is `{ market, symbol }`. The repo brands opaque cross-boundary ids, and this is deliberately not one: both halves are meaningful to every consumer, and a provider resolves the pair. `Market` is a closed union because settlement calendar, price limits, and lot size differ per venue, so consumers switch on a known member rather than parsing a free string.

### A refused range beats a trimmed one

`maxHistorySessions` (default 500) bounds one provider call. A larger `sessions` request throws `MARKET_DATA_HISTORY_RANGE_REFUSED` and never reaches the provider. Trimming would let a caller that asked for five years render a chart labelled five years from one year of bars — a wrong answer that looks right, which is the failure class the product cannot afford.

## Alternatives considered

**One `prices` operation returning both the latest value and the history.** Rejected: the two have different cost, different freshness requirements, and different cache lifetimes. A watchlist row wants a quote per name per interval; a chart wants many bars once. Fusing them makes every quote pay for bars nobody asked for.

**Extending `ctx.web` instead of a new seam.** Rejected: web providers answer "retrieve this URL" and "search this query". Market data providers answer domain questions with domain vocabulary and their own entitlement model. Sharing the service would force one selection policy across capabilities that get configured independently.

**Making `adjustment` a request option with a default.** Rejected: a default is exactly how a consumer ends up comparing prices on two bases without noticing. Requiring it on the result puts the fact where the mistake would be made.

**Branding `InstrumentRef` as an opaque id.** Rejected: the brand rule exists for ids whose internals callers must not read. Here both halves are the contract — a UI shows the symbol and a policy switches on the market.

**Trimming an over-large history request to the ceiling.** Rejected, per the decision above.

## Consequences

The seam ships with no provider, so `ctx.marketData` throws `MARKET_DATA_PROVIDER_UNAVAILABLE` until a provider package registers. That is the intended state for a seam landing ahead of its first source, and the selection tests cover it as a first-class outcome rather than a gap.

Prices only. Corporate actions, index membership, and fundamentals are absent, and adding them as optional fields here would produce a service that is several capabilities wearing one name. Each needs its own seam when a capability requires it.

No caching and no rate limiting: a consumer polling in a loop reaches the provider every time. Both belong to a provider or to the composition today, and adding either to the seam would make freshness a property of the seam rather than of the observation, which contradicts the `asOf` decision above.

## Testing

`tests/market-data.spec.ts` covers registration, duplicate rejection, disposal, every selection branch (auto, ambiguous, configured-missing, configured-unavailable, none-usable), signal forwarding, and the history ceiling at and above the limit — including that a refused range never reaches the provider.
