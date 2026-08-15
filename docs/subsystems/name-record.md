# Name Record

English | [中文](name-record.zh.md)

The name record: everything the user has said and done about one instrument — the stance they hold, the decision chain behind it, and the conversations bound to it. One service over its own storage domain rather than a capability seam; there is nothing to swap a provider for.

Source: [`packages/investment/name-record/src/types.ts`](../../packages/investment/name-record/src/types.ts)

## The record does not depend on the watchlist

A user can open any instrument, write a thesis, and decide about following it later. Tying the record to the [follow flag](followed-names.md) would make "let me look at this first" impossible, and would delete a considered judgement the moment someone tidied their watchlist. Both are keyed `MARKET:SYMBOL`, so one identity addresses both without a join.

## Four kinds, one chain

Each kind answers a different question, and every surface switches on them, so the set is closed. Entries read newest first; storage keeps them oldest first so appending never rewrites the array's head.

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

**Verification is why the chain exists.** Theses and decisions are recorded elsewhere in the industry; hanging a thesis open, returning when it can be settled, and storing *how long that took* is calibration. `elapsedDays` is stored rather than derived, because it is the calibration figure and must not change when an entry is re-read.

A verification is the only write that touches an entry already stored. It settles exactly one open thesis and the verdict lands on both, so the chain agrees with itself whichever end is read. A thesis is answered once: a second verification is refused rather than allowed to overwrite the first, because a record that can be re-answered is not a calibration record.

## Provenance is required, not optional

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

A session source is what lets a surface link an entry back to the exact turn that produced it. Nothing extracts entries automatically yet; the shape is here for the memory system to write into.

## Every figure in the stance is entered by hand

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

`setStance` leaves absent fields as they are, so a surface editing one figure does not restate the others; `null` clears one explicitly. A first stance defaults to `watching`, because opening a name is not holding it, and a position outside 0–100 is refused.

## Time is a parameter

`append` and `setStance` take the instant to stamp rather than reading a clock, so the calibration figures stay reproducible under test. `bindSession` takes none: it records membership, not a moment.

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — this section is byte-identical in both language sides of the page. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

<a id="ctxnamerecord--namerecordservice"></a>

### `ctx.nameRecord` — `NameRecordService`

The name-record service. Registered as `ctx.nameRecord` (one instance per context).

```ts cordis-catalog
/**
 * Everything recorded about one name, read together. The browser's right
 * column shows the stance against the chain that produced it, so the two
 * must come from one observation rather than from two round trips.
 * @param instrument - the instrument to read.
 * @returns the stance, the chain newest first, and the bound sessions.
 */
@Remote('read') read(instrument: InstrumentRef): NameRecordView

/**
 * Record one entry, stamped now. The service takes the instant as a
 * parameter so its records stay reproducible under test; this is the entry
 * point that knows a user action happens at this moment.
 * @param instrument - the instrument the entry is about.
 * @param request - what to record.
 * @returns the stored entry.
 * @throws {@link NameRecordError} on every refusal {@link append} raises.
 */
@Remote('append') recordEntry(instrument: InstrumentRef, request: ChainEntryRequest): Promise<ChainEntry>

/**
 * Set where the user stands, stamped now.
 * @param instrument - the instrument to set.
 * @param request - the fields to change.
 * @returns the stored stance.
 * @throws {@link NameRecordError} when a position is outside 0..100.
 */
@Remote('setStance') updateStance(instrument: InstrumentRef, request: StanceRequest): Promise<NameStance>

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
@Remote('bindSession') async bindSession(instrument: InstrumentRef, sessionId: SessionId): Promise<readonly SessionId[]>
```

Types: [InstrumentRef](market-data.md) · [SessionId](core.md)

Source: [`packages/investment/name-record/src/index.ts:92`](../../packages/investment/name-record/src/index.ts)
<!-- END GENERATED cordis-surface -->
