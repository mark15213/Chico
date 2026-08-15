/**
 * Name record (`ctx.nameRecord`): everything the user has said and done about
 * one instrument — the stance they hold, the decision chain behind it, and the
 * conversations bound to it. Also the `nameRecord` Typert Remote namespace,
 * because the workbench's right column is the record's only surface.
 *
 * It is deliberately independent of whether the name is followed. A user can
 * open any instrument, write a thesis, and decide about the watchlist later;
 * tying the record to the follow flag would make "let me look at this first"
 * impossible.
 * @module @deepseek-ai/dsh-name-record
 */

import { Context, Service } from '@deepseek-ai/cordis'
import { TypertRemoteService, Remote } from '@deepseek-ai/dsh-typert-protocol'
// Typert-generated ./typert and ./remote artifacts import Zod at runtime.
import type {} from 'zod'
import type { KvTable } from '@deepseek-ai/dsh-storage-domain'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { InstrumentRef } from '@deepseek-ai/dsh-market-data'
import { nameRecordDomainSpec, type NameRecordRow } from './spec.ts'
import type {
  ChainEntry,
  ChainEntryId,
  ChainEntryRequest,
  NameRecordView,
  NameStance,
  StanceRequest,
} from './types.ts'
import { NameRecordError } from './types.ts'

export { NameRecordError } from './types.ts'
export type {
  ChainEntry,
  ChainEntryId,
  ChainEntryRequest,
  ChainSource,
  NameRecordErrorCode,
  NameRecordView,
  NameStance,
  StancePosture,
  StanceRequest,
  ThesisResolution,
} from './types.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    nameRecord: NameRecordService
  }
}

/** Milliseconds in one day, for the calibration figure a verification stores. */
const DAY_MS = 86_400_000

/** An empty record, so a first write has something to append to. */
const EMPTY: NameRecordRow = { chain: [], sessions: [] }

/** Record key for one instrument: the same identity the registry keys by. */
function recordKey(instrument: InstrumentRef): string {
  return `${instrument.market}:${instrument.symbol}`
}

/** The body as it should be stored, or a loud refusal for an empty one. */
function resolveBody(body: string): string {
  const trimmed = body.trim()
  if (trimmed.length === 0) {
    throw new NameRecordError(
      'a chain entry needs a body with a non-whitespace character',
      'NAME_RECORD_EMPTY_BODY',
    )
  }
  return trimmed
}

/**
 * Re-brand stored session ids at the durable boundary: the row schema stores
 * them as strings, and this is the one place that knows they are session ids.
 */
function brandSessions(stored: readonly string[]): readonly SessionId[] {
  return stored as readonly SessionId[]
}

/** Whole days between two instants, floored, never negative. */
function daysBetween(from: string, to: string): number {
  return Math.max(0, Math.floor((Date.parse(to) - Date.parse(from)) / DAY_MS))
}

/**
 * The name-record service. Registered as `ctx.nameRecord` (one instance per
 * context).
 */
export class NameRecordService extends TypertRemoteService {
  static inject = ['storageDomain']

  private table?: KvTable<string, NameRecordRow>
  private counter = 0

  /** @param ctx - Host context carrying the storage-domain form. */
  constructor(ctx: Context) {
    super(ctx, 'nameRecord')
  }

  /**
   * Everything recorded about one name, read together. The browser's right
   * column shows the stance against the chain that produced it, so the two
   * must come from one observation rather than from two round trips.
   * @param instrument - the instrument to read.
   * @returns the stance, the chain newest first, and the bound sessions.
   */
  @Remote('read')
  read(instrument: InstrumentRef): NameRecordView {
    return {
      stance: this.stance(instrument) ?? null,
      chain: this.chain(instrument),
      sessions: this.sessions(instrument),
    }
  }

  /**
   * Record one entry, stamped now. The service takes the instant as a
   * parameter so its records stay reproducible under test; this is the entry
   * point that knows a user action happens at this moment.
   * @param instrument - the instrument the entry is about.
   * @param request - what to record.
   * @returns the stored entry.
   * @throws {@link NameRecordError} on every refusal {@link append} raises.
   */
  @Remote('append')
  recordEntry(instrument: InstrumentRef, request: ChainEntryRequest): Promise<ChainEntry> {
    return this.append(instrument, request, new Date().toISOString())
  }

  /**
   * Set where the user stands, stamped now.
   * @param instrument - the instrument to set.
   * @param request - the fields to change.
   * @returns the stored stance.
   * @throws {@link NameRecordError} when a position is outside 0..100.
   */
  @Remote('setStance')
  updateStance(instrument: InstrumentRef, request: StanceRequest): Promise<NameStance> {
    return this.setStance(instrument, request, new Date().toISOString())
  }

  /** Open the record's own domain. */
  protected async [Service.init](): Promise<void> {
    const domain = await this.ctx.storageDomain.open(nameRecordDomainSpec)
    this.ctx.effect(() => () => domain.close(), 'name-record.domainClose')
    this.table = domain.table('names')
  }

  /**
   * One name's decision chain, newest first.
   * @param instrument - the instrument to read.
   * @returns a snapshot array; empty when nothing has been recorded.
   */
  chain(instrument: InstrumentRef): readonly ChainEntry[] {
    return [...this.row(instrument).chain].reverse()
  }

  /**
   * One name's stance.
   * @param instrument - the instrument to read.
   * @returns the stance, or `undefined` until the user sets one.
   */
  stance(instrument: InstrumentRef): NameStance | undefined {
    return this.row(instrument).stance
  }

