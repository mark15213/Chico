# Market Data

English | [中文](market-data.zh.md)

The market-data seam — a [capability seam](../../.agents/notes/implemented/architecture/2026-06-13-capability-seams.md) spanning **two operations** (quote and price history) on one `ctx.marketData` service: Service Definition ([dsh-market-data](../../packages/investment/market-data), `ctx.marketData` plus the provider registry). Market data is **one optional capability**, not part of the agent-loop spine, so its vocabulary lives here rather than in [core.md](core.md). Swapping the venue feed does not change how a consumer asks for a price.

Source: [`packages/investment/market-data/src/types.ts`](../../packages/investment/market-data/src/types.ts)

## Instrument identity

An instrument is addressed by venue plus the venue's own code, not by an opaque id: both halves are meaningful to consumers, and the same code under two venues is two different instruments. `Market` is a closed union because settlement calendar, price limits, and lot size differ per venue — a consumer switches on a known member instead of parsing a free string.

```ts type-equiv
/**
 * Instrument identity. Not an opaque id: the venue and the venue's own code
 * are both meaningful to consumers, and the pair is what a provider resolves.
 * The same code under two venues is two instruments.
 */
interface InstrumentRef {
  /** Trading venue. */
  readonly market: Market
  /** The venue's own instrument code, exactly as the venue writes it. */
  readonly symbol: string
}
```

## Instrument lookup

A user knows a name far more often than a venue and a code, so the seam resolves identity before it prices anything. A match carries the instrument and its name and nothing else: a caller that then needs a price asks for a quote, and a lookup that also priced would charge every search for data most matches never use.

```ts type-equiv
/**
 * One listing a search matched. Carries identity and name only: a search
 * answers "which instrument does the user mean", and a caller that then needs
 * a price asks for a quote.
 */
interface InstrumentMatch {
  /** The matched instrument. */
  readonly instrument: InstrumentRef
  /** Display name in the venue's own language. */
  readonly name: string
}
```

The seam refuses a `limit` above the configured `maxSearchMatches` (default 20) instead of trimming it, for the same reason it refuses an over-long history: a caller that asked for fifty and drew twenty would present a truncated list as the whole answer.

A provider whose feed has no lookup endpoint rejects with `MARKET_DATA_SEARCH_UNSUPPORTED` rather than resolving empty. An empty result and an incapable source lead a consumer to opposite conclusions — "that name does not exist" against "ask somewhere else" — so they cannot share a representation.

## Quote

A quote is an observation at an instant, and the instant is part of the value. `asOf` is when the venue priced the instrument — never when the provider was asked or when a UI rendered it — so a consumer can tell a stale reading from a fresh one. `session` distinguishes a quote that will not move because the venue is closed from one that should be moving and is not.

```ts type-equiv
/** Request for one instrument's latest quote. */
interface QuoteRequest {
  /** The instrument to price. */
  readonly instrument: InstrumentRef
}
```

```ts type-equiv
/**
 * One instrument's latest observed price and the session context needed to
 * read it. Every field is as of {@link Quote.asOf}; a consumer that needs a
 * different instant asks again rather than extrapolating.
 */
interface Quote {
  /** The instrument this quote describes. */
  readonly instrument: InstrumentRef
  /** Display name in the venue's own language. */
  readonly name: string
  /** ISO-4217 code the price is denominated in. */
  readonly currency: string
  /** Last traded price. */
  readonly last: number
  /** Previous session's closing price, the reference for {@link Quote.changePercent}. */
  readonly previousClose: number
  /** Change from {@link Quote.previousClose} in percent; negative for a decline. */
  readonly changePercent: number
  /** Session volume in shares or contracts. */
  readonly volume: number
  /**
   * Event time of this observation (ISO-8601). This is when the venue priced
   * the instrument, never when the provider was asked or when a UI rendered it.
   */
  readonly asOf: string
  /**
   * Whether the venue was open at {@link Quote.asOf}. A closed-venue quote is
   * still a valid observation; it just will not change until the next session.
   */
  readonly session: 'open' | 'closed'
}
```

## Price history

A bar covers a session, so it carries a trading date rather than a timestamp. The adjustment is required on the result rather than assumed by the caller: comparing a bar against a price recorded months ago is wrong unless both sides agree on whether corporate actions were restated.

```ts type-equiv
/**
 * One trading session's price range for an instrument. `date` is the session's
 * trading date at the venue, not a timestamp, because a bar covers a session
 * rather than an instant.
 */
interface PriceBar {
  /** Trading date at the venue (ISO-8601 calendar date, `YYYY-MM-DD`). */
  readonly date: string
  /** First traded price of the session. */
  readonly open: number
  /** Highest traded price of the session. */
  readonly high: number
  /** Lowest traded price of the session. */
  readonly low: number
  /** Last traded price of the session. */
  readonly close: number
  /** Session volume in shares or contracts. */
  readonly volume: number
}
```

```ts type-equiv
/** Request for one instrument's recent session bars. */
interface PriceHistoryRequest {
  /** The instrument to read. */
  readonly instrument: InstrumentRef
  /** Number of most recent sessions to return; a provider may return fewer. */
  readonly sessions: number
}
```

```ts type-equiv
/**
 * One instrument's session bars, oldest first, with the adjustment the prices
 * carry. A consumer comparing a bar against a recorded price must know which
 * adjustment produced it, so the field is required rather than assumed.
 */
interface PriceHistory {
  /** The instrument these bars describe. */
  readonly instrument: InstrumentRef
  /** Session bars in ascending date order. */
  readonly bars: readonly PriceBar[]
  /**
   * Corporate-action adjustment applied to the prices: `none` is as-traded,
   * `backward` restates history onto today's basis, `forward` restates onto
   * the first bar's basis.
   */
  readonly adjustment: 'none' | 'backward' | 'forward'
}
```

