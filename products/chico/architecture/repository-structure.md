# Chico 仓库结构

本文定义 Chico 在当前 monorepo 中的目标代码位置和依赖方向。它只负责代码归属，不定义具体能力、API 或运行时实现。

## 分层原则

Chico 是产品，DSH 是可复用的 agent harness。产品入口和产品默认值由 Chico 拥有；通用能力继续由现有 DSH package 拥有；投资领域行为进入独立的领域 package；最终运行树由 Chico bundle 组装。

新增代码先按责任选择位置，不因为使用 Chico 品牌就集中到一个大包中。共享 package 不得反向依赖 Chico，投资领域 package 不得依赖具体应用入口，应用只负责启动、产品身份和顶层组装。

## 目标目录

```text
apps/
├── cli/                         # 现有通用 dsh 命令
├── web/                         # 现有通用 DSH Web 前端入口
├── chico/                       # Chico 可执行入口和默认启动行为
└── chico-web/                   # Chico 浏览器入口与前端构建产物

packages/
├── investment/                  # 投资领域能力
│   └── <capability>/            # 领域服务、提供方、工具或策略插件
├── bundle/
│   ├── chico-base/              # Chico 跨界面的基础组合
│   └── chico-web-app/           # Chico Web 组合与覆盖层
├── client/
│   └── ui-chico-*/              # Chico 特有的浏览器插件
├── host/
│   └── chico-*/                 # 仅在需要产品特有宿主服务时使用
└── <existing groups>/           # 继续承载可复用 Harness 能力

products/
└── chico/                       # PRD、设计、规格、架构和代码分析
```

这些是预留代码位置，不要求在文档阶段创建空 package。第一个真实能力出现时才建立对应目录、manifest、README、测试和 Agent Note。

## 目录责任

### `products/chico/`

只保存产品知识：产品基础、仓库架构、纵向能力文档、代码分析、控制要求、评测和模板。这里不放可执行代码，也不复制 Harness 已有的包约定。

### `apps/chico/`

拥有面向开发者和最终发行物的 `chico` 入口、默认界面选择、产品名称、启动参数和进程生命周期。它可以复用共享 boot 能力，但不承载投资业务逻辑。

### `apps/chico-web/`

拥有 Chico 浏览器应用的构建入口、HTML 外壳、品牌资源和最终静态产物。可复用的 React、Cordis 和 UI 原语仍由 `packages/client/` 提供。

### `packages/investment/*`

拥有投资领域模型和能力，例如研究、市场数据、组合、风险或交易准备。一个完整能力按 Harness 现有约定拆分 Service Definition、Provider 和 Consumer；只有独立演进时才拆成多个 package。

### `packages/client/ui-chico-*`

拥有 Chico 特有的浏览器节点、工作区、导航或领域视图。通用 UI 原语和扩展机制仍留在现有 `packages/client/` package 中。

### `packages/bundle/chico-*`

拥有产品组装，不实现业务算法。bundle 选择需要挂载、替换、禁用或配置的 DSH 与 Chico 插件，使同一组 package 形成可启动的 Chico 产品。

## 依赖方向

```text
apps/chico + apps/chico-web
            |
            v
packages/bundle/chico-* + packages/client/ui-chico-*
            |
            v
packages/investment/* + reusable packages/*
            |
            v
vendored Cordis
```

禁止现有共享 package 导入 `apps/chico`、`apps/chico-web` 或 Chico bundle。若 Chico 发现一个可复用 package 缺少通用扩展点，先提取产品无关的接口，再由 Chico 插件消费；不要把投资语义塞进共享核心。

## 测试和文档归属

单元测试、组装测试和 package README 与所属代码同目录。Chico 的真实启动路径测试属于 `apps/chico/` 或 `apps/chico-web/`；跨 package 的产品场景和评测定义属于 `products/chico/`，可重放 fixture 仍放在执行它的测试入口附近。

影响现有 package 的行为变更继续遵循根目录 Agent Note、文档、快照和测试规范。产品文档说明 Chico 为什么需要变化，所属 package 文档说明变化后的公开行为。
