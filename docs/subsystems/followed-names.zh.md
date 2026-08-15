# 关注标的

[English](followed-names.md) | 中文

关注标的注册表：用户关注过的每一个标的的持久记录，以及 Chico 自身工作产物所在的档案目录。它是建立在自有存储 domain 之上的一个服务，而不是能力接缝——这里没有可替换的提供方。

来源：[`packages/investment/followed-names/src/types.ts`](../../packages/investment/followed-names/src/types.ts)

## 取消关注保留记录

记录本身才是重点。笔记、洞察和一只票的历史，价值高于"它今天在不在自选里"这个标志位，因此 `unfollow` 只清除标志位，别的什么都不动。重新关注会恢复全部内容并保留 `firstFollowedAt`，因此记录的年龄取第一次关注而不是最近一次。

没有删除操作。这是与 harness 既有立场一致而非发明例外：会话可以归档但不能删除，删除 Workspace 注册也刻意不动它的目录和日志。

```ts type-equiv
/**
 * One instrument the user has followed at some point. Unfollowing clears
 * {@link FollowedName.followed} rather than deleting the record, so notes,
 * insights, and session associations survive and re-following restores them.
 */
interface FollowedName {
  /** The instrument this record describes. */
  readonly instrument: InstrumentRef
  /** Display name as the user should see it, in the venue's own language. */
  readonly displayName: string
  /** Whether the name is currently on the watchlist. */
  readonly followed: boolean
  /** ISO-8601 instant of the first follow; never rewritten by a later re-follow. */
  readonly firstFollowedAt: string
  /** ISO-8601 instant of the last follow or unfollow. */
  readonly updatedAt: string
}
```

记录以标的身份（`MARKET:SYMBOL`）为键而非生成的 id，因为标的**就是**身份：同一个上市标的出现两条记录会让自选列表产生歧义，而同一代码在两个交易场所确实是两只不同的标的。

## 档案目录

一个目录承载 Chico 自身的工作产物——笔记、模型、调研输出——并且每个 Chico 会话都以它为 cwd 运行，因此产出文件落在持久位置，现有的产出文件界面无需改动即可列出并链接它们。

`archivePath` 默认位于 harness home 之下（`chico/archive`），与 `sessions` 和 `storages` 并列，因为 harness 把所有用户数据放在一个根下。相对路径会被拒绝，而不是相对某个环境工作目录解析。

**该目录刻意从不注册为 Workspace。** [Workspace 注册表](workspace.md)只在一次性引导时收养历史会话，此后仅有 cwd 的会话保持 Ungrouped。因此未注册的目录根本不会产生任何 workspace 行——这正是让用户永远不会看到自己没建过的 workspace 的原因，且不需要隐藏机制，也不需要改动任何持久化格式。

## 时间是参数

`follow` 和 `unfollow` 接收要打的时间戳，而不是读时钟。自己打时间戳的注册表无法针对固定期望断言，而每个调用方本来就知道自己指的是什么时间。

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — this section is byte-identical in both language sides of the page. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

<a id="ctxfollowednames--followednamesservice"></a>

### `ctx.followedNames` — `FollowedNamesService`

The followed-names service. Registered as `ctx.followedNames` (one instance per context).

```ts cordis-catalog
/**
 * Every record the registry holds, followed or not, in no guaranteed order.
 * @returns a snapshot array; iteration order is the table's own.
 */
list(): readonly FollowedName[]

/**
 * The records currently on the watchlist.
 * @returns a snapshot array of records whose `followed` is true.
 */
listFollowed(): readonly FollowedName[]

/**
 * One instrument's record, followed or not.
 * @param instrument - the instrument to look up.
 * @returns the record, or `undefined` when the instrument was never followed.
 */
get(instrument: InstrumentRef): FollowedName | undefined

/**
 * Follow an instrument, or re-follow one that was unfollowed. A re-follow
 * keeps `firstFollowedAt` and everything else the record carries, which is
 * what makes unfollowing safe.
 * @param instrument - the instrument to follow.
 * @param displayName - display name; must contain a non-whitespace character.
 * @param now - ISO-8601 instant to stamp, supplied by the caller so the
 *   registry stays free of a clock and its records stay reproducible in tests.
 * @returns the stored record.
 */
async follow(instrument: InstrumentRef, displayName: string, now: string): Promise<FollowedName>

/**
 * Take an instrument off the watchlist without losing anything recorded
 * about it. Unfollowing an already-unfollowed name is a no-op that still
 * resolves, so a repeated action is not an error.
 * @param instrument - the instrument to unfollow.
 * @param now - ISO-8601 instant to stamp.
 * @returns the stored record.
 */
async unfollow(instrument: InstrumentRef, now: string): Promise<FollowedName>
```

Types: [InstrumentRef](market-data.md)

Source: [`packages/investment/followed-names/src/index.ts:63`](../../packages/investment/followed-names/src/index.ts)
<!-- END GENERATED cordis-surface -->
