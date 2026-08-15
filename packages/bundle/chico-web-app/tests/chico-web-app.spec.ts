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
  apply as applyTushare, Config as TushareConfig, inject as tushareInject,
} from '@deepseek-ai/dsh-market-data-tushare'
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

  it('inserts the whole market-data seam: definition, venue feed, and tools', () => {
    expect(insertedRow('market-data')?.name).toBe('@deepseek-ai/dsh-market-data')
    expect(insertedRow('market-data-tushare')?.name).toBe('@deepseek-ai/dsh-market-data-tushare')
    expect(insertedRow('tool-market-data')?.name).toBe('@deepseek-ai/dsh-tool-market-data')
  })

  it('ships no synthetic provider, so no price here is invented', () => {
    // The fixture backs package tests and keyless replay; a workbench that
    // mounted it would present made-up closes as the venue's own.
    expect(inserted.map(row => row.name)).not.toContain('@deepseek-ai/dsh-market-data-fixture')
  })

  it('leaves the venue feed as-traded, the basis every account can reach', () => {
    // Restatement reads an interface behind a higher Tushare point threshold;
    // shipping it on would break every account that has only the bars.
    expect(insertedRow('market-data-tushare')?.config).toEqual({ adjustment: 'none' })
  })

  it('carries no token in the shipped file, only the reference that resolves one', () => {
    expect(JSON.stringify(insertedRow('market-data-tushare')?.config)).not.toMatch(/token/i)
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

  it('adds the workbench, the one browser row everything above exists to serve', () => {
    // A composition carrying the projections without it would hold a record
    // nobody can see.
    expect(insertedRow('ui-watchlist')?.name).toBe('@deepseek-ai/dsh-client-ui-watchlist')
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
  async function boot(token: string | undefined) {
    const ctx = new Context()
    const tools = new Set<string>()
    ctx.provide('tools', {
      register: (definition: { name: string }) => {
        tools.add(definition.name)
        return () => tools.delete(definition.name)
      },
    } as never)
    ctx.provide('systemPrompt', { section: () => {} } as never)
    ctx.provide('credentials', {
      resolve: () => Promise.resolve(token === undefined ? undefined : { value: token, source: 'test' }),
    } as never)

    await ctx.plugin(MarketDataRuntime, insertedRow('market-data')?.config as never).await()
    await ctx.plugin(
      { name: 'tushare', inject: [...tushareInject], apply: applyTushare, Config: TushareConfig },
      insertedRow('market-data-tushare')?.config ?? {},
    ).await()
    await ctx.plugin(
      { name: 'tools', inject: [...toolInject], apply: applyTools, Config: ToolConfig },
      insertedRow('tool-market-data')?.config ?? {},
    ).await()
    return { ctx, tools }
  }

  const CATL = { market: 'SZSE', symbol: '300750' } as const

  afterEach(() => { vi.unstubAllGlobals() })

  it('boots its own configured rows into a live seam and both tools', async () => {
    vi.stubGlobal('fetch', (_url: string, init: { body: string }) => {
      const call = JSON.parse(init.body) as { api_name: string }
      const body = call.api_name === 'stock_basic'
        ? { code: 0, data: { fields: ['ts_code', 'name'], items: [['300750.SZ', '宁德时代']] } }
        : {
          code: 0,
          data: {
            fields: ['trade_date', 'open', 'high', 'low', 'close', 'pre_close', 'pct_chg', 'vol'],
            items: [['20260814', 210, 214, 209, 212.3, 210, 1.1, 301_000]],
          },
        }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) })
    })
    const { ctx, tools } = await boot('tok')

    expect([...tools].sort()).toEqual(['market_history', 'market_quote'])
    // The seam resolves to the one registered feed with no id configured.
    const quote = await ctx.marketData.quote({ instrument: CATL })
    expect(quote.name).toBe('宁德时代')
    // End-of-day data, which is what the shipped feed serves.
    expect(quote.session).toBe('closed')
    // The configured ceiling is the one a request above it is refused against.
    await expect(ctx.marketData.priceHistory({ instrument: CATL, sessions: 501 }))
      .rejects.toThrow(expect.objectContaining({ code: 'MARKET_DATA_HISTORY_RANGE_REFUSED' }))
  })

  it('refuses loudly rather than inventing prices when no token is configured', async () => {
    const { ctx } = await boot(undefined)

    // Every row would degrade identically, so the watchlist re-raises this one
    // instead of drawing a column of dashes over a composition that cannot run.
    await expect(ctx.marketData.quote({ instrument: CATL }))
      .rejects.toThrow(expect.objectContaining({ code: 'MARKET_DATA_PROVIDER_UNAVAILABLE' }))
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
