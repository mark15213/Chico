/**
 * Name record over the real storage/domain composition: the chain's order and
 * provenance, the verification that settles exactly one open thesis, the
 * stance whose absent fields keep their value, the session binding, and every
 * loud refusal.
 */
import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import InvariantRegistry from '@deepseek-ai/dsh-invariants'
import Storage from '@deepseek-ai/dsh-storage'
import { DomainFacility } from '@deepseek-ai/dsh-storage-domain'
import { MemoryMediaPool, MemoryStorageBackend } from '../../../storage/storage-domain/tests/helpers/memory-backend.ts'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import NameRecordService, { NameRecordError, type ChainEntryId } from '../src/index.ts'
import * as NameRecordInvariant from '../src/invariant.ts'

const CATL = { market: 'SZSE', symbol: '300750' } as const
const MOUTAI = { market: 'SSE', symbol: '600519' } as const

const T1 = '2026-06-15T02:00:00.000Z'
const T2 = '2026-07-20T02:00:00.000Z'
const T3 = '2026-08-15T02:00:00.000Z'

const MANUAL = { kind: 'manual' } as const
const FROM_SESSION = { kind: 'session', sessionId: 'sess-1' as SessionId, turn: 4 } as const

/** Boot the record over the real storage/domain composition. */
async function bench() {
  const ctx = new Context()
  await ctx.plugin(Storage)
  ctx.storage.backend.register('memory', new MemoryStorageBackend(new MemoryMediaPool()))
  const facility = new DomainFacility(ctx, { backend: 'memory', routes: {} })
  ctx.storage.mount('domain', facility)
  ctx.provide('storageDomain', facility)
  await ctx.plugin(NameRecordService).await()
  return ctx
}

describe('the decision chain', () => {
  it('is empty for a name nothing was ever recorded about', async () => {
    const ctx = await bench()

    expect(ctx.nameRecord.chain(CATL)).toEqual([])
    expect(ctx.nameRecord.stance(CATL)).toBeUndefined()
    expect(ctx.nameRecord.sessions(CATL)).toEqual([])
  })

  it('reads newest first, whatever order entries were written in', async () => {
    const ctx = await bench()
    await ctx.nameRecord.append(CATL, { kind: 'thesis', body: '第一条', source: MANUAL }, T1)
    await ctx.nameRecord.append(CATL, { kind: 'decision', body: '第二条', source: MANUAL }, T2)

    expect(ctx.nameRecord.chain(CATL).map(entry => entry.body)).toEqual(['第二条', '第一条'])
  })

  it('keeps each name to its own chain', async () => {
    const ctx = await bench()
    await ctx.nameRecord.append(CATL, { kind: 'event', body: '宁德', source: MANUAL }, T1)
    await ctx.nameRecord.append(MOUTAI, { kind: 'event', body: '茅台', source: MANUAL }, T1)

    expect(ctx.nameRecord.chain(CATL).map(entry => entry.body)).toEqual(['宁德'])
    expect(ctx.nameRecord.chain(MOUTAI).map(entry => entry.body)).toEqual(['茅台'])
  })

  it('carries provenance, so a record can be traced back to the conversation', async () => {
    const ctx = await bench()

    const entry = await ctx.nameRecord.append(CATL, { kind: 'thesis', body: '毛利率见底', source: FROM_SESSION }, T1)

    expect(entry.source).toEqual({ kind: 'session', sessionId: 'sess-1', turn: 4 })
  })

  it('trims the body and refuses one that says nothing', async () => {
    const ctx = await bench()

    const entry = await ctx.nameRecord.append(CATL, { kind: 'decision', body: '  减仓  ', source: MANUAL }, T1)
    expect(entry.body).toBe('减仓')

    await expect(ctx.nameRecord.append(CATL, { kind: 'decision', body: '   ', source: MANUAL }, T1))
      .rejects.toMatchObject({ code: 'NAME_RECORD_EMPTY_BODY' })
  })

  it('gives every entry its own identity', async () => {
    const ctx = await bench()
    const first = await ctx.nameRecord.append(CATL, { kind: 'event', body: 'a', source: MANUAL }, T1)
    const second = await ctx.nameRecord.append(CATL, { kind: 'event', body: 'b', source: MANUAL }, T1)

    expect(first.id).not.toBe(second.id)
  })
})

