# DSH 组件清单

本文记录 Chico 对当前 DSH 组件的代码证据和处理判断。每轮分析先填写确切 Git revision，再按 [`../../architecture/change-map.md`](../../architecture/change-map.md) 的分类更新条目。

## 分析元数据

| 字段 | 值 |
|---|---|
| 分析日期 | 2026-08-14 |
| Git revision | `236c3dcad4d03cf240626f04dcbac9c65a304aea` |
| 分析人 | Shuai Wang |
| 产品场景 | 自选标的导航：标的能否直接使用 Harness Workspace 实体，见 [`../../workbench-design.md`](../../workbench-design.md) |

## 组件表

| 组件或目录 | 当前责任 | Chico 需要 | 候选分类 | 证据 | 未决问题 |
|---|---|---|---|---|---|
| `apps/cli/` | `dsh` 命令与 profile boot | 独立 Chico 产品入口 | 待分析 | [`apps/cli/README.md`](../../../../apps/cli/README.md) | 共享 launcher 应留在 app 还是抽到 boot package？ |
| `apps/web/` | 通用 DSH Web 前端构建 | Chico 浏览器入口 | 待分析 | [`apps/web/package.json`](../../../../apps/web/package.json) | 哪些外壳可直接复用，哪些必须由 Chico 拥有？ |
| `packages/bundle/base/` | 通用 Harness 基础组合 | Chico 基础能力 | 待分析 | [`packages/bundle/base/README.md`](../../../../packages/bundle/base/README.md) | 哪些默认项是平台事实，哪些是 DSH 产品选择？ |
| `packages/bundle/web-app/` | 通用 Web host 与 client roster | Chico Web 组合 | 待分析 | [`packages/bundle/web-app/README.md`](../../../../packages/bundle/web-app/README.md) | Chico 能否只用后置 bundle 完成替换？ |
| `packages/client/` | 浏览器运行时、slot 和 UI 插件 | 专业投资工作台 UI | 待分析 | [`packages/client/README.md`](../../../../packages/client/README.md) | 需要哪些通用扩展点，哪些是 Chico 专属视图？ |
| `packages/workspace/workspace/` | Workspace 实体注册表与会话账目 | 标的作为持久对象 | 直接复用 | [`src/types.ts`](../../../../packages/workspace/workspace/src/types.ts)、[`README.md`](../../../../packages/workspace/workspace/README.md) | 见下方专项分析 |
| `packages/client/ui-workspace/` | 侧栏 Workspace/Session 浏览器与选取器 | 自选列表行展示行情与状态 | 共享修改 | [`src/client/index.ts:110-113`](../../../../packages/client/ui-workspace/src/client/index.ts) | 行级扩展点的形状由谁定义？ |
| `packages/host/` | Web 宿主、API proxy 和静态资源 | Chico 服务端入口 | 待分析 | [`packages/host/README.md`](../../../../packages/host/README.md) | 是否存在产品特有的认证、路由或集成？ |
| `packages/core/` | Session、Agent、Tools 和执行原语 | 复用基础 agent 能力 | 待分析 | [`docs/architecture.md`](../../../../docs/architecture.md) | 当前阶段不设计改动；由具体能力缺口触发分析。 |

## 单项分析要求

组件结论必须说明 package 入口、依赖方向、Cordis 服务或配置 row、产品可见行为、可用扩展点和覆盖它的测试。选择“共享修改”时，还必须证明缺口不含 Chico 或投资领域语义；选择“产品替换”时，要指出由哪个 Chico bundle 或插件接管。

## 专项分析：标的能否使用 Workspace 实体

### 结论

实体层可以直接复用，无需修改；侧栏 UI 层不可行，需要一处产品无关的共享修改。二者结论不同，不能合并表述。

### 证据

`ctx.workspaceRegistry.create(path, title?)` 以 `fs.realpath` 规范化路径，并拒绝不存在或非目录的路径；`Workspace.path` 是规范目录路径，`status()` 只返回 `'ok' | 'missing-dir'`（[`README.md`](../../../../packages/workspace/workspace/README.md)）。

会话归属由 cwd 强制校验，不是约定：`attachSession` 要求会话 header 的 cwd 解析到存在的目录且等于 `Workspace.path`，不匹配直接拒绝且不写入；`sessionIds` 同步过滤 header 缺失、cwd 非法和不等的候选，下一次 workspace 变更会持久清除它们（[`src/types.ts:51-95`](../../../../packages/workspace/workspace/src/types.ts)）。

`ui-workspace` 只声明一个子 slot：`sidebar.workspaces.directoryFlow`（`kind: 'single'`，`scope: 'root'`），没有任何行级扩展点（[`src/client/index.ts:110-113`](../../../../packages/client/ui-workspace/src/client/index.ts)）。

### 判断

Workspace 不是通用分组对象，而是绑定到真实目录的实体。因此“标的即 Workspace”成立的前提是 Chico 为每个关注标的物化一个目录，并让该标的下的会话以该目录为 cwd 启动。这与产品意图一致：标的的笔记、模型和调研产物本来就应该是该目录下的文件，`ui-deliverables` 的产出文件行和可点击引用因此直接可用。不属于任何标的的普通对话落到 Ungrouped，正好承载开放对话，不需要额外机制。

新增标的的入口不需要修改：`sidebar.workspaces.directoryFlow` 的占位契约是每次打开报告一个已选路径，一个"按代码或名称搜索标的、物化目录、报告该路径"的 Chico 占位组件完全满足它。

侧栏行展示最新价、涨跌和状态则无法通过扩展完成。可选路径有两条：在 `ui-workspace` 增加行级扩展 slot（共享修改），或由 Chico 自己的浏览器接管 `sidebar.workspaces`（产品替换）。后者会同时放弃分组、排序、拖拽、搜索、重命名、fork 和归档的复用，代价明显更高。行装饰对任何 Harness 产品都成立，不含投资领域语义，因此推荐共享修改。

### 未决问题

- 标的目录的根位置与命名规则；远程部署时该目录树属于哪个用户边界。
- 行级 slot 的形状：整行替换、行尾附加区，还是列声明。取消关注标的时是否删除 Workspace 注册（目录本身按现有语义不删）。
