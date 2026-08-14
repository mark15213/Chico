# Agent Note: Chico 产品文档层

Status: implemented

[English](2026-08-14-chico-product-documentation.md) | 中文

## 问题

仓库文档描述共享 Harness，而 Chico 需要一个独立位置记录产品意图、仓库架构、能力文档、绑定代码版本的分析、控制、实验和评测证据。把这些主题放进 Harness 架构页面，会混合产品设计和平台当前行为，也会让探索性分析看起来具有权威性。

Chico 有意复用并可能修改共享 package。因此，产品文档不能替代仓库 Agent Note 或 package 约定：维护者仍然需要持久记录已接受方案及其备选方案，消费方仍然需要由源代码、package README 和子系统参考负责的确切行为。

## 决策

[`products/chico/`](../../../../products/chico/README.md) 是 Chico 产品文档层。稳定的双语 README 负责整个资料集的导航，子树 `AGENTS.md` 分别指定产品基础、目标仓库架构、纵向能力文档、代码分析、控制、评测和可复用模板的唯一归属。高频工作文档以中文为主且不配对；只有进入仓库双语范围，或有意建立完整配对时才维护对侧文件。

Chico 仓库结构和产品组合属于 `architecture/`。绑定代码版本的实现证据和尚未接受的假设属于 `analysis/`。只有产品能力提出明确要求后才新增共享运行时设计文档；产品文档不预先设计共享子系统。

每项面向用户的能力在 `capabilities/<name>/` 下共同维护 PRD、体验设计、规格和评测计划。跨能力的产品事实属于 `foundations/` 或 `controls/`。交付状态、负责人和排期留在 issue tracker，不进入长期文档的状态清单。

已接受的框架和流程选择仍属于活跃 Agent Note。已经实现且与提供方无关的行为仍属于源代码 JSDoc、package README、[`docs/architecture.md`](../../../../docs/architecture.md) 和所属子系统参考。产品文档链接这些归属位置，不复制事件目录、公开类型或实现约定。

## 归属规则

| 主题 | 归属位置 |
|---|---|
| Chico 产品意图、用户、领域术语和控制 | [`products/chico/`](../../../../products/chico/README.md) |
| 预期代码位置、组合、入口和依赖方向 | [`architecture/`](../../../../products/chico/architecture/repository-structure.md) |
| 代码观察、测量和尚未接受的假设 | [`analysis/`](../../../../products/chico/analysis/harness/architecture-baseline.md) |
| 已接受的备选方案和代码库决策 | [活跃 Agent Note](../../README.md) |
| Harness 当前行为和公开约定 | 源代码、package README 和 [`docs/`](../../../../docs/architecture.md) |

## 曾考虑的替代方案

**把 Chico 资料放在 `docs/` 下。** 不予采纳：`docs/` 负责共享 Harness 架构、子系统参考、贡献者流程和发布的用户指南。产品研究会扩大这些文档的主题，带来高频双语维护，并混淆平台当前行为和产品设计。

**用 Agent Note 记录所有 PRD、规格和分析。** 不予采纳：Agent Note 负责已经接受或正在提议的代码库决策及其被放弃的备选方案。用户研究、产品结果、规范性产品行为、测量和探索性假设具有不同的生命周期和证据要求。

**把 Chico 放在独立仓库。** 不予采纳：Chico 有意复用和修改共享 Harness，需要在产品架构、Agent Note、源代码约定、测试和评测之间保持原子化链接。拆分仓库会增加组件提取和协调变更的评审与验证成本。

**把所有 PRD、设计和规格分别放进按类型划分的目录。** 不予采纳：同一项能力会分散在多棵目录树中。纵向能力目录让用户问题、交互、行为和评测证据可以一起评审，同时让共享事实保留一个跨能力归属位置。

## 后果

仓库增加一个 Chico 文档层，但它不是 npm workspace，也不是 Harness 公开文档区域。贡献者写作前必须判断一项事实属于产品意图、目标仓库架构、绑定代码版本的分析、代码库决策还是已经实现的平台约定，并用链接连接这些位置。

这项分层增加了导航和维护规则，但能防止产品研究使 Harness 参考变得不稳定，或被误认为已经实现的行为。Chico 代码变更仍然承担仓库现有的 Agent Note、文档、测试、快照和评测义务。
