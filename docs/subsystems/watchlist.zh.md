# 自选

[English](watchlist.md) | 中文

自选投影：把[关注标的注册表](followed-names.md)与[行情接缝](market-data.md)的报价连接起来，面向浏览器，以 `watchlist` 这个 Typert Remote 命名空间暴露。

来源：[`packages/investment/watchlist/src/types.ts`](../../packages/investment/watchlist/src/types.ts)

## 它消费两个接缝，而不是成为第三个接缝

注册表不知道价格，行情接缝也不知道用户关注了什么。保持这一点是刻意的：记录能挺过一次提供方更换，而提供方服务的消费方里也有从未听说过自选表的。要在一个界面上把名字和价格并排显示就需要两者，因此连接放在一个消费方包里——它依赖两者，而两者都不依赖它。

行是记录的**呈现**，不是记录本身。`followed` 和 `updatedAt` 留在 `ctx.followedNames` 之后，因为一份关注列表里没有已取消关注的行需要区分，也没有消费方需要最后变更时刻。

```ts type-equiv
/**
 * One followed name as the watchlist presents it: the durable record joined
 * with the instrument's current quote.
 */
interface WatchlistRow {
  /** The instrument this row describes. */
  readonly instrument: InstrumentRef
  /**
   * The name as the record holds it. This is what the user follows by and is
   * not rewritten when a venue renames a listing, so it can differ from
   * {@link Quote.name} on the same row.
   */
  readonly displayName: string
  /** ISO-8601 instant of the first follow, which is the row's age. */
  readonly firstFollowedAt: string
  /**
   * How many of this name's theses are still waiting to be settled. The
   * marker a list draws from it is the product's own: a general agent neither
   * remembers what you claimed nor tells you it is time to check.
   */
  readonly openTheses: number
  /**
   * Current quote, or `null` when the provider could not price this
   * instrument. A row that cannot be priced still belongs on the watchlist:
   * a suspended or delisted name is exactly the one a user needs to see.
   */
  readonly quote: Quote | null
}
```

## 降级的是一行，不是整次调用

报价失败只让它自己那一行降级为 `quote: null`。一份因为某只持仓报不出价就整体消失的自选表，比显示一个短横线更糟，而且那只停止交易的标的通常正是用户在找的。

**选取**提供方的失败是例外，会让整次调用抛出：没有可用提供方、配置的提供方缺失或不可用、以及存在歧义，都是组合错误，而不是关于某个标的的事实。这些情况下每一行都会以完全相同的方式降级，因此一屏短横线会把一个配置错误的部署呈现为一次安静的数据缺口。

## 一只标的单独读取，只用一次调用

`dossier` 把记录、报价和日频历史一起返回。由三次往返拼出来的页面展示的是三个不同时刻，而拿一个数字和一张图作比较的专业用户，需要它们出自同一次观测。

两次行情读取各自独立降级：报不出价的标的仍然有记录、可能还有历史；没有历史的标的仍然有数字。页面讲的是记录，而记录在任一次拒绝下都存活。

它同样能读取已取消关注的记录，并如实标明。记录比标志活得久，因此从一条检索匹配进入的页面，无论该标的当前是否在列表中都成立。

## 检索是标的进入列表的路径

`search` 接收用户输入的内容，返回它所指向的上市标的，并逐条标出是否已经关注。正是这个标志让该操作属于这里而不是行情接缝：一个把已在列表中的标的再次提供为"加入"的选择器，是在请求用户犯错，而只有注册表知道这件事。

调用方传入自己将要绘制的 `limit`，而不是接收本包选定的一个数字，因为渲染列表的那个界面才知道自己能显示多少条。接缝会拒绝任何超过自身上限的取值。

已取消关注的记录会被报告为**未**关注。因此选择器同时也是回到已移出标的的那条路：重新关注会连同原有的 `firstFollowedAt` 一起恢复记录。

## 关于一只标的的对话跑在哪里

`archive` 报告注册表的归档目录，好让浏览器栏位不必自己推导 Host 的文件系统路径，就能就一只标的开始一次对话。这个目录刻意不是一个[工作区](../architecture.md)：在本产品里标的才是工作单元，为每只标的注册一个工作区会让随手一瞥也在磁盘上留下一个目录。

## 关注时由交易场所解析名称

`follow` 接收交易场所和代码，在记录任何东西之前先读取报价，这既证明了该上市标的存在，也提供了显示名。调用方不传名字：敲下 `SZSE:300750` 的用户并不知道它，而浏览器随便猜一个就会把错误的名字写进持久记录。

