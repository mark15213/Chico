# 标的记录

[English](name-record.md) | 中文

标的记录：用户关于一只标的说过和做过的一切——他持有的立场、支撑它的决策链路，以及绑定到它的对话。它是一个建立在自有存储域之上的服务，而不是能力接缝；没有任何可替换的提供方。

来源：[`packages/investment/name-record/src/types.ts`](../../packages/investment/name-record/src/types.ts)

## 记录不依赖自选

用户可以打开任何一只标的、写下一条判断，之后再决定要不要关注它。把记录绑到[关注标志](followed-names.md)上会让"我先看看"变得不可能，也会在有人整理自选表的那一刻删掉一个经过思考的判断。两者都以 `MARKET:SYMBOL` 作键，因此一个身份同时寻址两者，不需要连接表。

## 四种条目，一条链路

每一种回答不同的问题，而每个界面都要在它们上面分支，因此这个集合是封闭的。条目按最新在前读出；存储保持最旧在前，因此追加从不重写数组头部。

```ts type-equiv
/** Fields every entry carries, whatever its kind. */
interface ChainEntryBase {
  /** Service-minted identity. */
  readonly id: ChainEntryId
  /** The instrument this entry belongs to. */
  readonly instrument: InstrumentRef
  /** ISO-8601 instant the entry was recorded. */
  readonly recordedAt: string
  /** What the entry says, in the user's own words. */
  readonly body: string
  /** Where it came from. */
  readonly source: ChainSource
}
```

**验证是这条链路存在的理由。** 判断和决策业内别处也在记；把一条判断挂起来、等到能结账时回来、并且存下**隔了多久**——这才是校准。`elapsedDays` 是存下来的而不是推导的，因为它是校准数字，不能在重新读取一条记录时发生变化。

验证是唯一会触碰已存储条目的写操作。它恰好结清一条打开的判断，且结论同时落在两边，因此从任一端读这条链路都是一致的。一条判断只回答一次：第二次验证会被拒绝，而不是允许覆盖第一次，因为一份可以重新作答的记录不是校准记录。

## 来源是必填的，不是可选的

```ts type-equiv
/**
 * Where an entry came from. Provenance is required rather than optional: a
 * record that cannot say where it came from gives the user no reason to trust
 * it, and the whole point of the chain is that it is auditable.
 */
type ChainSource =
  | {
    /** The user wrote it directly. */
    readonly kind: 'manual'
  }
  | {
    /** It was extracted from, or recorded during, a conversation. */
    readonly kind: 'session'
    /** The conversation it came from. */
    readonly sessionId: SessionId
    /** The 1-based turn within that conversation. */
    readonly turn: number
  }
```

会话来源正是让界面把一条记录链回产生它的那一轮的东西。目前还没有任何东西自动提取条目；这个形状是为记忆系统准备的写入位置。

## 立场里的每个数字都由用户手动录入

```ts type-equiv
/**
 * The user's current position on one instrument. Every figure is entered by
 * hand: the harness has no broker connection, and a position the product
 * guessed would be worse than one it does not claim to know.
 */
interface NameStance {
  /** The instrument this stance is about. */
  readonly instrument: InstrumentRef
  /** Where the user stands. */
  readonly posture: StancePosture
  /** Position as a percent of the book, or null when the user has not said. */
  readonly positionPercent: number | null
  /** How sure the user is, or null when they have not said. */
  readonly conviction: 'low' | 'medium' | 'high' | null
  /** ISO-8601 instant of the last change. */
  readonly updatedAt: string
}
```

`setStance` 保留调用方没有提及的字段，因此编辑一个数字的界面不必复述其余的；`null` 显式清空一个。首次设置默认为 `watching`，因为打开一只标的并不等于持有它，而超出 0–100 的仓位会被拒绝。

## 时间是参数

`append` 和 `setStance` 接收要打的时间戳而不是读时钟，好让校准数字在测试下可复现。`bindSession` 不接收：它记录的是归属，不是时刻。

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — this section is byte-identical in both language sides of the page. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

<a id="ctxnamerecord--namerecordservice"></a>

### `ctx.nameRecord` — `NameRecordService`

The name-record service. Registered as `ctx.nameRecord` (one instance per context).

```ts cordis-catalog
/**
 * One name's decision chain, newest first.
 * @param instrument - the instrument to read.
 * @returns a snapshot array; empty when nothing has been recorded.
 */
chain(instrument: InstrumentRef): readonly ChainEntry[]

/**
 * One name's stance.
 * @param instrument - the instrument to read.
 * @returns the stance, or `undefined` until the user sets one.
 */
stance(instrument: InstrumentRef): NameStance | undefined

/**
 * The theses still waiting to be settled.
 * @param instrument - the instrument to read.
 * @returns the open theses, newest first.
 */
openTheses(instrument: InstrumentRef): readonly ChainEntry[]

/**
 * The conversations bound to one name, in the order they were bound.
 * @param instrument - the instrument to read.
 * @returns a snapshot array of session ids.
 */
sessions(instrument: InstrumentRef): readonly SessionId[]

/**
 * Record one entry. A verification also settles the thesis it names, which
 * is the only write that touches an entry already stored: a thesis is
 * answered exactly once, and the answer belongs on both.
 * @param instrument - the instrument the entry is about.
 * @param request - what to record.
 * @param now - ISO-8601 instant to stamp, supplied by the caller so the
 *   record stays free of a clock and reproducible in tests.
 * @returns the stored entry.
 * @throws {@link NameRecordError} for an empty body, or a verification
 *   naming an entry that is missing, not a thesis, from another name, or
 *   already settled.
 */
async append(instrument: InstrumentRef, request: ChainEntryRequest, now: string): Promise<ChainEntry>

/**
 * Set where the user stands. Absent fields keep their current value, so a
 * surface that edits one figure does not have to restate the others.
 * @param instrument - the instrument to set.
 * @param request - the fields to change.
 * @param now - ISO-8601 instant to stamp.
 * @returns the stored stance.
 * @throws {@link NameRecordError} when a position is outside 0..100.
 */
async setStance(instrument: InstrumentRef, request: StanceRequest, now: string): Promise<NameStance>

/**
 * Bind a conversation to a name, so the name's surfaces can list it and the
 * chain's provenance links can reach it. Binding the same session twice is a
 * no-op rather than an error, because a surface may bind on every send.
 * @param instrument - the instrument the conversation is about.
 * @param sessionId - the conversation to bind.
 * @returns the bound sessions in order.
 */
async bindSession(instrument: InstrumentRef, sessionId: SessionId): Promise<readonly SessionId[]>
```

Types: [InstrumentRef](market-data.md) · [SessionId](core.md)

Source: [`packages/investment/name-record/src/index.ts:86`](../../packages/investment/name-record/src/index.ts)
<!-- END GENERATED cordis-surface -->
