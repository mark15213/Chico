# @deepseek-ai/dsh-market-data-mock

[English](README.md) | 中文

Mock 行情数据 Service Provider：十个标的、每个 500 个交易日，编译进包内，通过 [`ctx.marketData`](../market-data/README.md) 提供，不需要凭证也不访问网络。注册 id 为 `mock`。

> **本包提供的每一个价格都是合成的。** 这里没有任何一条是交易场所的记录。它用于构建、演示和测试投资界面；绝不要用在读者可能据此行动的部署里。

## 一个组合为什么会挂载它

真实行情源恰恰会在场所 API 变慢、限流或不可达时让工作台不可用——而这些都不是正在构建的界面本身。一次失败的请求就会清空自选列表、让对话拿不到报价，那是网络的性质，不是产品的性质。这个 provider 去掉了这个变量：它从内存作答，因此界面每次都能以同样的方式被操作、截图和回放。

数据集的量级、波动率和 52 周区间是对着 2026 年 8 月的真实观测校准的，所以图表画出的形状是真实的，尽管价格不是。[`mock-data/README.md`](../../../mock-data/README.md) 记录了每个锚点的来源以及序列满足的不变量。

## 它携带什么

六只个股——`SSE:600519`、`SZSE:300750`、`SSE:600036`、`SSE:688981`、`SZSE:002594`、`HKEX:00700`——以及四条作为标的寻址的基准指数：`SSE:000300`、`SSE:000001`、`SZSE:399006`、`HKEX:HSI`。其余一律以 `MARKET_DATA_UNKNOWN_INSTRUMENT` 拒绝而不是合成，因此一个本想访问真实数据源的请求会大声失败，而不是悄悄读到虚构价格。

K 线报告 `adjustment: 'none'`，这是准确而非约定俗成：编译进来的序列不携带任何公司行动，所以它们的价格按构造就是不复权的。报价报告 `session: 'closed'`——数据集是收盘后数据，无论墙上时钟指向何时。

每一次观测都归属到 `chico-mock-data` 数据集，`retrievedAt` 为 null。提供方读取的是编译进包内的生成值，而不是从外部来源采集的值，因此它如实记录这一缺失，而不是凭空造出采集时间。

`disabled: true` 会把 provider 移出选择范围，因此误挂载它的组合会以 `MARKET_DATA_PROVIDER_UNAVAILABLE` 失败，而不是把虚构收盘价当作场所自己的价格呈现出来。

## 编译进来的数据集

`src/dataset.ts` 是生成物，并已提交。修改源数据集后重新生成：

```sh
node mock-data/generate.mjs                                   # rebuild mock-data/data
node packages/investment/market-data-mock/scripts/build-dataset.mjs   # recompile this package's module
```

provider 发布的是编译后的模块，而不是在运行时读取 `mock-data/`，因为已发布的包无法访问一个只存在于本 checkout 的目录。采用列存而非 bar 对象数组：同样的 500 个交易日，源码文本约为三分之一，provider 在读取时重建 bar 对象。

## Model Experience

### Mock 行情数据

#### 模型看到什么

什么都看不到。本包不注册工具、不注入提示词；它只向 `ctx.marketData` 贡献一个 provider，面向模型的界面由构建在该接缝之上的工具包拥有。

#### Token 影响

每次请求的直接 token 开销为零。

#### KV Cache 影响

与实时请求无关：本包从不触碰请求前缀，因此不会使 provider 的缓存复用失效。

## Known Limitations and Deferred Work

- **数据集止于固定的锚定日，永不前进。** 价格永远是 2026-08-14 的，因此把它们与墙上时钟比较的界面报告的是一段随 checkout 存在时长而不断变旧的序列。
- **不含场外基金。** 源数据集里有两只，但 `Market` 是闭合联合，没有为不在任何场所交易的基金准备的成员，因此它们在这个接缝上没有地址。
- **查找只支持前缀与子串匹配。** 没有拼音，没有模糊匹配，也没有排序——表足够小，排序会是发明而不是度量。
- **窗口只能是最近的一段。** 无法表达一个结束于锚定日之前的日期区间请求；接缝没有这样的请求。
