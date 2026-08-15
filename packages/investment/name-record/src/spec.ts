/**
 * Durable storage-domain declaration for the name record: one row per
 * instrument holding its stance, its decision chain, and the sessions bound to
 * it. One row rather than three tables because every read is "everything about
 * this name" and the three are written together.
 * @module @deepseek-ai/dsh-name-record/src/spec
 */

import { z } from 'zod'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'
import type { ChainEntry, NameStance } from './types.ts'

/** Runtime schema for the venue union the market-data seam declares. */
const marketSchema = z.union([
  z.literal('SSE'),
  z.literal('SZSE'),
  z.literal('BSE'),
  z.literal('HKEX'),
  z.literal('NASDAQ'),
  z.literal('NYSE'),
])

/** Runtime schema for one instrument reference. */
const instrumentSchema = z.object({
  market: marketSchema,
  symbol: z.string().min(1),
})

/** Runtime schema for an entry's provenance. */
const sourceSchema = z.union([
  z.object({ kind: z.literal('manual') }),
  z.object({
    kind: z.literal('session'),
    sessionId: z.string().min(1),
    turn: z.number().int().min(1),
  }),
])

const baseFields = {
  id: z.string().min(1),
  instrument: instrumentSchema,
  recordedAt: z.iso.datetime(),
  body: z.string().min(1),
  source: sourceSchema,
}

/** Runtime schema for one chain entry, discriminated exactly as the type is. */
const entrySchema = z.discriminatedUnion('kind', [
  z.object({
    ...baseFields,
    kind: z.literal('thesis'),
    resolution: z.union([z.literal('open'), z.literal('confirmed'), z.literal('refuted')]),
  }),
  z.object({ ...baseFields, kind: z.literal('decision') }),
  z.object({ ...baseFields, kind: z.literal('event') }),
  z.object({
    ...baseFields,
    kind: z.literal('verification'),
    settles: z.string().min(1),
    verdict: z.union([z.literal('confirmed'), z.literal('refuted')]),
    elapsedDays: z.number().int().min(0),
  }),
]) as unknown as z.ZodType<ChainEntry>

/** Runtime schema for one name's stance. */
const stanceSchema = z.object({
  instrument: instrumentSchema,
  posture: z.union([z.literal('holding'), z.literal('watching'), z.literal('avoiding')]),
  positionPercent: z.number().min(0).max(100).nullable(),
  conviction: z.union([z.literal('low'), z.literal('medium'), z.literal('high')]).nullable(),
  updatedAt: z.iso.datetime(),
}) as unknown as z.ZodType<NameStance>

/**
 * Everything recorded about one name, in insertion order for the chain. The
 * chain is stored oldest-first and reversed on read, so appending never
 * rewrites the array's head.
 */
export interface NameRecordRow {
  /** Where the user stands, or absent until they say. */
  readonly stance?: NameStance
  /** Decision-chain entries, oldest first. */
  readonly chain: readonly ChainEntry[]
  /** Sessions bound to this name, in the order they were bound. */
  readonly sessions: readonly string[]
}

/** Runtime schema for one name's whole record. */
export const nameRecordSchema = z.object({
  stance: stanceSchema.optional(),
  chain: z.array(entrySchema),
  sessions: z.array(z.string().min(1)),
}) as unknown as z.ZodType<NameRecordRow>

/**
 * One row per instrument, keyed by `MARKET:SYMBOL` — the same key the
 * followed-names registry uses, so a name's record and its follow flag are
 * addressable by the same identity without a join table.
 */
export const nameRecordDomainSpec = defineDomain({
  name: 'name_records',
  version: 0,
  tables: {
    names: domainTable<string, NameRecordRow>(nameRecordSchema),
  },
})
