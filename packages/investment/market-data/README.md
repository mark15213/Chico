# @deepseek-ai/dsh-market-data

English | [中文](README.zh.md)

Market-data capability seam (`ctx.marketData`) for the DeepSeek Harness: a provider registry plus provider-selecting execution for quotes and session bars. Consumers see the service and the value vocabulary; every source of prices is a provider package.

## Shape

- `ctx.marketData.registerProvider(provider)` — registers by `provider.id` and returns a disposer; a duplicate id throws `MARKET_DATA_DUPLICATE_PROVIDER` without disturbing the registered provider. Registration rides `ctx.effect`, so the calling fiber's teardown unregisters it.
- `ctx.marketData.quote(request, signal?)` — one instrument's latest observation.
- `ctx.marketData.priceHistory(request, signal?)` — one instrument's recent session bars, oldest first.

Provider selection resolves at execution time and never depends on registration order: a configured `provider` id must be registered (`MARKET_DATA_PROVIDER_CONFIGURED_MISSING`) and `available()` (`MARKET_DATA_PROVIDER_CONFIGURED_UNAVAILABLE`); with no id configured, exactly one usable provider auto-selects, none throws `MARKET_DATA_PROVIDER_UNAVAILABLE`, and several throw `MARKET_DATA_PROVIDER_AMBIGUOUS`. `available()` is consulted per call rather than cached, so a provider that loses its entitlement stops being selected without re-registration.

`maxHistorySessions` (default 500, about two trading years) bounds one provider call. A larger `sessions` request throws `MARKET_DATA_HISTORY_RANGE_REFUSED` and never reaches the provider, because a caller that asked for five years and silently received one would draw a chart that lies about its own range.

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

- **One instrument per call.** Batch quotes for a whole watchlist would be a different operation with its own partial-failure semantics; a consumer needing many quotes issues many calls until a real watchlist surface justifies the batch contract.
- **No corporate-action, index, or fundamentals vocabulary.** The seam covers prices only. Splits, dividends, index membership, and financial statements need their own seams rather than optional fields here.
- **No caching or rate limiting.** Both are provider-side or composition-side concerns today; the seam neither memoizes a quote nor throttles callers, so a consumer polling in a loop reaches the provider every time.