未上市的代码是用户敲键盘唯一会造成的失败，因此它以取值而不是抛出错误的形式返回——RPC 层会把抛出的错误压平成一个不带机器可读原因的内部失败，那会让界面说不出到底出了什么问题。

```ts type-equiv
/**
 * Outcome of following an instrument. A code the venue does not list is the
 * one failure a user causes by typing, so it travels as a value rather than a
 * thrown error, which the RPC layer would flatten into an internal failure.
 */
type WatchlistFollowResult =
  | {
    /** The instrument was followed. */
    readonly ok: true
    /** The stored row, carrying the quote that resolved the display name. */
    readonly row: WatchlistRow
  }
  | {
    /** Nothing was recorded. */
    readonly ok: false
    /** The venue does not list this code. */
    readonly reason: 'unknown-instrument'
  }
```

两个写操作都打当前时刻。注册表把时间作为参数，好让它的记录在测试下可复现；本投影正是那个知道"用户动作发生在此刻"的调用方。

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — this section is byte-identical in both language sides of the page. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

<a id="ctxwatchlist--watchlistservice"></a>

### `ctx.watchlist` — `WatchlistService`

The watchlist service. Registered as `ctx.watchlist` (one instance per context) and reachable from a browser as the `watchlist` Remote namespace.

```ts cordis-catalog
/**
 * Every followed name with its current quote, priced concurrently.
 *
 * A quote that fails degrades its own row to `quote: null`, except when the
 * failure is provider selection, which raises for the whole call.
 * @param signal - optional cancellation signal, forwarded to each quote.
 * @returns the current rows in the registry's own order.
 * @throws {@link MarketDataError} when no usable provider can be selected.
 */
@Remote('list') async list(signal?: AbortSignal): Promise<WatchlistSnapshot>

/**
 * Where a conversation about a name runs.
 * @returns the archive directory the registry owns.
 */
@Remote('archive') archive(): ArchiveLocation

/**
 * Find the listings a typed query names, each marked with whether it is
 * already followed. This is the path onto the watchlist: a user knows a name
 * far more often than a venue and a code.
 * @param query - what the user typed: a code, a name, or part of either.
 * @param limit - how many matches the caller will present. Passed rather
 *   than fixed here, because the surface drawing the list is what knows how
 *   many it can show; the seam refuses a limit above its own ceiling.
 * @param signal - optional cancellation signal, so a keystroke supersedes
 *   the lookup the previous one started.
 * @returns the matched listings, best first.
 * @throws {@link MarketDataError} when no usable provider can be selected,
 *   when the limit is above the seam's ceiling, or when the selected
 *   provider's feed has no lookup endpoint.
 */
@Remote('search') async search(query: string, limit: number, signal?: AbortSignal): Promise<WatchlistSearchResult>

/**
 * One followed name read on its own, with the session history behind its
 * figures. The quote and the history each degrade to absent rather than
 * failing the page, on the same rule the rows use.
 * @param instrument - the venue and code to read.
 * @param sessions - how many sessions of history the caller will draw.
 * @param signal - optional cancellation signal, forwarded to both reads.
 * @returns the record joined with its quote and bars.
 * @throws {@link FollowedNameError} when no record exists for the instrument.
 * @throws {@link MarketDataError} when no usable provider can be selected, or
 *   when `sessions` is above the seam's ceiling.
 */
@Remote('dossier') async dossier(instrument: InstrumentRef, sessions: number, signal?: AbortSignal): Promise<NameDossier>

/**
 * Follow an instrument named by venue and code, taking its display name from
 * the venue rather than from the caller. Re-following a name that was
 * unfollowed restores it with its original `firstFollowedAt`.
 * @param instrument - the venue and code to follow.
 * @param signal - optional cancellation signal for the resolving quote.
 * @returns the stored row, or the unknown-instrument outcome.
 * @throws {@link MarketDataError} when no usable provider can be selected.
 */
@Remote('follow') async follow(instrument: InstrumentRef, signal?: AbortSignal): Promise<WatchlistFollowResult>

/**
 * Take an instrument off the watchlist. The record survives, so a later
 * re-follow keeps everything recorded about the name.
 * @param instrument - the venue and code to unfollow.
 * @returns the followed count after the change, so a caller can reconcile
 *   without a second round trip.
 * @throws {@link FollowedNameError} when no record exists for the instrument.
 */
@Remote('unfollow') async unfollow(instrument: InstrumentRef): Promise<number>
```

Types: [InstrumentRef](market-data.md)

Source: [`packages/investment/watchlist/src/index.ts:68`](../../packages/investment/watchlist/src/index.ts)
<!-- END GENERATED cordis-surface -->
