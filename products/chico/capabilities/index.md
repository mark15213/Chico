# 产品能力文档

每项面向用户的能力使用一个独立目录，并将 PRD、体验设计、产品规格和评测计划放在一起。跨能力的稳定规则属于 [`../foundations/`](../foundations/product-principles.md) 或 [`../controls/`](../controls/data-provenance.md)，不得复制到每个能力目录。

## 目录约定

```text
capabilities/<capability-id>/
├── prd.md
├── experience-design.md
├── specification.md
└── evaluation-plan.md
```

能力 id 使用稳定、面向领域的英文短横线名称。交付状态、负责人和排期留在 issue tracker；文档只记录当前需求、行为和验证方法。

## 创建能力

从 [`../templates/prd-template.md`](../templates/prd-template.md)、[`../templates/experience-design-template.md`](../templates/experience-design-template.md)、[`../templates/specification-template.md`](../templates/specification-template.md) 和 [`../templates/evaluation-plan-template.md`](../templates/evaluation-plan-template.md) 复制结构。能力需要改变共享 Harness 时，先在 [`../analysis/harness/component-inventory.md`](../analysis/harness/component-inventory.md) 记录当前组件和缺口。
