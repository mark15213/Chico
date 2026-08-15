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

技术上可行，但产品上不采用：Workspace 实体可以承载标的，代价是每关注一只票就在磁盘上产生一个目录。产品决定改为**单一投资档案目录，且不注册为 Workspace**，标的是 Chico 自己的记录。下面的证据仍然成立，并且正是得出该决定的依据。

### 证据

`ctx.workspaceRegistry.create(path, title?)` 以 `fs.realpath` 规范化路径，并拒绝不存在或非目录的路径；`Workspace.path` 是规范目录路径，`status()` 只返回 `'ok' | 'missing-dir'`（[`README.md`](../../../../packages/workspace/workspace/README.md)）。

会话归属由 cwd 强制校验，不是约定：`attachSession` 要求会话 header 的 cwd 解析到存在的目录且等于 `Workspace.path`，不匹配直接拒绝且不写入；`sessionIds` 同步过滤 header 缺失、cwd 非法和不等的候选，下一次 workspace 变更会持久清除它们（[`src/types.ts:51-95`](../../../../packages/workspace/workspace/src/types.ts)）。

`ui-workspace` 只声明一个子 slot：`sidebar.workspaces.directoryFlow`（`kind: 'single'`，`scope: 'root'`），没有任何行级扩展点（[`src/client/index.ts:110-113`](../../../../packages/client/ui-workspace/src/client/index.ts)）。

### 判断

Workspace 不是通用分组对象，而是绑定到真实目录的实体。因此“标的即 Workspace”成立的前提是 Chico 为每个关注标的物化一个目录，并让该标的下的会话以该目录为 cwd 启动。这与产品意图一致：标的的笔记、模型和调研产物本来就应该是该目录下的文件，`ui-deliverables` 的产出文件行和可点击引用因此直接可用。不属于任何标的的普通对话落到 Ungrouped，正好承载开放对话，不需要额外机制。

但"每个标的一个目录"是产品无法接受的代价：关注是最轻的动作，而建目录是重的、不可逆的副作用——取消关注按现有语义不会删除目录，重新关注会得到新的 workspace id 且不会重新收养原有会话。

因此采用**单一投资档案目录**：所有 Chico 会话以它为 cwd，文件产物和 `ui-deliverables` 照常工作，而该目录**不注册为 Workspace**。注册表只在一次性引导时收养历史会话，此后"仅有 cwd 的会话保持 Ungrouped"，所以未注册的目录不会产生任何 workspace 行——这恰好满足"用户不应看到自己没建过的 workspace"，且不需要隐藏机制、不需要改 session origin、不需要改动任何持久化格式。

代价是标的的分组、排序、搜索、重命名和归档不再免费，要由 Chico 自己的界面实现。相应地，侧栏行不再需要扩展点：为"每标的一 Workspace"方案建的 `sidebar.workspaces.rowDecoration` 已随该方案一并回退。

### 未决问题

- 投资档案目录的默认位置；远程部署时它属于哪个用户边界。
- Chico 的标的记录和"会话属于哪个标的"的关联存放在哪：`storageDomain` 的自有 domain，还是档案目录下的文件。前者与 workspace 注册表同源，后者可随目录一起备份。
- 一次性引导的边界情形：若某个部署在 Workspace 注册表初始化之前就已存在以档案目录为 cwd 的会话，引导会把该目录收养成一个 Workspace。全新安装不会发生，但升级路径需要确认。
