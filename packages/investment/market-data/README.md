# @deepseek-ai/dsh-market-data

English | [中文](README.zh.md)

Market-data capability seam (`ctx.marketData`) for the DeepSeek Harness: a provider registry plus provider-selecting execution for instrument lookup, quotes, and session bars. Consumers see the service and the value vocabulary; every source of prices is a provider package.

## Shape

- `ctx.marketData.registerProvider(provider)` — registers by `provider.id` and returns a disposer; a duplicate id throws `MARKET_DATA_DUPLICATE_PROVIDER` without disturbing the registered provider. Registration rides `ctx.effect`, so the calling fiber's teardown unregisters it.
- `ctx.marketData.search(request, signal?)` — the listings a typed query names, best first.
- `ctx.marketData.quote(request, signal?)` — one instrument's latest observation.
- `ctx.marketData.priceHistory(request, signal?)` — one instrument's recent session bars, oldest first.

Provider selection resolves at execution time and never depends on registration order: a configured `provider` id must be registered (`MARKET_DATA_PROVIDER_CONFIGURED_MISSING`) and `available()` (`MARKET_DATA_PROVIDER_CONFIGURED_UNAVAILABLE`); with no id configured, exactly one usable provider auto-selects, none throws `MARKET_DATA_PROVIDER_UNAVAILABLE`, and several throw `MARKET_DATA_PROVIDER_AMBIGUOUS`. `available()` is consulted per call rather than cached, so a provider that loses its entitlement stops being selected without re-registration. It is asynchronous because the usual answer is a credential lookup, and every candidate is asked at once, so selection cost does not grow with a roster the caller did not choose.

`maxHistorySessions` (default 500, about two trading years) and `maxSearchMatches` (default 20, a pick-list a person reads before choosing) each bound one provider call. A request above either ceiling throws — `MARKET_DATA_HISTORY_RANGE_REFUSED` or `MARKET_DATA_SEARCH_RANGE_REFUSED` — and never reaches the provider, because a caller that asked for five years and silently received one would draw a chart that lies about its own range, and one that asked for fifty matches and drew twenty would present a truncated list as the whole answer.

The `PROVIDER_*` codes describe the composition and would fail every request identically; a consumer reading a list raises for the whole call on those. The rest describe one request, so a list may degrade that entry alone: `MARKET_DATA_UNKNOWN_INSTRUMENT` for a code the venue does not list, and `MARKET_DATA_VENUE_UNSUPPORTED` for a venue the selected provider does not reach — a source serving Shanghai but not Hong Kong is correctly selected and correctly refuses that one name.

A `search` is identity resolution, not pricing: `InstrumentMatch` carries the instrument and its name, and a caller that then needs a price asks for a quote. A provider whose feed has no lookup endpoint rejects with `MARKET_DATA_SEARCH_UNSUPPORTED` rather than resolving empty, so a consumer can tell "nothing matched" from "this source cannot answer".

## Time and adjustment are part of the value

`Quote.asOf` is the event time the venue priced the instrument — not when the provider was asked, and not when a UI rendered it. `Quote.session` says whether the venue was open at that instant, so a stale-looking quote can be distinguished from a closed-venue one.

`PriceBar.date` is the venue's trading date rather than a timestamp, because a bar covers a session. `PriceHistory.adjustment` is required, not assumed: a consumer comparing a bar against a price recorded earlier must know whether corporate actions were restated onto today's basis (`backward`), onto the first bar's basis (`forward`), or not at all (`none`).

`InstrumentRef` is a `{ market, symbol }` pair rather than an opaque id, because both halves are meaningful to consumers and the same code under two venues is two instruments. `Market` is a closed union: settlement calendar, price limits, and lot size differ per venue, so every consumer switches on a known member instead of parsing a free string.

## Model Experience

### Market-data seam

#### What the model sees

Nothing. This package registers no tools and injects no prompts; `ctx.marketData` serves host-side consumers only. A tool package built on this seam owns its own model-facing surface.

#### Token effect

Zero direct tokens on every request.

#### KV Cache effect

Independent of live requests: the package never touches a request prefix, so it cannot invalidate provider cache reuse.

## Known Limitations and Deferred Work

- **One instrument per quote call.** Batch quotes for a whole watchlist would be a different operation with its own partial-failure semantics; a consumer needing many quotes issues many calls until a real watchlist surface justifies the batch contract.
- **Lookup is one flat list with no ranking contract.** A provider returns matches in its own order and the seam does not say what "best first" measures, so two providers can rank the same query differently and a consumer cannot compare them.
- **No corporate-action, index, or fundamentals vocabulary.** The seam covers prices only. Splits, dividends, index membership, and financial statements need their own seams rather than optional fields here.
- **No caching or rate limiting.** Both are provider-side or composition-side concerns today; the seam neither memoizes a quote nor throttles callers, so a consumer polling in a loop reaches the provider every time.
