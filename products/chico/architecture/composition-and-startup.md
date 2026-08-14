# Chico 组合与启动目标

本文说明当前 DSH 如何启动，以及 Chico 产品入口应当复用哪些机制。`pnpm chico` 是目标开发体验，不是本阶段的实现承诺。

## 当前 DSH 启动事实

根目录的 `pnpm dsh web` 把 `web` 传给 `dsh` script。该 script 通过 Node 的 `tsx` ESM hook 直接运行 [`apps/cli/src/bin.ts`](../../../apps/cli/src/bin.ts)，`web` 是 `--profile web` 的别名。

当前命令不会先执行根目录完整编译。Web bundle 会从 [`apps/web/`](../../../apps/web/package.json) 解析已构建的 `dist/index.html`；产物不存在时，启动会提示先运行根目录 build。

`web` profile 按顺序组合 `dsh-base`、`dsh-web-app`、profile patch、home patch 和命令行 overlay。`dsh-web-app` 决定通用 Web host、前端静态文件、客户端插件 roster 和 Web 启动参数。

## Chico 目标入口

Chico 最终拥有独立的 `chico` 命令和根目录开发入口。默认启动 Web 产品时，用户不需要理解 DSH profile 名称；profile 和 bundle 仍可作为内部组合机制。

```text
pnpm chico
  -> apps/chico
  -> Chico product composition
  -> shared DSH bundles and packages
  -> Chico bundles and investment packages
  -> apps/chico-web dist
```

是否由一次命令自动构建、只构建缺失或过期产物，还是启动独立 watcher，留给实现阶段根据开发反馈和构建时间决定。无论采用哪种方式，`pnpm chico` 都应成为仓库内验证 Chico 真实产品组合的入口，而不是示例或绕过产品 bundle 的临时脚本。

## 组合层

目标组合按下列责任分层：

1. DSH 基础层提供通用模型、Session、工具、文件系统、权限、设置、凭证和观察能力。
2. Chico 基础层加入投资领域服务、产品默认策略和跨界面能力。
3. DSH Web 层提供可复用的 Host、RPC、浏览器运行时和 UI 插件机制。
4. Chico Web 层替换产品名称、前端入口、客户端 roster、导航、领域视图和不适合 Chico 的默认插件。
5. 部署或用户覆盖只能修改产品明确开放的配置，不能绕过 Chico 的安全和领域约束。

具体 bundle 数量可以随实现收敛，但产品默认值必须由 Chico 拥有，不能散落在根 script、临时环境变量或共享 package 中。

## 与 DSH profile 的关系

初期可以用一个 Chico profile 验证组合，因为现有 profile 已支持有序 bundle 和覆盖层。最终 `apps/chico/` 是否直接复用该 profile boot、抽取共享 launcher，或拥有更窄的产品启动器，需要在实现前根据以下问题决定：

- 最终用户是否允许安装任意 profile 插件，还是只允许 Chico 审核过的扩展？
- Chico 的 home、设置、凭证和持久数据是否与 DSH 共用位置？
- 产品发行是否仍暴露通用 `dsh` 命令？
- 机构级配置与个人配置分别位于哪一层，谁可以修改？

## 产品演进顺序

先让 Chico 通过自己的 bundle 复用 DSH，再逐项替换不符合产品要求的插件。只有在缺口属于通用 Harness 能力时才修改共享 package；属于投资领域或 Chico 体验的差异保留在产品 package。这样可以持续获得可运行的产品组合，而不需要先完成一次全仓库重命名或核心重写。
