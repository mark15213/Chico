# @deepseek-ai/dsh-chico-web-app

[English](README.md) | 中文

Chico 投资界面 bundle：叠加在 [`dsh-web-app`](../web-app/README.md) 之上的 patch 层，把浏览器界面变成投资工作台。它以 `chico` profile 启动——先 `dsh-base`，再 `dsh-web-app`，最后这一层——因此它是在浏览器界面之上叠加而不是替换，浏览器界面的修复无需第二次改动即可到达 Chico。

## 这一层插入了什么

| 行 | 包 | 原因 |
|---|---|---|
| `market-data` | `dsh-market-data` | 报价和 K 线所经过的能力接缝 |
| `market-data-mock` | `dsh-market-data-mock` | 数据源：编译进包内的数据集，不需要凭证也不访问网络 |
| `tool-market-data` | `dsh-tool-market-data` | `market_quote` 和 `market_history` |

浏览器名册不需要新增行。price-series 卡片属于共享的渲染意图联合，因此 `dsh-client-ui-tool` 已经把已完成的 history 调用渲染为蜡烛图——任何拥有 web 表层的组合都会随工具一起获得图表。

`market-data` 不固定 `provider`。因此选择会解析到唯一可用的那个；拥有第二个数据源的部署应在后续 patch 层增加自己的提供方行并固定 id，而不是修改这一行。

### 数据源

> **本组合展示的每一个价格都是合成的。** [mock provider](../../investment/market-data-mock/README.md) 从编译进包内的数据集作答，不需要凭证也不访问网络。

这是一个用于构建和演示工作台的组合。真实行情源恰恰会在场所 API 变慢、限流或不可达时让界面不可用——一次失败的请求就会清空自选列表、让对话拿不到报价——而这些都不是正在构建的界面本身。数据集的量级、波动率和 52 周区间是对着 2026 年 8 月的真实观测校准的，因此图表能画出真实的形状，而不依赖某个场所是否在线。

报价携带 `session: 'closed'`，K 线携带 `adjustment: none`：数据集是收盘后数据且不含公司行动，所以两者按构造就是准确的，而不是约定俗成。

**读者可能据此行动的部署要替换这一行。** `@deepseek-ai/dsh-market-data-tushare` 仍在工作区里，接受 `TUSHARE_TOKEN` 凭据引用；替换这一行就是全部改动，因为 `market-data` 不锁定 `provider`，选择会解析到唯一可用的那个。注意：当前界面没有任何地方在显示处标明一个价格是合成的。

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