  /**
   * The theses still waiting to be settled.
   * @param instrument - the instrument to read.
   * @returns the open theses, newest first.
   */
  openTheses(instrument: InstrumentRef): readonly ChainEntry[] {
    return this.chain(instrument).filter(entry => entry.kind === 'thesis' && entry.resolution === 'open')
  }

  /**
   * The conversations bound to one name, in the order they were bound.
   * @param instrument - the instrument to read.
   * @returns a snapshot array of session ids.
   */
  sessions(instrument: InstrumentRef): readonly SessionId[] {
    return brandSessions(this.row(instrument).sessions)
  }

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
  async append(instrument: InstrumentRef, request: ChainEntryRequest, now: string): Promise<ChainEntry> {
    const body = resolveBody(request.body)
    const key = recordKey(instrument)
    const row = this.row(instrument)
    const base = { id: this.mintId(), instrument, recordedAt: now, body, source: request.source }

    if (request.kind !== 'verification') {
      const entry: ChainEntry = request.kind === 'thesis'
        ? { ...base, kind: 'thesis', resolution: 'open' }
        : { ...base, kind: request.kind }
      await this.requireTable().put(key, { ...row, chain: [...row.chain, entry] })
      return entry
    }

    const thesis = this.expectOpenThesis(row, instrument, request.settles)
    const entry: ChainEntry = {
      ...base,
      kind: 'verification',
      settles: request.settles,
      verdict: request.verdict,
      elapsedDays: daysBetween(thesis.recordedAt, now),
    }
    const chain = row.chain.map(current => current.id === thesis.id && current.kind === 'thesis'
      ? { ...current, resolution: request.verdict }
      : current)
    await this.requireTable().put(key, { ...row, chain: [...chain, entry] })
    return entry
  }

  /**
   * Set where the user stands. Absent fields keep their current value, so a
   * surface that edits one figure does not have to restate the others.
   * @param instrument - the instrument to set.
   * @param request - the fields to change.
   * @param now - ISO-8601 instant to stamp.
   * @returns the stored stance.
   * @throws {@link NameRecordError} when a position is outside 0..100.
   */
  async setStance(instrument: InstrumentRef, request: StanceRequest, now: string): Promise<NameStance> {
    const position = request.positionPercent
    if (position !== undefined && position !== null && (position < 0 || position > 100)) {
      throw new NameRecordError(
        `position must be between 0 and 100 percent, got ${position}`,
        'NAME_RECORD_INVALID_POSITION',
      )
    }
    const key = recordKey(instrument)
    const row = this.row(instrument)
    const current = row.stance
    const stance: NameStance = {
      instrument,
      posture: request.posture ?? current?.posture ?? 'watching',
      positionPercent: request.positionPercent === undefined
        ? current?.positionPercent ?? null
        : request.positionPercent,
      conviction: request.conviction === undefined ? current?.conviction ?? null : request.conviction,
      updatedAt: now,
    }
    await this.requireTable().put(key, { ...row, stance })
    return stance
  }

  /**
   * Bind a conversation to a name, so the name's surfaces can list it and the
   * chain's provenance links can reach it. Binding the same session twice is a
   * no-op rather than an error, because a surface may bind on every send.
   * @param instrument - the instrument the conversation is about.
   * @param sessionId - the conversation to bind.
   * @returns the bound sessions in order.
   */
  @Remote('bindSession')
  async bindSession(instrument: InstrumentRef, sessionId: SessionId): Promise<readonly SessionId[]> {
    const row = this.row(instrument)
    if (row.sessions.includes(sessionId)) return brandSessions(row.sessions)
    const sessions = [...row.sessions, sessionId]
    await this.requireTable().put(recordKey(instrument), { ...row, sessions })
    return brandSessions(sessions)
  }

  /** One name's whole row, or the empty record for a name never written. */
  private row(instrument: InstrumentRef): NameRecordRow {
    return this.requireTable().get(recordKey(instrument)) ?? EMPTY
  }

  /** The named thesis, or the loud refusal explaining which rule it broke. */
  private expectOpenThesis(row: NameRecordRow, instrument: InstrumentRef, id: ChainEntryId): ChainEntry {
    const entry = row.chain.find(current => current.id === id)
    if (entry === undefined) {
      throw new NameRecordError(
        `no chain entry ${id} on ${recordKey(instrument)}`,
        // A caller holding an id from another name reaches this too: entries
        // are only ever looked up within the name they belong to.
        'NAME_RECORD_UNKNOWN_ENTRY',
      )
    }
    if (entry.kind !== 'thesis') {
      throw new NameRecordError(`chain entry ${id} is a ${entry.kind}, not a thesis`, 'NAME_RECORD_NOT_A_THESIS')
    }
    if (entry.resolution !== 'open') {
      throw new NameRecordError(`thesis ${id} was already ${entry.resolution}`, 'NAME_RECORD_THESIS_SETTLED')
    }
    return entry
  }

  /**
   * A fresh entry id. Process-local and monotonic within one run, combined
   * with the row it lands in: entries are only ever compared inside one name.
   */
  private mintId(): ChainEntryId {
    this.counter += 1
    return `entry-${this.counter}-${this.stamp()}` as ChainEntryId
  }

  /** Uniqueness across process restarts, which the counter alone cannot give. */
  private stamp(): string {
    return Math.floor(performance.timeOrigin + performance.now()).toString(36)
  }

  /** The open table, or a loud failure if a caller beat `Service.init`. */
  private requireTable(): KvTable<string, NameRecordRow> {
    const table = this.table
    /* v8 ignore next -- Service.init opens the table before any consumer can inject the service. */
    if (table === undefined) throw new Error('name-record domain is not open')
    return table
  }
}

export default NameRecordService
