# 行情数据

[English](market-data.md) | 中文

行情接缝——一条[能力接缝](../../.agents/notes/implemented/architecture/2026-06-13-capability-seams.md)，在同一个 `ctx.marketData` 服务上覆盖**两个操作**（报价与历史行情）：Service Definition（[dsh-market-data](../../packages/investment/market-data)，`ctx.marketData` 及提供方注册表）。行情是**一项可选能力**，不属于 agent 主循环脊柱，因此它的词汇归属这里而不是 [core.md](core.md)。更换场所数据源不会改变消费方索取价格的方式。

来源：[`packages/investment/market-data/src/types.ts`](../../packages/investment/market-data/src/types.ts)

## 标的身份

标的以交易场所加该场所自己的代码来寻址，而不是不透明 id：两半对消费方都有意义，且同一代码在两个场所属于两个不同的标的。`Market` 是封闭联合，因为结算日历、涨跌幅限制和交易单位因场所而异——消费方在已知成员上分支，而不是解析自由字符串。

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

## 报价

报价是某一时刻的观测值，而这个时刻属于取值本身。`asOf` 是交易场所为该标的定价的时间——绝不是提供方被询问的时间或界面渲染的时间——因此消费方能区分陈旧读数和新鲜读数。`session` 则区分"因为闭市所以不会动"和"本该在动却没有动"。

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

## 历史行情

一根 K 线覆盖一个交易日，因此它携带交易日而非时间戳。复权方式是结果上的必填项而不是调用方的假设：把某根 K 线与几个月前记录的价格作比较，只有在双方对公司行动是否被重述达成一致时才成立。

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

接缝会拒绝超过配置项 `maxHistorySessions`（默认 500）的 `sessions` 请求，而不是把它截断，并且被拒绝的请求不会到达提供方。静默截断会让请求五年的调用方用一年的 K 线画出一张标着五年的图。

## 提供方

提供方是价格的来源，按 id 注册。`available()` 每次调用都会查询而不缓存，因此失去权限的提供方无需重新注册任何东西即会停止被选中。

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

选择在执行时解析，且不依赖注册顺序。配置的 `provider` id 必须已注册且可用；未配置 id 时，恰好一个可用提供方将自动选中，没有则是 `MARKET_DATA_PROVIDER_UNAVAILABLE`，多个则是 `MARKET_DATA_PROVIDER_AMBIGUOUS`。接缝拒绝在两个可用数据源之间猜测，因为两个数据源对价格不一致是运维必须解决的事实，而不是运行时可以替它挑一个赢家的事。

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

Source: [`packages/investment/market-data/src/index.ts:77`](../../packages/investment/market-data/src/index.ts)
<!-- END GENERATED cordis-surface -->
