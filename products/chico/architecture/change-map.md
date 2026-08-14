# Chico 代码改动地图

本文定义评估现有 DSH 组件时使用的分类和可能改动区域。实际结论记录在绑定 Git revision 的 [`../analysis/harness/component-inventory.md`](../analysis/harness/component-inventory.md) 中。

## 分类

| 分类 | 使用条件 | 处理方式 |
|---|---|---|
| 直接复用 | 行为和产品要求一致 | Chico bundle 直接挂载，不复制代码 |
| 配置复用 | 实现合适，但默认值或启用范围不同 | 由 Chico bundle 覆盖完整配置 |
| 插件扩展 | 现有扩展点足以增加产品行为 | 新增 investment、client 或 host 插件 |
| 产品替换 | 现有实现是通用 DSH 产品选择，不适合 Chico | Chico bundle 禁用或替换对应 row |
| 共享修改 | 缺少的能力对非 Chico 使用方也成立 | 修改现有 package，并同步其公开约定和测试 |
| 移除或重命名 | 通用 DSH 产品表面不再有独立价值 | 另行决策并一次更新全部引用，不保留兼容壳 |

不要通过复制现有 package 建立 Chico fork。若两个实现需要长期共存，先明确共同 Service Definition；若旧实现没有保留价值，则直接替换并更新所有调用方。

## 可能新增的区域

| 位置 | 可能内容 |
|---|---|
| `apps/chico/` | 产品命令、默认启动、进程生命周期、产品级错误输出 |
| `apps/chico-web/` | 产品前端入口、品牌资源、静态构建 |
| `packages/investment/*` | 投资领域服务、数据提供方、工具、策略和工作流 |
| `packages/client/ui-chico-*` | 投资工作区、领域对象视图、产品导航和交互 |
| `packages/host/chico-*` | 仅服务 Chico 的宿主聚合、路由或机构集成 |
| `packages/bundle/chico-*` | 产品默认插件树和 DSH row 覆盖 |

## 可能修改的现有区域

| 现有区域 | 只在什么情况下修改 |
|---|---|
| `packages/boot/` | Chico 与 DSH 确实共享 launcher、profile 或环境加载原语，但当前 API 无法复用 |
| `packages/bundle/base/` | 基础层缺口是所有 Harness 产品都需要的默认能力，而不是 Chico 产品政策 |
| `packages/bundle/web-app/` | 通用 Web 组合缺少产品无关的扩展点；品牌和投资 UI 仍由 Chico Web bundle 负责 |
| `packages/client/` | 需要新的通用 slot、客户端服务或可复用 UI 原语 |
| `packages/host/` 和 `packages/api/` | 需要产品无关的 Host、RPC 或传输能力 |
| `packages/core/` | Chico 需求证明现有公共执行原语无法表达通用行为，并且插件或配置不能解决 |
| `apps/cli/` | 需要抽取 Chico 和 DSH 共同使用的命令启动能力，或最终决定替换通用发行入口 |
| `apps/web/` | 需要抽取共享前端构建外壳；Chico 品牌入口本身属于 `apps/chico-web/` |

## 决策证据

对每个准备复用或修改的组件，至少记录当前责任、入口、依赖、配置 row、用户可见行为、扩展点、产品缺口和测试入口。没有代码证据时只记录待验证问题，不把目录预期升级为实现结论。
