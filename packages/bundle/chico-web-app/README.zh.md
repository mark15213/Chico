# @deepseek-ai/dsh-chico-web-app

[English](README.md) | 中文

Chico 投资界面 bundle：叠加在 [`dsh-web-app`](../web-app/README.md) 之上的 patch 层，把浏览器界面变成投资工作台。它以 `chico` profile 启动——先 `dsh-base`，再 `dsh-web-app`，最后这一层——因此它是在浏览器界面之上叠加而不是替换，浏览器界面的修复无需第二次改动即可到达 Chico。

## 这一层插入了什么

| 行 | 包 | 原因 |
|---|---|---|
| `followed-names` | `dsh-followed-names` | 持久关注列表及其共享投资档案目录 |
| `market-data` | `dsh-market-data` | 报价和 K 线所经过的能力 seam |
| `market-data-mock` | `dsh-market-data-mock` | 数据源：编译进包内的数据集，不需要凭证也不访问网络 |
| `tool-market-data` | `dsh-tool-market-data` | `market_quote` 和 `market_history` |
| `name-record` | `dsh-name-record` | 一只标的的立场、决策链和绑定会话 |
| `watchlist` | `dsh-watchlist` | 在 Host 端连接关注标的、记录与行情的 Remote 投影 |
| `ui-watchlist` | `dsh-client-ui-watchlist` | 投资框架：关注标的、标的专属对话开场、记录面板和工作台图表 |

`ui-watchlist` 在普通 `sessions` 框架旁注册 `names` 框架。它同时替换左右两栏的内容，中栏则保留共享对话主体并获得标的专属开场。price-series 卡片本身仍属于共享的渲染意图联合，因此即使没有 Chico，`dsh-client-ui-tool` 也会渲染已完成的 history 调用；工作台配置项则为绑定到已打开标的的对话提供更丰富的图表。

`market-data` 不固定 `provider`。因此选择会解析到唯一可用的那个；拥有第二个数据源的部署应在后续 patch 层增加自己的提供方行并固定 id，而不是修改这一行。

### 数据源

> **本组合展示的每一个价格都是合成的。** [mock provider](../../investment/market-data-mock/README.md) 从编译进包内的数据集作答，不需要凭证也不访问网络。

这是一个用于构建和演示工作台的组合。真实行情源恰恰会在场所 API 变慢、限流或不可达时让界面不可用——一次失败的请求就会清空自选列表、让对话拿不到报价——而这些都不是正在构建的界面本身。数据集的量级、波动率和 52 周区间是对着 2026 年 8 月的真实观测校准的，因此图表能画出真实的形状，而不依赖某个场所是否在线。

报价携带 `session: 'closed'`，K 线携带 `adjustment: none`：数据集是收盘后数据且不含公司行动，所以两者按构造就是准确的，而不是约定俗成。

**读者可能据此行动的部署要替换这一行。** `@deepseek-ai/dsh-market-data-tushare` 仍在工作区里，接受 `TUSHARE_TOKEN` 凭据引用；替换这一行就是全部改动，因为 `market-data` 不锁定 `provider`，选择会解析到唯一可用的那个。注意：当前界面没有任何地方在显示处标明一个价格是合成的。

## 这一层刻意不做什么

该层只增加能力、从不移除界面：它不禁用下层的任何一行，因为那属于 `dsh-web-app` 已经作出的界面策略决定。它也不携带任何运行时胶水——插件体为空。Chico 专有的服务属于它自己的包，那样以不同方式打补丁的组合仍然能看到它。

没有 `ui-watchlist`，行情工具仍然工作，`dsh-client-ui-tool` 会通过共享 `PriceSeriesBlock` 渲染 `market_history`。不理解 `price-series` 意图的客户端仍能收到工具面向模型的 K 线表格。Chico 配置项增加投资框架及其更丰富的图表；它是该能力的消费方，而不是该能力的前置条件。

## Model Experience

Indirectly, through the `dsh-tool-market-data` rows this layer inserts, which own the model-facing tools and prompt guidance.

#### KV Cache 影响

无；bundle 自身既不组装也不发送提供方请求。

## Known Limitations and Deferred Work

- **合成价格没有在显示位置标记。** bundle 文档说明了数据源，但 `Quote` 和 `PriceBar` 没有来源字段，因此渲染后的报价或图表与场所数据支持的结果外观相同。
- **标的名册固定。** 数据源服务横跨上海、深圳和香港的六只股票与四条基准指数，其他标的一律拒绝而不是现场合成。
- **只有收盘后数据。** 这里的任何一行都无法展示盘中价格，界面目前也没有在展示位置标注一个报价是收盘价。
- **投资闭环仍靠手工且只覆盖价格。** 框架会列出标的与对话，记录面板可以写入并结算决策链条目，但不会从对话中抽取条目、归因涨跌，也不展示基本面、公告、所有权或 Today；见[工作台设计](../../../products/chico/workbench-design.md)。
