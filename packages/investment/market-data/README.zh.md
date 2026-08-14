# @deepseek-ai/dsh-market-data

[English](README.md) | 中文

DeepSeek Harness 的行情能力接缝（`ctx.marketData`）：提供方注册表，以及为报价和日频 K 线选择提供方的执行入口。消费方只看到该服务和取值词汇；每一个价格来源都是一个提供方包。

## 形态

- `ctx.marketData.registerProvider(provider)` —— 以 `provider.id` 注册并返回 disposer；重复 id 抛出 `MARKET_DATA_DUPLICATE_PROVIDER`，且不影响已注册的提供方。注册依托 `ctx.effect`，因此调用方 fiber 的拆卸会取消注册。
- `ctx.marketData.quote(request, signal?)` —— 单个标的的最新观测值。
- `ctx.marketData.priceHistory(request, signal?)` —— 单个标的最近的日频 K 线，按日期升序。

提供方选择在执行时解析，且不依赖注册顺序：配置的 `provider` id 必须已注册（否则 `MARKET_DATA_PROVIDER_CONFIGURED_MISSING`）且 `available()`（否则 `MARKET_DATA_PROVIDER_CONFIGURED_UNAVAILABLE`）；未配置 id 时，恰好一个可用提供方将自动选中，没有则抛出 `MARKET_DATA_PROVIDER_UNAVAILABLE`，多个则抛出 `MARKET_DATA_PROVIDER_AMBIGUOUS`。`available()` 每次调用都会查询而不缓存，因此失去权限的提供方无需重新注册即会停止被选中。

`maxHistorySessions`（默认 500，约两个交易年）限定单次提供方调用的规模。超出该值的 `sessions` 请求抛出 `MARKET_DATA_HISTORY_RANGE_REFUSED` 且不会到达提供方，因为请求五年却静默拿到一年的调用方，会画出一张对自身区间撒谎的图。

## 时间和复权属于取值本身

`Quote.asOf` 是交易场所为该标的定价的事件时间——不是提供方被询问的时间，也不是界面渲染的时间。`Quote.session` 说明该时刻交易场所是否开市，因此看起来陈旧的报价能与闭市报价区分开。

`PriceBar.date` 是交易场所的交易日而非时间戳，因为一根 K 线覆盖的是一个交易日。`PriceHistory.adjustment` 是必填而非默认：把某根 K 线与更早记录的价格作比较的消费方，必须知道公司行动是被重述到今天的基准（`backward`）、第一根 K 线的基准（`forward`），还是完全未重述（`none`）。

`InstrumentRef` 是 `{ market, symbol }` 组合而非不透明 id，因为两半对消费方都有意义，并且同一代码在两个交易场所属于两个标的。`Market` 是封闭联合：结算日历、涨跌幅限制和交易单位因场所而异，所以每个消费方都在已知成员上分支，而不是解析自由字符串。

## Model Experience

### 行情接缝

#### 模型看到什么

什么都看不到。本包不注册工具、不注入提示词；`ctx.marketData` 只服务宿主侧消费方。建立在该接缝之上的工具包拥有自己面向模型的表面。

#### Token 影响

每次请求的直接 token 消耗为零。

#### KV Cache 影响

与实时请求无关：本包从不触及请求前缀，因此无法使提供方的缓存复用失效。

## Known Limitations and Deferred Work

- **每次调用一个标的。** 为整个自选列表批量取价属于另一个操作，需要自己的部分失败语义；在真实的自选界面证明批量契约必要之前，需要多个报价的消费方发起多次调用。
- **没有公司行动、指数或基本面词汇。** 该接缝只覆盖价格。拆股、分红、指数成分和财务报表需要各自的接缝，而不是在这里增加可选字段。
- **没有缓存和限流。** 二者目前都属于提供方或组合层的职责；接缝既不缓存报价也不限制调用方，因此循环轮询的消费方每次都会到达提供方。
