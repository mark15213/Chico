/**
 * Chico bundle composition: what the patch layer actually inserts, read from
 * the shipped `cordis.patch.yml` rather than from a restatement, plus the
 * empty plugin body and the invariant companion's ownership reservation.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import { load } from 'js-yaml'
import { afterEach, describe, expect, it, vi } from 'vitest'
import InvariantRegistry from '@deepseek-ai/dsh-invariants'
import MarketDataRuntime from '@deepseek-ai/dsh-market-data'
import {
  apply as applyMock, Config as MockConfig, inject as mockInject,
} from '@deepseek-ai/dsh-market-data-mock'
import {
  apply as applyTools, Config as ToolConfig, inject as toolInject,
} from '@deepseek-ai/dsh-tool-market-data'
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
  it('inserts the followed-names registry with no archive override', () => {
    expect(insertedRow('followed-names')?.name).toBe('@deepseek-ai/dsh-followed-names')
    // Unset resolves under the harness home; a later layer relocates it.
    expect(insertedRow('followed-names')?.config).toBeUndefined()
  })

  it('inserts the whole market-data seam: definition, feed, and tools', () => {
    expect(insertedRow('market-data')?.name).toBe('@deepseek-ai/dsh-market-data')
    expect(insertedRow('market-data-mock')?.name).toBe('@deepseek-ai/dsh-market-data-mock')
    expect(insertedRow('tool-market-data')?.name).toBe('@deepseek-ai/dsh-tool-market-data')
  })

  it('ships the mock feed, so this composition is for building the surface, not for pricing', () => {
    // A live venue feed made the workbench unusable whenever the API was slow
    // or unreachable, and none of that is the surface being built. The mock
    // dataset is compiled into its package, so the surface runs offline.
    expect(insertedRow('market-data-mock')?.name).toBe('@deepseek-ai/dsh-market-data-mock')
    // No live feed alongside it: two usable providers make selection ambiguous
    // and the seam refuses every read.
    expect(inserted.map(row => row.name)).not.toContain('@deepseek-ai/dsh-market-data-tushare')
  })

  it('needs no credential row, because the feed reads no network', () => {
    expect(insertedRow('market-data-mock')?.config).toBeUndefined()
    expect(JSON.stringify(inserted)).not.toMatch(/token/i)
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

  it('inserts the watchlist projection with no config of its own', () => {
    // What a user follows is data, and which provider prices it is already the
    // market-data row's decision, so this row has nothing left to configure.
    expect(insertedRow('watchlist')?.name).toBe('@deepseek-ai/dsh-watchlist')
    expect(insertedRow('watchlist')?.config).toBeUndefined()
  })

  it('inserts the name record with no config of its own', () => {
    // The stance and the chain are the user's; there is nothing to configure.
    expect(insertedRow('name-record')?.name).toBe('@deepseek-ai/dsh-name-record')
    expect(insertedRow('name-record')?.config).toBeUndefined()
  })

  it('adds the workbench, the browser row everything above exists to serve', () => {
    // A composition carrying the projections without it would hold a record
    // nobody can see.
    expect(insertedRow('ui-watchlist')?.name).toBe('@deepseek-ai/dsh-client-ui-watchlist')
  })

  it('adds automations after the workbench that declares their seat', () => {
    // The workbench block, the page seat, and the name mark are all declared
    // by ui-watchlist's own registration, so a composition carrying this row
    // without it would register into holes nobody opened.
    expect(insertedRow('ui-automation')?.name).toBe('@deepseek-ai/dsh-client-ui-automation')
    const ids = inserted.map(row => row.id)
    expect(ids.indexOf('ui-automation')).toBeGreaterThan(ids.indexOf('ui-watchlist'))
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

describe('chico bundle composition', () => {
  /**
   * Boot the market-data rows exactly as the patch ships them, over a stubbed
   * credential plane. The configs are read from the shipped file rather than
   * restated, so this asserts what the bundle actually carries.
   */
  async function boot() {
    const ctx = new Context()
    const tools = new Set<string>()
    ctx.provide('tools', {
      register: (definition: { name: string }) => {
        tools.add(definition.name)
        return () => tools.delete(definition.name)
      },
    } as never)
    ctx.provide('systemPrompt', { section: () => {} } as never)

    await ctx.plugin(MarketDataRuntime, insertedRow('market-data')?.config as never).await()
    await ctx.plugin(
      { name: 'mock', inject: [...mockInject], apply: applyMock, Config: MockConfig },
      insertedRow('market-data-mock')?.config ?? {},
    ).await()
    await ctx.plugin(
      { name: 'tools', inject: [...toolInject], apply: applyTools, Config: ToolConfig },
      insertedRow('tool-market-data')?.config ?? {},
    ).await()
    return { ctx, tools }
  }

  const CATL = { market: 'SZSE', symbol: '300750' } as const

  afterEach(() => { vi.unstubAllGlobals() })

  it('boots its own configured rows into a live seam and both tools, with no network at all', async () => {
    // No fetch stub: a call that reached the network would throw here, which is
    // the point of this composition.
    const { ctx, tools } = await boot()

    expect([...tools].sort()).toEqual(['market_history', 'market_quote'])
    // The seam resolves to the one registered feed with no id configured.
    const quote = await ctx.marketData.quote({ instrument: CATL })
    expect(quote.name).toBe('宁德时代')
    // The dataset is end-of-day by construction.
    expect(quote.session).toBe('closed')
    // The configured ceiling is the one a request above it is refused against.
    await expect(ctx.marketData.priceHistory({ instrument: CATL, sessions: 501 }))
      .rejects.toThrow(expect.objectContaining({ code: 'MARKET_DATA_HISTORY_RANGE_REFUSED' }))
  })

  it('serves the compiled window a chart card asks for', async () => {
    const { ctx } = await boot()
    const history = await ctx.marketData.priceHistory({ instrument: CATL, sessions: 60 })

    expect(history.bars).toHaveLength(60)
    expect(history.adjustment).toBe('none')
    // Ascending, and ending on the dataset's anchor session.
    expect(history.bars.at(-1)?.date).toBe('2026-08-14')
    expect((history.bars[0]?.date ?? '') < (history.bars.at(-1)?.date ?? '')).toBe(true)
  })

  it('refuses an instrument the dataset does not carry, rather than inventing one', async () => {
    const { ctx } = await boot()

    await expect(ctx.marketData.quote({ instrument: { market: 'NASDAQ', symbol: 'NVDA' } }))
      .rejects.toThrow(expect.objectContaining({ code: 'MARKET_DATA_UNKNOWN_INSTRUMENT' }))
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
