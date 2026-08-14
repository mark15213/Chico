# Agent Note: Workspace 行装饰 Slot

Status: implemented

[English](2026-08-14-workspace-row-decoration-slot.md) | 中文

## Problem

侧栏 Workspace 浏览器拥有每一行的全部内容：文件夹图标、标题、悬停操作按钮和拖拽接线。它只声明了一个子 slot `sidebar.workspaces.directoryFlow`，因此插件可以提供选取交互，却无法向行内贡献任何内容。

当某个产品赋予 Workspace 领域含义时，就需要浏览器无从知晓的行内内容。Chico 投资工作台把关注的标的当作 Workspace，需要在行上显示最新价、涨跌和状态标记；浏览器不应该负责解析行情数据，这一缺口记录在 [Chico 组件清单](../../../../products/chico/analysis/harness/component-inventory.md)。

没有扩展点时，唯一的路径是产品把自己的组件注册进 `sidebar.workspaces`、整体替换浏览器，这会放弃分组、手动与最近更新排序、拖拽重排、元数据与内容搜索、重命名、fork 和归档——每一项都要重新实现并随时间偏离。

## Decision

WorkspaceBrowser 条目声明第二个子 slot `sidebar.workspaces.rowDecoration`（`list` 类型，`root` 作用域）。其 owner share 只携带装饰方需要的行身份：

| 字段 | 含义 |
|---|---|
| `workspaceId` | 该行对应的 Workspace。 |
| `title` | 该行的显示标题，已完成呈现所需的解析。 |

`ProjectRowItem` 在行标题和尾部操作按钮之间渲染该列表，且仅在行带有 `workspaceId` 时渲染。未分组桶没有对应的 Workspace，因此不渲染装饰，注册方也永远不会收到没有 id 的行。

装饰只负责呈现。行自身的点击仍然折叠或展开分组，装饰在悬停时把位置让给操作按钮，与会话行的时间标签完全一致，因此装饰后的行既不增加宽度也不失去可用操作。空洞不渲染任何内容且不改变行的几何，这正是该 slot 对不填充它的组合保持无成本的原因。

该 slot 与产品无关：owner share 只表达一个 Workspace 和一个标题，不含任何投资词汇，任何需要行内状态、徽标或计数的组合都可以占用它。

## Alternatives considered

**由 Chico 自己的浏览器注册进 `sidebar.workspaces`。** 否决：这会重复分组、排序、拖拽重排、搜索、重命名、fork 和归档，之后对这些行为的每一次修复都要做两遍。整体替换外壳区域适用于该区域的行为对产品不正确时，而不是仅仅行内容不完整时。

**把 owner share 扩大为完整的 `GroupNode`。** 否决：该节点携带展开状态、会话成员、拖放目标状态和浏览器自身的呈现判断。为了两个字段把这些全部交给注册方，等于把浏览器的内部树结构固化成跨包契约。

**使用 `single` 而非 `list` 类型。** 否决：行装饰没有任何独占性，单一席位会让两个装饰插件在注册时冲突，而不是彼此组合。

**让装饰可交互（拥有自己的点击目标）。** 属于推迟而非否决：行的点击语义归浏览器所有，行内第二个点击目标需要单独决定优先级和键盘顺序。纯呈现内容两者都不需要，因此该 slot 先不带交互发布，日后可以在不破坏占用方的前提下放宽。

## Consequences

`WorkspaceBrowserProps` 从渲染一个子 slot 变为两个，`SessionTree` 需要从浏览器根多传一个回调到行。代价是内部组件上的一个 prop，而替代方案是一个分叉出来的浏览器。

由于声明位于 WorkspaceBrowser 条目上，该条目的拆卸会连同子 slot 一起收起，因此针对已卸载浏览器注册的占用方与 directory-flow 占用方死在同一条生命周期轴上。

未分组桶永久无法被装饰。这由 owner share 要求 `workspaceId` 直接推出，并且是正确的限制：按 Workspace 解析数据的装饰方，对一个并非 Workspace 的桶没有任何东西可解析。

## Testing

`tests/apply.client.spec.ts` 断言该声明以 `list` 类型存在、注册方可以向其贡献，以及拆卸浏览器 fiber 会收起该声明。`tests/rows.client.spec.tsx` 断言真实 Workspace 行会带着行身份渲染装饰，而未分组桶从不请求装饰。
