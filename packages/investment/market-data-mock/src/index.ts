/**
 * Mock market-data Service Provider: serves the compiled Chico mock dataset —
 * ten instruments, 500 daily sessions each — with no credential and no network.
 *
 * **Every price it serves is synthetic.** The series were calibrated so their
 * magnitudes, volatilities, and 52-week ranges match real observations from
 * August 2026, which makes them useful for building and demonstrating an
 * investment surface and useless for any decision about money. A composition
 * that mounts this provider is showing invented closes as the venue's own, so
 * mount it for development and demonstration, never for a deployment whose
 * readers might act on the numbers.
 * @module @deepseek-ai/dsh-market-data-mock
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {
  InstrumentRef,
  InstrumentSearchRequest,
  InstrumentSearchResult,
  MarketDataProvider,
  ObservationSource,
  PriceBar,
  PriceHistory,
  PriceHistoryRequest,
  Quote,
  QuoteRequest,
} from '@deepseek-ai/dsh-market-data'
import { MarketDataError } from '@deepseek-ai/dsh-market-data'
import { DATASET, type MockSeries } from './dataset.ts'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'market-data-mock'

/** Services required before the provider can register. */
export const inject = ['marketData']

/** Registry id this provider claims. */
export const PROVIDER_ID = 'mock'

/** Dataset name attached to every observation this provider serves. */
export const MOCK_DATASET = 'chico-mock-data'

/**
 * Provenance of the compiled observations. `retrievedAt` is null because the
 * provider reads generated values compiled into this package rather than
 * acquiring them from an external source.
 */
const MOCK_SOURCE: ObservationSource = {
  providerId: PROVIDER_ID,
  datasets: [MOCK_DATASET],
  retrievedAt: null,
}

/** Venue close, as the instant a session's bar is dated to. */
const VENUE_CLOSE_SUFFIX = 'T15:00:00+08:00'

export { ANCHOR_DATE } from './dataset.ts'

/**
 * Expand one compiled date column into a trading date.
 * @param series - the compiled series.
 * @param index - session index into the columns.
 * @returns the trading date as `YYYY-MM-DD`.
 */
function dateAt(series: MockSeries, index: number): string {
  const packed = series.dates.split(',')[index] as string
  return `${packed.slice(0, 4)}-${packed.slice(4, 6)}-${packed.slice(6, 8)}`
}

/**
 * Rebuild one session's bar from the compiled columns.
 * @param series - the compiled series.
 * @param index - session index into the columns.
 * @returns the bar.
 */
function barAt(series: MockSeries, index: number): PriceBar {
  return {
    date: dateAt(series, index),
    open: series.open[index] as number,
    high: series.high[index] as number,
    low: series.low[index] as number,
    close: series.close[index] as number,
    volume: series.volume[index] as number,
  }
}

/**
 * Resolve a request's instrument in the compiled dataset.
 * @param instrument - the instrument to look up.
 * @returns the compiled series, or undefined when the dataset has no such listing.
 */
function find(instrument: InstrumentRef): MockSeries | undefined {
  return DATASET.find(
    series => series.market === instrument.market && series.symbol === instrument.symbol,
  )
}

/**
 * Whether one series answers an upper-cased query. A code matches from its
 * start, because a partial code is a prefix of the real one; a name matches
 * anywhere, because a person types the distinctive middle of a name as often
 * as its beginning.
 * @param series - the candidate.
 * @param query - the upper-cased query.
 * @returns true when the series matches.
 */
function matchesQuery(series: MockSeries, query: string): boolean {
  return series.symbol.startsWith(query)
    || series.market.startsWith(query)
    || series.name.toLocaleUpperCase().includes(query)
}

/**
 * The refusal for an instrument the dataset does not carry.
 * @param instrument - the requested instrument.
 * @returns the seam's unknown-instrument error.
 */
function unknownInstrument(instrument: InstrumentRef): MarketDataError {
  return new MarketDataError(
    `mock market data has no instrument ${instrument.market}:${instrument.symbol}`,
    'MARKET_DATA_UNKNOWN_INSTRUMENT',
  )
}

/** Plugin config. */
export interface Config {
  /**
   * Refuse every read instead of serving synthetic prices. A deployment that
   * mounts this provider by accident then fails loudly rather than presenting
   * invented closes as the venue's own.
   */
  disabled?: boolean
}

export const Config: z<Config> = z.object({
  disabled: z.boolean().default(false),
})

/**
 * Build the mock provider.
 * @param usable - whether the provider reports itself available.
 * @returns the provider over the compiled dataset.
 */
export function createMockProvider(usable: boolean): MarketDataProvider {
  return {
    id: PROVIDER_ID,
    // A compiled dataset has no credential and no network, so availability is
    // the composition's own switch rather than a lookup.
    available: () => Promise.resolve(usable),
    search: (request: InstrumentSearchRequest): Promise<InstrumentSearchResult> => {
      const query = request.query.trim().toLocaleUpperCase()
      if (query.length === 0) return Promise.resolve({ matches: [] })
      const matches = DATASET
        .filter(series => matchesQuery(series, query))
        .slice(0, request.limit)
        .map(series => ({ instrument: { market: series.market, symbol: series.symbol }, name: series.name }))
      return Promise.resolve({ matches })
    },
    // An unknown instrument returns a rejected promise rather than throwing
    // synchronously: the contract returns a promise, and a caller that only
    // installed a rejection handler must still see the refusal.
    quote: (request: QuoteRequest): Promise<Quote> => {
      const series = find(request.instrument)
      if (series === undefined) return Promise.reject(unknownInstrument(request.instrument))
      const last = series.close.length - 1
      const close = series.close[last] as number
      const previousClose = series.close[last - 1] as number
      return Promise.resolve({
        instrument: { market: series.market, symbol: series.symbol },
        name: series.name,
        currency: series.currency,
        last: close,
        previousClose,
        changePercent: Math.round((close / previousClose - 1) * 10_000) / 100,
        volume: series.volume[last] as number,
        asOf: `${dateAt(series, last)}${VENUE_CLOSE_SUFFIX}`,
        // The dataset is end-of-day by construction, whatever the wall clock says.
        session: 'closed',
        source: MOCK_SOURCE,
      })
    },
    priceHistory: (request: PriceHistoryRequest): Promise<PriceHistory> => {
      const series = find(request.instrument)
      if (series === undefined) return Promise.reject(unknownInstrument(request.instrument))
      const total = series.close.length
      const from = Math.max(0, total - request.sessions)
      const bars: PriceBar[] = []
      for (let index = from; index < total; index += 1) bars.push(barAt(series, index))
      return Promise.resolve({
        instrument: { market: series.market, symbol: series.symbol },
        bars,
        adjustment: series.adjustment,
        source: MOCK_SOURCE,
      })
    },
  }
}

/**
 * Register the mock provider on `ctx.marketData`; the registration is
 * effect-scoped and unregisters on plugin dispose.
 * @param ctx - context carrying the market-data seam.
 * @param config - the provider's switch.
 */
export function apply(ctx: Context, config: Config): void {
  // schemastery (Config) has already filled the defaulted field.
  const { disabled } = config as Required<Config>
  ctx.effect(
    () => ctx.marketData.registerProvider(createMockProvider(!disabled)),
    'market-data-mock: provider',
  )
}
