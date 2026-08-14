# Chico 产品文档

[English](README.md) | 中文

本目录是 Chico 的产品知识库。Chico 是基于 DeepSeek Harness 构建的专业投资工作台；这里把 Chico 的产品与仓库设计和 Harness 平台文档分开维护。

## 范围

这些文档定义 Chico 的产品意图、目标代码结构、能力和证据。Harness 当前行为仍由源代码约定、包 README、[`docs/architecture.md`](../../docs/architecture.md) 和子系统参考负责；影响代码库的决策仍记录在 [Agent Note](../../.agents/notes/README.md) 中。

当前设计阶段只覆盖仓库结构和产品组合：Chico 文档放在哪里、新代码放在哪里、哪些 DSH 组件可以复用，以及哪些现有区域可能需要修改。具体运行时重构留到产品能力提出明确要求后再设计。

## 文档地图

| 区域 | 负责内容 |
|---|---|
| [`one-pager.md`](one-pager.md) | 单页产品定位、目标用户、差异化优势、设计原则和交付路径（仅英文）。 |
| [`workbench-design.md`](workbench-design.md) | 功能设计：模块地图、界面、布局和首个版本范围（仅英文）。 |
| [`foundations/`](foundations/vision.md) | 产品愿景、专业用户、原则、领域术语和授权基线。 |
| [`architecture/`](architecture/repository-structure.md) | 目标仓库结构、组合与启动方式、依赖方向和改动地图。 |
| [`capabilities/`](capabilities/index.md) | 每项面向用户的投资能力及其纵向文档集合。 |
| [`analysis/`](analysis/harness/architecture-baseline.md) | 绑定代码版本的 Harness 现状证据，以及检验优化假设的实验。 |
| [`controls/`](controls/data-provenance.md) | 跨能力的数据、市场时点、授权、审计、模型风险和安全要求。 |
| [`evaluations/`](evaluations/index.md) | 基准场景、数据集、评分规则和结果报告。 |
| [`templates/`](templates/prd-template.md) | 可复用的 PRD、体验设计、规格、评测、分析和实验结构。 |

## 工作流

1. 在 `analysis/` 中记录观察到的实现事实和开放假设，并绑定到确切 Git 版本。
2. 在 `architecture/` 中定义 Chico 的仓库级设计，在所属能力中定义面向用户的行为。
3. 实现前用 proposed Agent Note 记录已接受的框架或流程决策，包括备选方案和验收标准。
4. 实现后更新所属源代码约定和 Harness 文档，把 Agent Note 移入 `implemented/`，并在这里保留产品评测证据。

## 与代码的关系

| 产品关注点 | 预期代码位置 |
|---|---|
| Chico 可执行入口和默认启动行为 | `apps/chico/` |
| Chico 浏览器入口和前端构建产物 | `apps/chico-web/` |
| 投资领域服务、工具、策略和提供方 | `packages/investment/*` |
| Chico 产品组合层 | `packages/bundle/chico-base/` 和 `packages/bundle/chico-web-app/` |
| Chico 特有的浏览器贡献 | `packages/client/ui-chico-*` |
| 可复用 Harness 能力 | 现有 package group；只有需求与产品无关时才修改共享包。 |

## 起点

- 先评审 [`architecture/repository-structure.md`](architecture/repository-structure.md) 中的目标结构。
- 再评审 [`architecture/composition-and-startup.md`](architecture/composition-and-startup.md) 中 DSH 组合如何演进为 Chico 产品入口。
- 决定复用、扩展、替换或修改现有组件前，在 [`analysis/harness/component-inventory.md`](analysis/harness/component-inventory.md) 中完成分类。
