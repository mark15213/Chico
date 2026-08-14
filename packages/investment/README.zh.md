# investment/ — 投资领域家族

[English](README.md) | 中文

本家族提供构建 Chico 工作台所需的投资领域能力：与提供方无关的市场接入，以及消费它的面向模型的工具。这些能力的产品意图位于 [`products/chico/`](../../products/chico/README.md)；本家族拥有已交付的契约。

| 包 | 职责 | ctx 键 |
|---|---|---|
| [`market-data/`](market-data/README.md) | 定义行情提供方的注册、选择和共享错误 | `ctx.marketData` |

这里的每个包在自身契约中都保持与提供方无关、与产品无关：场所特有的行为属于提供方包，工作台的呈现属于客户端插件。若某项能力在投资以外同样有用，它属于自己的家族而不是这里。
