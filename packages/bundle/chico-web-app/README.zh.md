# @deepseek-ai/dsh-chico-web-app

[English](README.md) | 中文

Chico 投资界面 bundle：叠加在 [`dsh-web-app`](../web-app/README.md) 之上的 patch 层，把浏览器界面变成投资工作台。它以 `chico` profile 启动——先 `dsh-base`，再 `dsh-web-app`，最后这一层——因此它是在浏览器界面之上叠加而不是替换，浏览器界面的修复无需第二次改动即可到达 Chico。

## 这一层插入了什么

| 行 | 包 | 原因 |
|---|---|---|
| `market-data` | `dsh-market-data` | 报价和 K 线所经过的能力接缝 |
| `market-data-tushare` | `dsh-market-data-tushare` | 交易场所数据源：内地交易所的收盘后数据 |
| `tool-market-data` | `dsh-tool-market-data` | `market_quote` 和 `market_history` |

浏览器名册不需要新增行。price-series 卡片属于共享的渲染意图联合，因此 `dsh-client-ui-tool` 已经把已完成的 history 调用渲染为蜡烛图——任何拥有 web 表层的组合都会随工具一起获得图表。

`market-data` 不固定 `provider`。因此选择会解析到唯一可用的那个；拥有第二个数据源的部署应在后续 patch 层增加自己的提供方行并固定 id，而不是修改这一行。

### 配置数据源

本组合需要一个 Tushare 账号 token，它以凭据引用 `TUSHARE_TOKEN` 的形式存在，绝不以取值形式出现在随包文件里。base bundle 的凭据接缝读取的任何一层都可以提供它：环境变量、`$DSH_HOME/.env`、项目 `.env`，或托管存储。没有 token 时提供方报告自己不可用，接缝以 `MARKET_DATA_PROVIDER_UNAVAILABLE` 拒绝每一次读取——这是响亮的失败而不是一列空值，因为一个无法为任何标的定价的组合是配置错误，不是数据缺失。

**本组合展示的每一个价格都是一个收盘价。** Tushare 提供收盘后数据，因此报价携带 `session: 'closed'`，`asOf` 是交易场所自身的收盘时刻。该行随包配置为 `adjustment: none`，即不复权：复权要读取 Tushare 另一个积分门槛更高的接口，拥有该权限的账号把这一行改为 `backward`，即可得到以今天为基准的历史。

`dsh-market-data-fixture` 刻意**不在**本组合中。它服务于包测试和无密钥重放；挂载它的工作台会把编造的收盘价当作交易场所自身的数据呈现。

## 这一层刻意不做什么

该层只增加能力、从不移除界面：它不禁用下层的任何一行，因为那属于 `dsh-web-app` 已经作出的界面策略决定。它也不携带任何运行时胶水——插件体为空。Chico 专有的服务属于它自己的包，那样以不同方式打补丁的组合仍然能看到它。

没有浏览器名册那一行，history 工具照样工作，并通过通用卡片渲染它的 K 线表格，而这正是 price-series 渲染意图对不具备该能力的 UI 所作的承诺。该行是改进，不是必需。

## Model Experience

Indirectly, through the `dsh-tool-market-data` rows this layer inserts, which own the model-facing tools and prompt guidance.

#### KV Cache 影响

无；bundle 自身既不组装也不发送提供方请求。

## Known Limitations and Deferred Work

- **只覆盖内地交易所。** 随包数据源服务上交所、深交所和北交所。在香港或美国上市的关注标的会被按标的拒绝，因此它的行会出现但没有价格，而不会让整个页面失败。
- **只有收盘后数据。** 这里的任何一行都无法展示盘中价格，界面目前也没有在展示位置标注一个报价是收盘价。
- **除图表外没有投资专有界面。** 关注标的、档案面板和 Today 已完成设计但尚未构建，见 [Chico 工作台设计](../../../products/chico/workbench-design.md)。
