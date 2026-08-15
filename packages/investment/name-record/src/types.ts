/**
 * Public type vocabulary of the name record: the stance a user holds on one
 * instrument, the decision-chain entries behind it, and the errors the service
 * raises.
 * @module @deepseek-ai/dsh-name-record/src/types
 */

import type { Branded } from '@deepseek-ai/dsh-brand'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { InstrumentRef } from '@deepseek-ai/dsh-market-data'

/** Opaque identity of one decision-chain entry, minted by the service. */
export type ChainEntryId = Branded<'ChainEntryId'>

/**
 * Where an entry came from. Provenance is required rather than optional: a
 * record that cannot say where it came from gives the user no reason to trust
 * it, and the whole point of the chain is that it is auditable.
 */
export type ChainSource =
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

/** How a thesis stands today. */
export type ThesisResolution = 'open' | 'confirmed' | 'refuted'

/**
 * One entry in a name's decision chain. The kinds are closed because each
 * answers a different question and the surfaces switch on them: a thesis is
 * what the user believes, a decision is what they did, an event is what
 * happened, and a verification is how a thesis turned out.
 */
export type ChainEntry =
  | (ChainEntryBase & {
    /** What the user believes about this name. */
    readonly kind: 'thesis'
    /**
     * Whether the thesis is still waiting to be settled. `open` is what makes
     * a name show the unverified marker, and what a later verification closes.
     */
    readonly resolution: ThesisResolution
  })
  | (ChainEntryBase & {
    /** What the user did, including deciding not to act. */
    readonly kind: 'decision'
  })
  | (ChainEntryBase & {
    /** What happened to the instrument. */
    readonly kind: 'event'
  })
  | (ChainEntryBase & {
    /** How one thesis turned out. */
    readonly kind: 'verification'
    /** The thesis this settles. */
    readonly settles: ChainEntryId
    /** Whether the thesis held. */
    readonly verdict: 'confirmed' | 'refuted'
    /**
     * Days between the thesis and this verification. Stored rather than
     * derived, because it is the calibration figure and must not change when
     * an entry is re-read.
     */
    readonly elapsedDays: number
  })

/** What a caller asks the service to record. Identity and time are the service's. */
export type ChainEntryRequest =
  | { readonly kind: 'thesis'; readonly body: string; readonly source: ChainSource }
  | { readonly kind: 'decision'; readonly body: string; readonly source: ChainSource }
  | { readonly kind: 'event'; readonly body: string; readonly source: ChainSource }
  | {
    readonly kind: 'verification'
    readonly body: string
    readonly source: ChainSource
    /** The thesis this settles; it must exist, be a thesis, and be open. */
    readonly settles: ChainEntryId
    /** Whether the thesis held. */
    readonly verdict: 'confirmed' | 'refuted'
  }

/** Where the user stands on one name today. */
export type StancePosture = 'holding' | 'watching' | 'avoiding'

/**
 * The user's current position on one instrument. Every figure is entered by
 * hand: the harness has no broker connection, and a position the product
 * guessed would be worse than one it does not claim to know.
 */
export interface NameStance {
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

/** What a caller asks the service to set. Absent fields are left as they are. */
export interface StanceRequest {
  /** Where the user stands. */
  readonly posture?: StancePosture
  /** Position as a percent of the book; `null` clears it. */
  readonly positionPercent?: number | null
  /** How sure the user is; `null` clears it. */
  readonly conviction?: 'low' | 'medium' | 'high' | null
}

/** Reasons the name-record service refuses a request. */
export type NameRecordErrorCode =
  | 'NAME_RECORD_EMPTY_BODY'
  | 'NAME_RECORD_UNKNOWN_ENTRY'
  | 'NAME_RECORD_NOT_A_THESIS'
  | 'NAME_RECORD_THESIS_SETTLED'
  | 'NAME_RECORD_ENTRY_FOREIGN'
  | 'NAME_RECORD_INVALID_POSITION'

/** Error thrown by the name-record service. */
export class NameRecordError extends Error {
  /**
   * @param message - human-readable cause.
   * @param code - the machine-readable reason.
   */
  constructor(message: string, readonly code: NameRecordErrorCode) {
    super(message)
    this.name = 'NameRecordError'
  }
}
