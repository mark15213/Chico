/**
 * Chico bundle composition: what the patch layer actually inserts, read from
 * the shipped `cordis.patch.yml` rather than from a restatement, plus the
 * empty plugin body and the invariant companion's ownership reservation.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import { load } from 'js-yaml'
import { describe, expect, it } from 'vitest'
import InvariantRegistry from '@deepseek-ai/dsh-invariants'
import { apply, name } from '../src/index.ts'
import * as ChicoInvariant from '../src/invariant.ts'

/** One row of the parsed patch layer. */
interface PatchRow {
  id?: string
  name?: string
  disabled?: boolean
  config?: Record<string, unknown>
  insert?: PatchRow[]
}

const patch = load(
  readFileSync(fileURLToPath(new URL('../cordis.patch.yml', import.meta.url)), 'utf8'),
) as PatchRow[]

/** Every inserted row, flattened out of the patch's insert groups. */
const inserted = patch.flatMap(row => row.insert ?? [])

/** Find one inserted row by id. */
function insertedRow(id: string): PatchRow | undefined {
  return inserted.find(row => row.id === id)
}

describe('chico bundle patch', () => {
  it('inserts the whole market-data seam: definition, provider, and tools', () => {
    expect(insertedRow('market-data')?.name).toBe('@deepseek-ai/dsh-market-data')
    expect(insertedRow('market-data-fixture')?.name).toBe('@deepseek-ai/dsh-market-data-fixture')
    expect(insertedRow('tool-market-data')?.name).toBe('@deepseek-ai/dsh-tool-market-data')
  })

  it('pins no provider, so selection resolves to the single usable one', () => {
    // A configured id that is not registered is a startup-time failure; leaving
    // it unset is what lets a later layer add a licensed feed without editing
    // this row.
    expect(insertedRow('market-data')?.config).not.toHaveProperty('provider')
  })

  it('enables both model-facing tools with the range a chart card wants', () => {
    expect(insertedRow('tool-market-data')?.config)
      .toMatchObject({ quote: true, history: true, defaultHistorySessions: 60 })
  })

  it('disables no row from the layer below', () => {
    // This layer adds capability and never removes surface: a disabled row here
    // would be surface policy the web layer already decided.
    expect(patch.filter(row => row.disabled === true)).toEqual([])
    expect(inserted.filter(row => row.disabled === true)).toEqual([])
  })

  it('declares every inserted package as a real dependency', () => {
    const manifest = JSON.parse(
      readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'),
    ) as { dependencies: Record<string, string> }

    for (const row of inserted) {
      expect(Object.keys(manifest.dependencies)).toContain(row.name)
    }
  })
})

describe('chico bundle plugin', () => {
  it('carries its whole effect in the patch, not in a plugin body', () => {
    expect(name).toBe('chico-web-app')
    expect(apply).not.toThrow()
  })
})

describe('chico bundle invariant companion', () => {
  it('reserves package ownership under its declared companion name', async () => {
    const ctx = new Context()
    await ctx.plugin(InvariantRegistry, { enabled: true })
    const fiber = ctx.plugin(ChicoInvariant)
    await fiber.await()

    expect(ChicoInvariant.name).toBe('chico-web-app-invariant')
    expect(ChicoInvariant.inject).toEqual(['invariants'])
    await fiber.dispose()
  })
})
