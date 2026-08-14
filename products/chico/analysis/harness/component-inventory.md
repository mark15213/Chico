# DSH 组件清单

本文记录 Chico 对当前 DSH 组件的代码证据和处理判断。每轮分析先填写确切 Git revision，再按 [`../../architecture/change-map.md`](../../architecture/change-map.md) 的分类更新条目。

## 分析元数据

| 字段 | 值 |
|---|---|
| 分析日期 | 待填写 |
| Git revision | 待填写 |
| 分析人 | 待填写 |
| 产品场景 | 待填写 |

## 组件表

| 组件或目录 | 当前责任 | Chico 需要 | 候选分类 | 证据 | 未决问题 |
|---|---|---|---|---|---|
| `apps/cli/` | `dsh` 命令与 profile boot | 独立 Chico 产品入口 | 待分析 | [`apps/cli/README.md`](../../../../apps/cli/README.md) | 共享 launcher 应留在 app 还是抽到 boot package？ |
| `apps/web/` | 通用 DSH Web 前端构建 | Chico 浏览器入口 | 待分析 | [`apps/web/package.json`](../../../../apps/web/package.json) | 哪些外壳可直接复用，哪些必须由 Chico 拥有？ |
| `packages/bundle/base/` | 通用 Harness 基础组合 | Chico 基础能力 | 待分析 | [`packages/bundle/base/README.md`](../../../../packages/bundle/base/README.md) | 哪些默认项是平台事实，哪些是 DSH 产品选择？ |
| `packages/bundle/web-app/` | 通用 Web host 与 client roster | Chico Web 组合 | 待分析 | [`packages/bundle/web-app/README.md`](../../../../packages/bundle/web-app/README.md) | Chico 能否只用后置 bundle 完成替换？ |
| `packages/client/` | 浏览器运行时、slot 和 UI 插件 | 专业投资工作台 UI | 待分析 | [`packages/client/README.md`](../../../../packages/client/README.md) | 需要哪些通用扩展点，哪些是 Chico 专属视图？ |
| `packages/host/` | Web 宿主、API proxy 和静态资源 | Chico 服务端入口 | 待分析 | [`packages/host/README.md`](../../../../packages/host/README.md) | 是否存在产品特有的认证、路由或集成？ |
| `packages/core/` | Session、Agent、Tools 和执行原语 | 复用基础 agent 能力 | 待分析 | [`docs/architecture.md`](../../../../docs/architecture.md) | 当前阶段不设计改动；由具体能力缺口触发分析。 |

## 单项分析要求

组件结论必须说明 package 入口、依赖方向、Cordis 服务或配置 row、产品可见行为、可用扩展点和覆盖它的测试。选择“共享修改”时，还必须证明缺口不含 Chico 或投资领域语义；选择“产品替换”时，要指出由哪个 Chico bundle 或插件接管。
