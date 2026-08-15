# @deepseek-ai/dsh-market-data-tushare

[English](README.md) | 中文

基于 [Tushare Pro](https://tushare.pro) API 的行情 Service Provider：为内地交易所提供收盘后 K 线、报价和标的查询，以 id `tushare` 注册在 [`ctx.marketData`](../market-data/README.md) 上。

## 它服务什么

上交所（`SSE`）、深交所（`SZSE`）和北交所（`BSE`），按 Tushare 自己的 `ts_code` 寻址——`600519.SH`、`300750.SZ`、`430047.BJ`。任何其他交易场所的请求都会在花掉一次调用之前以 `MARKET_DATA_VENUE_UNSUPPORTED` 被拒绝；Tushare 通过权限更高的另一批接口触及港股和美股，用内地接口去回答它们是错误而不是不完整。

**每一个报价都是一个收盘价。** Tushare 的 `daily` 接口是收盘后数据，因此 `session` 恒为 `closed`，`asOf` 是该交易日交易场所自身的收盘时刻——07:00Z，即上海时间 15:00。需要盘中逐笔价格的界面需要另一个提供方。

价格以交易场所的单位到达，并在此处一次性换算：`daily` 以手报告成交量，因此乘以 100 以得到接缝的 `volume` 所承诺的股数。`previousClose` 和 `changePercent` 取自交易场所自己的 `pre_close` 和 `pct_chg` 而不是重新计算，因此它们与交易场所公布的一致。

## 配置

| 键 | 默认值 | 它决定什么 |
|---|---|---|
| `tokenEnv` | `TUSHARE_TOKEN` | 持有账号 token 的凭据引用 |
| `baseURL` | `https://api.tushare.pro` | 端点 |
| `adjustment` | `none` | 返回 K 线的复权基准 |
| `rosterTtlMinutes` | `720` | 上市名册的持有时长 |
| `timeoutMs` | `15000` | 单次调用的墙钟预算 |

token 每次操作都通过 [`ctx.credentials`](../../credentials/credentials/README.md) 解析，而不是在启动时捕获，因此进程运行之后才存入的 token 无需重启即可到达下一次请求。`available()` 就是同一次查询：在没有 token 解析出来之前提供方报告自己不可用，这正是在拥有另一个数据源的组合中阻止它被自动选中的机制。

### 复权

`none` 是不复权，只需要 K 线接口。两个复权取值还会读取 Tushare 的 `adj_factor`，而它位于比 K 线**更高的积分门槛**之后，因此低于该门槛的账号必须保持 `none`——请求它够不到的复权会让整次调用失败，而不是悄悄以复权的名义返回不复权的价格。

两个方向按它们移动的对象命名，而不是按中文习惯命名：

| 取值 | 复权到 | 习惯名称 |
|---|---|---|
| `backward` | 今天的基准 | 前复权 |
| `forward` | 第一根 K 线的基准 | 后复权 |

两者都保持成交量为实际成交值，因为接缝记录的复权描述的是价格。

## 查询与名册

Tushare 没有搜索端点，因此 `search` 在完整的上市名册（`stock_basic`，仅当前上市）上本地匹配。代码从头部匹配，名称在任意位置匹配；结果按交易场所的上市顺序返回，因为 Tushare 不返回相关性信号，而发明一套排序会把猜测当作测量结果呈现。

名册是每一次搜索和每一次报价都要读的同一次调用，因此它被取一次并持有 `rosterTtlMinutes`。并发读者共享同一次抓取：自选列表会同时为每一行定价，而其中每个报价都需要一个显示名称，没有这种共享的话第一次打开就会为每个关注标的各下载一次名册。这次共享抓取刻意不响应任何单个调用方的取消——中止它会让等在同一个 promise 上的每个读者一起被取消——而是由单次调用的时间预算来限制它。

## 失败

Tushare 在响应体而不是状态行里报告拒绝：被吊销的 token 和账号积分不足的接口都以 HTTP 200 加非零 `code` 到达。这些、传输故障、超时以及无法解码的响应体，全部成为 `MARKET_DATA_PROVIDER_UNAVAILABLE`，因为它们都会让每一个标的以完全相同的方式失败——而这正是消费方对整次调用抛出而不是降级单行的依据。交易场所没有任何交易日的代码是 `MARKET_DATA_UNKNOWN_INSTRUMENT`，本提供方够不到的交易场所是 `MARKET_DATA_VENUE_UNSUPPORTED`；两者都只关乎一次请求，因此列表只降级那一条。

## Model Experience

### Tushare 行情

#### 模型看到什么

什么都看不到。本包不注册工具、不注入提示词；它向 `ctx.marketData` 贡献一个提供方，而建立在该接缝之上的模型可见表层由 [`dsh-tool-market-data`](../tool-market-data/README.md) 拥有。

#### Token 影响

每次请求零直接 token。

#### KV Cache 影响

与实时请求无关：本包从不触碰请求前缀，因此无法使提供方的缓存复用失效。

## Known Limitations and Deferred Work

- **只覆盖内地交易所。** Tushare 通过 `hk_daily` 和 `us_daily` 承载的港股与美股上市尚未实现，因此这些交易场所被拒绝而不是被服务。
- **没有盘中数据。** 只读取 `daily`。Tushare 的分钟级接口位于更高的积分门槛，并且需要第二个接缝操作，因为当前这个的单位是一根日 K 线。
- **报价一次一个标的。** `daily` 可以一次接受多个 `ts_code`，但接缝的 `quote` 寻址单个标的，因此 *n* 个关注标的的自选列表每次刷新要花掉 *n* 次调用。批量需要一个接受集合的接缝操作。
- **窗口是启发式的，不是交易日历。** 交易日按每个交易日 1.75 个自然日加 14 天下限换算成自然日请求。异常长的休市可能返回比请求更少的交易日，接缝允许这一点，但调用方无法把它与很短的上市历史区分开。真正的修法是读取 `trade_cal`。
- **没有拼音搜索。** `stock_basic` 带有 `cnspell` 列，可以让 `GZMT` 找到贵州茅台，但请求 token 无权访问的列会让整次调用失败，因此字段集保持保守。
- **基金够不到。** 开放式基金没有交易场所，有的是净值而不是成交价，因此它们放不进 `Market` 或 `Quote`。服务它们是接缝的决定，不是提供方的决定。
