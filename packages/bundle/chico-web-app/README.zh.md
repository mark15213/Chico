# @deepseek-ai/dsh-chico-web-app

[English](README.md) | 中文

Chico 投资界面 bundle：叠加在 [`dsh-web-app`](../web-app/README.md) 之上的 patch 层，把浏览器界面变成投资工作台。它以 `chico` profile 启动——先 `dsh-base`，再 `dsh-web-app`，最后这一层——因此它是在浏览器界面之上叠加而不是替换，浏览器界面的修复无需第二次改动即可到达 Chico。

## 这一层插入了什么

| 行 | 包 | 原因 |
|---|---|---|
| `market-data` | `dsh-market-data` | 报价和 K 线所经过的能力接缝 |
| `market-data-fixture` | `dsh-market-data-fixture` | 本组合中唯一的提供方 |
| `tool-market-data` | `dsh-tool-market-data` | `market_quote` 和 `market_history` |

浏览器名册不需要新增行。price-series 卡片属于共享的渲染意图联合，因此 `dsh-client-ui-tool` 已经把已完成的 history 调用渲染为蜡烛图——任何拥有 web 表层的组合都会随工具一起获得图表。

`market-data` 不固定 `provider`。因此选择会解析到唯一可用的那个；拥有持牌数据源的部署应在后续 patch 层增加自己的提供方行并固定 id，而不是修改这一行。

**本组合展示的每一个价格都是 fixture 数据。** 确定性提供方的存在是为了让界面无需交易场所权限即可启动和演示；不能把合成价格当作真实价格呈现的部署，应在加入数据源的同一层禁用该行。

## 这一层刻意不做什么

该层只增加能力、从不移除界面：它不禁用下层的任何一行，因为那属于 `dsh-web-app` 已经作出的界面策略决定。它也不携带任何运行时胶水——插件体为空。Chico 专有的服务属于它自己的包，那样以不同方式打补丁的组合仍然能看到它。

没有浏览器名册那一行，history 工具照样工作，并通过通用卡片渲染它的 K 线表格，而这正是 price-series 渲染意图对不具备该能力的 UI 所作的承诺。该行是改进，不是必需。

## Model Experience

Indirectly, through the `dsh-tool-market-data` rows this layer inserts, which own the model-facing tools and prompt guidance.

#### KV Cache 影响

无；bundle 自身既不组装也不发送提供方请求。

## Known Limitations and Deferred Work

- **不随附任何持牌提供方。** 在加入数据源行之前，该组合可演示但不可用于真实决策；界面目前也没有在展示位置标注 fixture 价格为合成数据。
- **除图表外没有投资专有界面。** 关注标的、档案面板和 Today 已完成设计但尚未构建，见 [Chico 工作台设计](../../../products/chico/workbench-design.md)。