describe('a thesis and its verification', () => {
  it('opens a thesis, and lists it as waiting until it is settled', async () => {
    const ctx = await bench()

    const thesis = await ctx.nameRecord.append(CATL, { kind: 'thesis', body: '毛利率见底', source: MANUAL }, T1)

    expect(thesis.kind === 'thesis' && thesis.resolution).toBe('open')
    expect(ctx.nameRecord.openTheses(CATL).map(entry => entry.id)).toEqual([thesis.id])
  })

  it('settles the thesis and records how long it took', async () => {
    const ctx = await bench()
    const thesis = await ctx.nameRecord.append(CATL, { kind: 'thesis', body: '毛利率见底', source: MANUAL }, T1)

    const verification = await ctx.nameRecord.append(CATL, {
      kind: 'verification', body: 'Q2 毛利率环比 +1.7pct', source: MANUAL, settles: thesis.id, verdict: 'confirmed',
    }, T2)

    expect(verification.kind === 'verification' && verification.elapsedDays).toBe(35)
    // The verdict lands on both: the chain reads either end and agrees.
    const settled = ctx.nameRecord.chain(CATL).find(entry => entry.id === thesis.id)
    expect(settled?.kind === 'thesis' && settled.resolution).toBe('confirmed')
    expect(ctx.nameRecord.openTheses(CATL)).toEqual([])
  })

  it('records a refuted thesis the same way, because a miss is the calibration', async () => {
    const ctx = await bench()
    const thesis = await ctx.nameRecord.append(CATL, { kind: 'thesis', body: '产能不及预期', source: MANUAL }, T1)

    await ctx.nameRecord.append(CATL, {
      kind: 'verification', body: '按期投产', source: MANUAL, settles: thesis.id, verdict: 'refuted',
    }, T2)

    const settled = ctx.nameRecord.chain(CATL).find(entry => entry.id === thesis.id)
    expect(settled?.kind === 'thesis' && settled.resolution).toBe('refuted')
  })

  it('answers a thesis exactly once', async () => {
    const ctx = await bench()
    const thesis = await ctx.nameRecord.append(CATL, { kind: 'thesis', body: '毛利率见底', source: MANUAL }, T1)
    await ctx.nameRecord.append(CATL, {
      kind: 'verification', body: '成立', source: MANUAL, settles: thesis.id, verdict: 'confirmed',
    }, T2)

    await expect(ctx.nameRecord.append(CATL, {
      kind: 'verification', body: '再来一次', source: MANUAL, settles: thesis.id, verdict: 'refuted',
    }, T3)).rejects.toMatchObject({ code: 'NAME_RECORD_THESIS_SETTLED' })
  })

  it('refuses to settle an entry that is not a thesis', async () => {
    const ctx = await bench()
    const decision = await ctx.nameRecord.append(CATL, { kind: 'decision', body: '减仓', source: MANUAL }, T1)

    await expect(ctx.nameRecord.append(CATL, {
      kind: 'verification', body: '?', source: MANUAL, settles: decision.id, verdict: 'confirmed',
    }, T2)).rejects.toMatchObject({ code: 'NAME_RECORD_NOT_A_THESIS' })
  })

  it('refuses an entry id from another name, since a chain is per instrument', async () => {
    const ctx = await bench()
    const thesis = await ctx.nameRecord.append(MOUTAI, { kind: 'thesis', body: '别家的', source: MANUAL }, T1)

    await expect(ctx.nameRecord.append(CATL, {
      kind: 'verification', body: '?', source: MANUAL, settles: thesis.id, verdict: 'confirmed',
    }, T2)).rejects.toMatchObject({ code: 'NAME_RECORD_UNKNOWN_ENTRY' })
  })

  it('refuses an id nothing ever minted', async () => {
    const ctx = await bench()

    await expect(ctx.nameRecord.append(CATL, {
      kind: 'verification', body: '?', source: MANUAL, settles: 'entry-nope' as ChainEntryId, verdict: 'confirmed',
    }, T2)).rejects.toMatchObject({ code: 'NAME_RECORD_UNKNOWN_ENTRY' })
  })

  it('floors the elapsed days rather than reporting a fraction', async () => {
    const ctx = await bench()
    const thesis = await ctx.nameRecord.append(CATL, { kind: 'thesis', body: 'x', source: MANUAL }, T1)

    const verification = await ctx.nameRecord.append(CATL, {
      kind: 'verification', body: 'y', source: MANUAL, settles: thesis.id, verdict: 'confirmed',
    }, '2026-06-16T01:00:00.000Z')

    expect(verification.kind === 'verification' && verification.elapsedDays).toBe(0)
  })
})

