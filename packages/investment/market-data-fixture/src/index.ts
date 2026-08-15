/**
 * Deterministic market-data Service Provider: serves a fixed instrument table,
 * lookup over it, and a reproducible bar series so keyless snapshots, demos,
 * and tests exercise the seam without a venue entitlement. Every value derives
 * from the symbol and the configured anchor date, so two runs on two machines
 * agree.
 * @module @deepseek-ai/dsh-market-data-fixture
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {
  InstrumentRef,
  InstrumentSearchRequest,
  InstrumentSearchResult,
  MarketDataProvider,
  PriceBar,
  PriceHistory,
  PriceHistoryRequest,
  Quote,
  QuoteRequest,
} from '@deepseek-ai/dsh-market-data'
import { MarketDataError } from '@deepseek-ai/dsh-market-data'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'market-data-fixture'

/** Services required before the provider can register. */
export const inject = ['marketData']

/** Registry id this provider claims. */
export const PROVIDER_ID = 'fixture'

/**
 * Anchor the fixture series ends on, as a trading date. Fixed rather than read
 * from the clock: a provider whose output moved with wall time could not back a
 * replayable snapshot.
 */
export const DEFAULT_ANCHOR_DATE = '2026-08-14'

/** One instrument the fixture table knows, with the facts a quote needs. */
interface FixtureInstrument {
  readonly instrument: InstrumentRef
  readonly name: string
  readonly currency: string
  /** Close of the anchor session; the series is built backwards from it. */
  readonly anchorClose: number
  /** Seed seperating one instrument's series from another's. */
  readonly seed: number
}

const FIXTURES: readonly FixtureInstrument[] = [
  { instrument: { market: 'SZSE', symbol: '300750' }, name: '宁德时代', currency: 'CNY', anchorClose: 212.3, seed: 7 },
  { instrument: { market: 'SSE', symbol: '600519' }, name: '贵州茅台', currency: 'CNY', anchorClose: 1486.0, seed: 19 },
  { instrument: { market: 'SZSE', symbol: '300274' }, name: '阳光电源', currency: 'CNY', anchorClose: 88.6, seed: 31 },
]

/**
 * Deterministic unit oscillation for one session index. A closed-form mix of
 * two incommensurable sine terms rather than a pseudo-random generator, so any
 * single session can be computed without walking the series.
 */
function wave(seed: number, index: number): number {
  return Math.sin((index + seed) * 0.7) * 0.6 + Math.sin((index + seed) * 0.23) * 0.4
}

/**
 * Whether one fixture answers an upper-cased query. A code matches from its
 * start, because a partial code is a prefix of the real one; a name matches
 * anywhere, because a person types the distinctive middle of a name as often
 * as its beginning.
 */
function matchesQuery(fixture: FixtureInstrument, query: string): boolean {
  return fixture.instrument.symbol.startsWith(query)
    || fixture.instrument.market.startsWith(query)
    || fixture.name.toLocaleUpperCase().includes(query)
}

/** Round to two decimals; venue prices in this table are all two-decimal. */
function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * The trading date `sessionsBack` sessions before the anchor, skipping
 * weekends. Holidays are not modeled — see the package README.
 */
function tradingDate(anchor: string, sessionsBack: number): string {
  const date = new Date(`${anchor}T00:00:00.000Z`)
  let remaining = sessionsBack
  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() - 1)
    const day = date.getUTCDay()
    if (day !== 0 && day !== 6) remaining -= 1
  }
  return date.toISOString().slice(0, 10)
}

/** Build one session's bar from the instrument's closed-form series. */
function bar(fixture: FixtureInstrument, anchor: string, sessionsBack: number): PriceBar {
  const drift = wave(fixture.seed, sessionsBack) * 0.02
  const close = round2(fixture.anchorClose * (1 - drift))
  const open = round2(close * (1 + wave(fixture.seed + 1, sessionsBack) * 0.004))
  const high = round2(Math.max(open, close) * 1.008)
  const low = round2(Math.min(open, close) * 0.992)
  const volume = Math.round(20_000_000 + Math.abs(wave(fixture.seed + 2, sessionsBack)) * 15_000_000)
  return { date: tradingDate(anchor, sessionsBack), open, high, low, close, volume }
}

