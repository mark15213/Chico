# DSH 仓库架构基线

本文是 Chico 分析当前 DeepSeek Harness 仓库和产品组合的入口。分析必须绑定确切 Git revision；当前公开架构地图仍由 [`docs/architecture.md`](../../../../docs/architecture.md) 负责。

## 分析元数据

| 字段 | 值 |
|---|---|
| 分析日期 | 2026-08-14 |
| Git revision | 待首次基线分析填写 |
| 范围 | workspace、应用入口、构建、profile、bundle、Host、Client、共享 package group 和测试入口 |
| 排除 | `vendor/`、构建产物、未经验证的未来设计 |

## 当前架构入口

- [`pnpm-workspace.yaml`](../../../../pnpm-workspace.yaml) 定义 workspace 成员和本地依赖解析。
- 根 [`package.json`](../../../../package.json) 定义构建、开发和 `dsh` 源码启动入口。
- [`apps/cli/`](../../../../apps/cli/README.md) 负责 `dsh` 命令、profile 加载和插件管理。
- [`apps/web/`](../../../../apps/web/package.json) 负责通用 Web 前端构建产物。
- [`packages/bundle/`](../../../../packages/bundle/README.md) 负责 profile 使用的可安装 patch 层。
- [`docs/architecture.md`](../../../../docs/architecture.md) 负责 DSH 组合、核心包和扩展点。

## 分析方法

每项结论需要链接源文件、manifest、配置、测试、运行日志或基准数据。分析区分“代码直接证明”“测试证明”“运行观察”和“待验证推断”；只有接受后的代码库决策进入 Agent Note 或 Chico 架构文档。

## 当前分析输出

[`component-inventory.md`](component-inventory.md) 逐项记录 DSH 组件对 Chico 的复用、扩展、替换或共享修改判断。具体子系统只在产品能力暴露缺口后新增分析，不提前建立运行时改造目录。
