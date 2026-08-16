# @deepseek-ai/dsh-tool-market-data

[English](README.md) | 中文

建立在 [`ctx.marketData`](../market-data/README.md) 之上的面向模型工具 `market_quote` 和 `market_history`。本包拥有 schema、参数校验、提示词引导、边界和呈现——不拥有任何具体提供方。

## 形态

- **`market_quote`** —— `market`（交易场所枚举）和 `symbol`。返回名称、币种、最新价、前收盘价、涨跌幅、成交量、观测时刻、交易场所的开闭市状态，以及这些数字的来源。
- **`market_history`** —— 相同的标的参数，外加可选的 `sessions`（默认 60）。返回复权方式、按日期升序的日频 K 线，以及同样的来源。

标的参数是扁平的而不是嵌套对象：模型把 `market` 和 `symbol` 作为两个具名字符串产出更可靠，而 `market` 是镜像接缝封闭 `Market` 联合的枚举，因此未知场所由 schema 校验拒绝，而不是由提供方拒绝。

启用开关控制注册。已启用的工具在没有可用提供方时仍然可见，并在执行时以接缝的结构化错误失败，因此组合不会宣称一项静默返回空的能力。

## 来源随结果元数据一起传递

渲染文本会说明一个回答从哪里来，两个工具同时把它通过 `output.presentationMeta` 投影出去，而那正是会话日志保留的部分。列举一段对话依据了什么的表面读这份元数据，而不是回头解析散文；`observationMetaFromResult` 负责收窄它，对两个工具还没有携带来源之前写下的元数据返回 `undefined`，因此这样的读者会退化成只报出工具名，而不是凭空造出一个数据源。

## Model Experience

### `market_quote` 与 `market_history`

#### 模型看到什么

生成的 [`market_quote` 与 `market_history` schema](../../../docs/tool-catalog.md#deepseek-aidsh-tool-market-data)，以及一段常驻提示词。交易日上限和超时预算是部署设置，不是模型参数。报价结果总会说明 as-of 时刻以及交易场所当时是否开市，因为模型无法确定时点的价格就是它无法推理的价格；正的涨跌幅带显式 `+`，使符号永不含糊；历史结果在数据行之前先给出交易日数量和复权方式。两者都以一行来源结尾，写明数据源、它的数据集和采集时刻——或者直接说明取值是在本进程算出来的，那与一次没有记下时间的抓取是两种不同的主张。

##### 行情引导

```markdown
Use market_quote for one instrument's latest price and market_history for its recent daily sessions. Both report the observation time, the feed and datasets the values came from, and, for history, the corporate-action adjustment; state those when the answer depends on them, and never compare prices across different adjustments.
```

#### Token 影响

本包加载时有一段固定提示词和两份工具 schema。单次调用的结果规模由 `sessions` 限定：一根 K 线一行，因此默认 60 个交易日约为 60 行。

#### KV Cache 影响

该提示词段在包挂载期间是静态的，因此留在可复用的提示词前缀中，不随轮次变化。

## Known Limitations and Deferred Work

- **来源只到数据源为止。** 来源写明提供方、它的数据集和采集时刻。[Chico 的数据来源控制](../../../products/chico/controls/data-provenance.md)还要求内容版本与许可范围，那需要一条能承载它们的接缝。
- **每次调用一个标的。** 刷新自选列表需要每个标的一次调用。批量操作需要自己的部分失败语义，且应先落在接缝上。
- **没有基本面、公告或公司行动。** 那些是各自独立的能力；本包只覆盖价格。