/** Resolve a request's instrument in the fixture table. */
function find(instrument: InstrumentRef): FixtureInstrument | undefined {
  return FIXTURES.find(
    entry => entry.instrument.market === instrument.market && entry.instrument.symbol === instrument.symbol,
  )
}

/** The refusal for an instrument the table does not carry. */
function unknownInstrument(instrument: InstrumentRef): MarketDataError {
  return new MarketDataError(
    `fixture market data has no instrument ${instrument.market}:${instrument.symbol}`,
    'MARKET_DATA_UNKNOWN_INSTRUMENT',
  )
}

/** Plugin config: the anchor date the deterministic series ends on. */
export interface Config {
  /** Trading date the series ends on (`YYYY-MM-DD`). Defaults to {@link DEFAULT_ANCHOR_DATE}. */
  anchorDate?: string
}

export const Config: z<Config> = z.object({
  anchorDate: z.string().default(DEFAULT_ANCHOR_DATE),
})

/**
 * Build the fixture provider for one anchor date. Exported for tests that
 * exercise the provider without a Cordis context.
 * @param anchorDate - trading date the deterministic series ends on.
 * @returns the provider, always `available()`.
 */
export function createFixtureProvider(anchorDate: string): MarketDataProvider {
  return {
    id: PROVIDER_ID,
    // A fixture table needs no credential and no network, so it is always usable.
    available: () => true,
    // Matching is over the whole fixed table, in table order, because the
    // table is small enough that ranking would be an invention rather than a
    // measurement. A real feed ranks by its own relevance signal.
    search: (request: InstrumentSearchRequest): Promise<InstrumentSearchResult> => {
      const query = request.query.trim().toLocaleUpperCase()
      if (query.length === 0) return Promise.resolve({ matches: [] })
      const matches = FIXTURES
        .filter(fixture => matchesQuery(fixture, query))
        .slice(0, request.limit)
        .map(fixture => ({ instrument: fixture.instrument, name: fixture.name }))
      return Promise.resolve({ matches })
    },
    // An unknown instrument returns a rejected promise rather than throwing
    // synchronously: the contract returns a promise, and a caller that only
    // installed a rejection handler must still see the refusal.
    quote: (request: QuoteRequest): Promise<Quote> => {
      const fixture = find(request.instrument)
      if (fixture === undefined) return Promise.reject(unknownInstrument(request.instrument))
      const today = bar(fixture, anchorDate, 0)
      const previous = bar(fixture, anchorDate, 1)
      return Promise.resolve({
        instrument: fixture.instrument,
        name: fixture.name,
        currency: fixture.currency,
        last: today.close,
        previousClose: previous.close,
        changePercent: round2((today.close / previous.close - 1) * 100),
        volume: today.volume,
        // Venue close, expressed as the instant the anchor session ended.
        asOf: `${anchorDate}T07:00:00.000Z`,
        session: 'closed',
      })
    },
    priceHistory: (request: PriceHistoryRequest): Promise<PriceHistory> => {
      const fixture = find(request.instrument)
      if (fixture === undefined) return Promise.reject(unknownInstrument(request.instrument))
      const bars: PriceBar[] = []
      for (let back = request.sessions - 1; back >= 0; back -= 1) {
        bars.push(bar(fixture, anchorDate, back))
      }
      return Promise.resolve({
        instrument: fixture.instrument,
        bars,
        // The table is synthetic and carries no corporate actions, so its
        // prices are as-traded by construction rather than by restatement.
        adjustment: 'none',
      })
    },
  }
}

/**
 * Register the fixture provider on `ctx.marketData`; the registration is
 * effect-scoped and unregisters on plugin dispose.
 * @param ctx - context carrying the market-data seam.
 * @param config - the anchor date the series ends on.
 */
export function apply(ctx: Context, config: Config): void {
  // schemastery (Config) has already filled the defaulted field.
  const { anchorDate } = config as Required<Config>
  ctx.effect(
    () => ctx.marketData.registerProvider(createFixtureProvider(anchorDate)),
    'market-data-fixture: provider',
  )
}