The seam refuses a `sessions` count above the configured `maxHistorySessions` (default 500) instead of trimming it, and the refused request never reaches the provider. Silent trimming would let a caller that asked for five years draw a chart labelled five years from one year of bars.

## Providers

A provider is a source of prices, registered by id. `available()` is consulted on every call rather than cached, so a provider that loses its entitlement stops being selected without re-registering anything.

```ts type-equiv
/**
 * A market-data source. Providers are registered by id and selected at call
 * time; `available()` reports whether this provider can serve a request now
 * (credentials present, entitlement live), and is consulted per call rather
 * than cached, so a provider that loses its entitlement stops being selected.
 */
interface MarketDataProvider {
  /** Registry key; unique among market-data providers. */
  readonly id: string
  /**
   * Whether this provider can serve a request right now.
   * @returns true when the provider is usable.
   */
  available(): boolean
  /**
   * Find the listings a typed query names. A provider whose feed has no
   * lookup endpoint rejects with `MARKET_DATA_SEARCH_UNSUPPORTED` rather than
   * resolving empty, so a consumer can tell "nothing matched" from "this
   * source cannot answer".
   * @param request - the query and how many matches to return.
   * @param signal - optional cancellation signal.
   * @returns the matched listings, best first.
   */
  search(request: InstrumentSearchRequest, signal?: AbortSignal): Promise<InstrumentSearchResult>
  /**
   * Read one instrument's latest quote.
   * @param request - the instrument to price.
   * @param signal - optional cancellation signal.
   * @returns the quote observation.
   */
  quote(request: QuoteRequest, signal?: AbortSignal): Promise<Quote>
  /**
   * Read one instrument's recent session bars.
   * @param request - the instrument and how many sessions to read.
   * @param signal - optional cancellation signal.
   * @returns the bars in ascending date order with their adjustment.
   */
  priceHistory(request: PriceHistoryRequest, signal?: AbortSignal): Promise<PriceHistory>
}
```

Selection resolves at execution time and never depends on registration order. A configured `provider` id must be registered and available; with no id configured, exactly one usable provider auto-selects, none is `MARKET_DATA_PROVIDER_UNAVAILABLE`, and several is `MARKET_DATA_PROVIDER_AMBIGUOUS`. The seam refuses to guess between two usable feeds because two feeds disagreeing on a price is a fact the operator must resolve, not one the runtime may pick a winner for.

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — this section is byte-identical in both language sides of the page. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

<a id="ctxmarketdata--marketdataruntime"></a>

### `ctx.marketData` — `MarketDataRuntime`

The market-data service. Registered as `ctx.marketData` (one instance per context).

Selection semantics, resolved at execution time and never order-dependent:

- A configured id that is registered and `available()` — that provider.
- A configured id not registered — `MARKET_DATA_PROVIDER_CONFIGURED_MISSING`.
- A configured id registered but unavailable — `MARKET_DATA_PROVIDER_CONFIGURED_UNAVAILABLE`.
- No id configured, exactly one registered usable provider — that provider.
- No id configured, multiple usable providers — `MARKET_DATA_PROVIDER_AMBIGUOUS`.
- No id configured, no usable provider — `MARKET_DATA_PROVIDER_UNAVAILABLE`.

```ts cordis-catalog
/**
 * Register a market-data provider. Throws {@link MarketDataError}
 * `MARKET_DATA_DUPLICATE_PROVIDER` if its id is already registered. Returns a
 * disposer; disposed with the calling fiber.
 * @param provider - the provider; its `id` is the registry key.
 * @returns the disposer that unregisters the provider.
 */
registerProvider(provider: MarketDataProvider): () => void

/**
 * Find the listings a typed query names, through the selected provider.
 * Resolves the provider at call time; throws {@link MarketDataError} when the
 * capability cannot run, and rejects a `limit` above the configured ceiling
 * instead of trimming it, so a caller that asked for fifty and drew twenty
 * knows it was refused.
 * @param request - the query and how many matches to return.
 * @param signal - optional cancellation signal forwarded to the provider.
 * @returns the matched listings, best first.
 */
async search(request: InstrumentSearchRequest, signal?: AbortSignal): Promise<InstrumentSearchResult>

/**
 * Read one instrument's latest quote through the selected provider. Resolves
 * the provider at call time; throws {@link MarketDataError} when the
 * capability cannot run.
 * @param request - the instrument to price.
 * @param signal - optional cancellation signal forwarded to the provider.
 * @returns the quote observation.
 */
async quote(request: QuoteRequest, signal?: AbortSignal): Promise<Quote>

/**
 * Read one instrument's recent session bars through the selected provider.
 * Resolves the provider at call time; throws {@link MarketDataError} when the
 * capability cannot run, and rejects a `sessions` count above the configured
 * ceiling instead of trimming it.
 * @param request - the instrument and how many sessions to read.
 * @param signal - optional cancellation signal forwarded to the provider.
 * @returns the bars in ascending date order with their adjustment.
 */
async priceHistory(request: PriceHistoryRequest, signal?: AbortSignal): Promise<PriceHistory>
```

Source: [`packages/investment/market-data/src/index.ts:95`](../../packages/investment/market-data/src/index.ts)
<!-- END GENERATED cordis-surface -->
