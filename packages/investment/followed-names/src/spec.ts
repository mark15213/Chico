/**
 * Durable storage-domain declaration for the followed-names registry.
 * @module @deepseek-ai/dsh-followed-names/src/spec
 */

import { z } from 'zod'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'
import type { FollowedName } from './types.ts'

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

/**
 * Runtime schema for one followed-name record. `followed: false` is a normal
 * stored state rather than an absent row: unfollowing keeps the record.
 */
export const followedNameSchema = z.object({
  instrument: instrumentSchema,
  displayName: z.string().min(1),
  followed: z.boolean(),
  firstFollowedAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
}) as unknown as z.ZodType<FollowedName>

/**
 * One record per instrument, keyed by `MARKET:SYMBOL`. The key is derived from
 * the instrument rather than generated, because the instrument is the identity
 * — two records for one listing would make the watchlist ambiguous.
 */
export const followedNamesDomainSpec = defineDomain({
  name: 'followed_names',
  version: 0,
  tables: {
    names: domainTable<string, FollowedName>(followedNameSchema),
  },
})
