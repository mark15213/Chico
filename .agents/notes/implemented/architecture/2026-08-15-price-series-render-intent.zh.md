# Agent Note: 价格序列渲染意图

Status: implemented

[English](2026-08-15-price-series-render-intent.md) | 中文

## Problem

[工具渲染意图联合](2026-07-02-tool-render-intent-union.md)是一个封闭集合——`generic`、`terminal`、`diff`、`search`、`read`、`web`——返回日频价格 K 线的工具没有合适的成员。`market_history` 只能回落到通用卡片，因此专业投资者读一段价格序列时读到的是一张数字文本表。

文本在这里不是替代品。六十个交易日上的形状是图能承载而表格不能的东西，而行情接缝存在的全部意义就是价格要被当作序列来读。

底下还压着两个问题。联合的卡片种类表达的是数据**是什么**，因此用绘制方式命名成员会成为第一个例外。而 `ToolRow`——每个卡片行都组合的共享外壳——通过一组封闭的 props（`terminal`、`diff`、`read`、`search`、`web`）接收卡片素材，因此每新增一种卡片就要改一个共享组件，这正是 Workspace 行在[获得装饰 slot](2026-08-14-workspace-row-decoration-slot.md) 之前的同一种增长。

## Decision

### 卡片命名数据，而不是绘制方式

`PriceSeriesResultView` 携带 `card: 'price-series'` 而不是 `'chart'`。工具声明它的结果是一组交易日 K 线；由 UI 决定画蜡烛、折线还是表格。用绘制方式命名，等于把一个渲染决定放进一套其全部目的就是"工具永不引入 UI 类型"的词汇里。

它只在结果时出现，没有调用视图：K 线只在 `execute` 之后存在，因此待定调用保持通用卡片——`search` 出于同样理由已经采用这一安排。

`adjustment` 是必填而非可选。不说明价格采用哪种公司行动基准就绘制的图表，恰恰诱发行情接缝拒绝允许的那种比较，因此防止它的字段不能是可省略的。

该视图不设置 `content` 副本，因此不认识该卡片的 UI 会回落到原始结果内容——也就是工具自身文本已经携带的那张 K 线表。正是这个回落，使得新增该成员无需每个客户端都发布一个图表实现。

### `ToolRow` 获得一个中立的卡片席位

`customCard?: ReactNode` 接收拥有自有卡片种类的注册方已经渲染好的素材。它在卡片链中排在最后，因此携带已知卡片的调用会保留该卡片，注册方无法覆盖它。`ToolRow` 和 `toolRowModel` 从 `dsh-client-ui-tool/client` 导出，使注册方组合外壳而不是分叉它。

### 图表是 Chico 包，不是共享原语

`dsh-client-ui-chico-price-series` 注册 `market_history` 的键控 toolview 并绘制蜡烛。卡片词汇与产品无关，属于 core；投资领域的渲染不是，[Chico 改动地图](../../../../products/chico/architecture/change-map.md)把它放在 Chico 客户端包里。没有 Chico 的组合渲染通用卡片，而这是契约早已承诺的。

## Alternatives considered

**通用 `chart` 卡片，承载任意点序列。** 否决：OHLCV 具有通用点序列无法表达的语义——每个交易日四个价格、以交易日为单位的涨跌着色、一个复权基准。今天只有一个消费方，而没有消费方的通用卡片属于包策略禁止的投机抽象。

**保留通用卡片，在结果文本里画 ASCII 蜡烛。** 否决：这把 UI 排版放进面向模型的取值，为工具手册所禁止，并且让每次模型请求都为只服务人类读者的字符付费。

**在 `ToolRow` 上与 `web`、`search` 并列增加 `priceSeries` prop。** 否决：这会让一个封闭集合继续增长，下一种卡片仍要改它，并且把一个投资类型放进共享组件的签名。中立的 `customCard` 席位一次性解决了通用问题。

**把图表放进 `dsh-client-ui-primitives`，与 `WebBlock` 并列。** 否决：原语与产品无关，而这个不是。先例恰恰指向反面——`WebBlock` 服务的是任何组合都可能启用的能力，而蜡烛图只服务一个产品。

**为价格全部相同的序列画一条平线。** 否决：那宣称了数据并不具备的形状。模型层返回 null，行回落到通用卡片，对"无可绘制"这一事实保持诚实。

## Consequences

联合中出现了一个默认组合不渲染的成员。这是有意的，与 `tool-web` 发布渲染器之前 `web` 卡片的处境相同，但也意味着不具备该能力的 UI 会静默显示文本回落，而不会告知存在更丰富的卡片。

成交量随渲染意图传递而图表将其丢弃。之所以携带，是因为工具本来就有，并且日后增加成交量副图不应需要改契约；今天它未被使用。

`ToolRow` 现在有了一个注册方可以滥用来渲染任何东西的逃生口。排序规则限定了损害范围——已知卡片总是胜出——但没有任何类型检查能保证注册方的元素适合出现在工具行里。

## Testing

`packages/investment/tool-market-data/tests` 覆盖 presentation-meta 往返以及所有回落到通用卡片的情形：调用出错、元数据缺失、非对象、数组、畸形 K 线和未知复权方式。`packages/client/ui-chico-price-series/tests` 覆盖模型推导、单位盒几何、运行中调用与未知卡片的回落、空序列与平坦序列、doji 细线渲染、无障碍标签，以及键控注册与 fiber 拆卸证明移除。