describe('the stance', () => {
  it('defaults to watching, since opening a name is not holding it', async () => {
    const ctx = await bench()

    const stance = await ctx.nameRecord.setStance(CATL, {}, T1)

    expect(stance).toEqual({
      instrument: CATL, posture: 'watching', positionPercent: null, conviction: null, updatedAt: T1,
    })
  })

  it('keeps the fields a caller did not mention', async () => {
    const ctx = await bench()
    await ctx.nameRecord.setStance(CATL, { posture: 'holding', positionPercent: 6, conviction: 'high' }, T1)

    const stance = await ctx.nameRecord.setStance(CATL, { positionPercent: 4 }, T2)

    expect(stance).toMatchObject({ posture: 'holding', positionPercent: 4, conviction: 'high', updatedAt: T2 })
  })

  it('clears a figure the user explicitly emptied', async () => {
    const ctx = await bench()
    await ctx.nameRecord.setStance(CATL, { positionPercent: 6 }, T1)

    expect((await ctx.nameRecord.setStance(CATL, { positionPercent: null }, T2)).positionPercent).toBeNull()
  })

  it('refuses a position outside the book', async () => {
    const ctx = await bench()

    await expect(ctx.nameRecord.setStance(CATL, { positionPercent: 101 }, T1))
      .rejects.toMatchObject({ code: 'NAME_RECORD_INVALID_POSITION' })
    await expect(ctx.nameRecord.setStance(CATL, { positionPercent: -1 }, T1))
      .rejects.toMatchObject({ code: 'NAME_RECORD_INVALID_POSITION' })
  })

  it('leaves the chain alone', async () => {
    const ctx = await bench()
    await ctx.nameRecord.append(CATL, { kind: 'thesis', body: '在的', source: MANUAL }, T1)

    await ctx.nameRecord.setStance(CATL, { posture: 'holding' }, T2)

    expect(ctx.nameRecord.chain(CATL)).toHaveLength(1)
  })
})

describe('sessions bound to a name', () => {
  it('records them in the order they were bound', async () => {
    const ctx = await bench()

    await ctx.nameRecord.bindSession(CATL, 'sess-1' as SessionId)
    await ctx.nameRecord.bindSession(CATL, 'sess-2' as SessionId)

    expect(ctx.nameRecord.sessions(CATL)).toEqual(['sess-1', 'sess-2'])
  })

  it('binds one session once, so a surface can bind on every send', async () => {
    const ctx = await bench()
    await ctx.nameRecord.bindSession(CATL, 'sess-1' as SessionId)

    expect(await ctx.nameRecord.bindSession(CATL, 'sess-1' as SessionId)).toEqual(['sess-1'])
  })

  it('leaves the stance and chain alone', async () => {
    const ctx = await bench()
    await ctx.nameRecord.setStance(CATL, { posture: 'holding' }, T1)
    await ctx.nameRecord.append(CATL, { kind: 'thesis', body: '在的', source: MANUAL }, T1)

    await ctx.nameRecord.bindSession(CATL, 'sess-1' as SessionId)

    expect(ctx.nameRecord.stance(CATL)?.posture).toBe('holding')
    expect(ctx.nameRecord.chain(CATL)).toHaveLength(1)
  })
})

describe('name-record errors', () => {
  it('carries a code and a distinguishable name', () => {
    const error = new NameRecordError('nope', 'NAME_RECORD_EMPTY_BODY')

    expect(error.code).toBe('NAME_RECORD_EMPTY_BODY')
    expect(error.name).toBe('NameRecordError')
    expect(error).toBeInstanceOf(Error)
  })
})

describe('service lifecycle', () => {
  it('withdraws ctx.nameRecord when its fiber disposes (HMR safety)', async () => {
    const ctx = new Context()
    await ctx.plugin(Storage)
    ctx.storage.backend.register('memory', new MemoryStorageBackend(new MemoryMediaPool()))
    const facility = new DomainFacility(ctx, { backend: 'memory', routes: {} })
    ctx.storage.mount('domain', facility)
    ctx.provide('storageDomain', facility)
    const fiber = ctx.plugin(NameRecordService)
    await fiber.await()

    await fiber.dispose()

    expect(ctx.get('nameRecord')).toBeUndefined()
  })

  it('reserves package ownership under its declared companion name', async () => {
    const ctx = new Context()
    await ctx.plugin(InvariantRegistry, { enabled: true })
    const fiber = ctx.plugin(NameRecordInvariant)
    await fiber.await()

    expect(NameRecordInvariant.name).toBe('name-record-invariant')
    expect(NameRecordInvariant.inject).toEqual(['invariants'])
    await fiber.dispose()
  })
})
