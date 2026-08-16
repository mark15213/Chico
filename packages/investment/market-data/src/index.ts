/**
 * Service Definition for the market-data capability seam (`ctx.marketData`): a
 * provider registry plus provider-selecting execution for instrument lookup,
 * quotes, and price history. Duplicate ids are rejected. At execution time a configured provider
 * must exist and be usable; without one, exactly one usable provider is
 * required, so selection never depends on registration order.
 * @module @deepseek-ai/dsh-market-data
 */

import { Context, Service } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {
  InstrumentSearchRequest,
  InstrumentSearchResult,
  MarketDataProvider,
  PriceHistory,
  PriceHistoryRequest,
  Quote,
  QuoteRequest,
} from './types.ts'
import { MarketDataError } from './types.ts'

export { MarketDataError } from './types.ts'
export type {
  InstrumentMatch,
  InstrumentRef,
  InstrumentSearchRequest,
  InstrumentSearchResult,
  Market,
  MarketDataErrorCode,
  MarketDataProvider,
  ObservationSource,
  PriceBar,
  PriceHistory,
  PriceHistoryRequest,
  Quote,
  QuoteRequest,
} from './types.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    marketData: MarketDataRuntime
  }
}

/**
 * Default ceiling for {@link MarketDataRuntimeConfig.maxHistorySessions}: about
 * two trading years, which covers the longest range a chart card asks for while
 * keeping one provider call bounded.
 */
const DEFAULT_MAX_HISTORY_SESSIONS = 500

/**
 * Default ceiling for {@link MarketDataRuntimeConfig.maxSearchMatches}: a
 * pick-list a person reads before choosing, not a result set to page through.
 */
const DEFAULT_MAX_SEARCH_MATCHES = 20

/**
 * Config for the market-data seam. `provider` pins which registered provider
 * wins; omitted, a single registered usable provider auto-selects. Operational
 * overrides feed this same field rather than introduce a hidden priority chain.
 */
export interface MarketDataRuntimeConfig {
  /** Explicit provider id. Omitted = auto-select when exactly one is usable. */
  readonly provider?: string
  /**
   * Largest number of sessions {@link MarketDataRuntime.priceHistory} will ask
   * a provider for. A larger request is refused rather than silently trimmed,
   * because a caller that asked for five years and received one would draw a
   * chart that lies about its own range.
   */
  readonly maxHistorySessions: number
  /**
   * Largest number of matches {@link MarketDataRuntime.search} will ask a
   * provider for. Refused rather than trimmed for the same reason as
   * {@link MarketDataRuntimeConfig.maxHistorySessions}: a caller that asked for
   * fifty and drew twenty would present a truncated list as the whole answer.
   */
  readonly maxSearchMatches: number
}

/**
 * The market-data service. Registered as `ctx.marketData` (one instance per
 * context).
 *
 * Selection semantics, resolved at execution time and never order-dependent:
 * - A configured id that is registered and `available()` — that provider.
 * - A configured id not registered — `MARKET_DATA_PROVIDER_CONFIGURED_MISSING`.
 * - A configured id registered but unavailable —
 *   `MARKET_DATA_PROVIDER_CONFIGURED_UNAVAILABLE`.
 * - No id configured, exactly one registered usable provider — that provider.
 * - No id configured, multiple usable providers — `MARKET_DATA_PROVIDER_AMBIGUOUS`.
 * - No id configured, no usable provider — `MARKET_DATA_PROVIDER_UNAVAILABLE`.
 */
export class MarketDataRuntime extends Service {
  /** Provider selection and the two request ceilings. */
  static Config: z<MarketDataRuntimeConfig> = z.object({
    provider: z.string(),
    maxHistorySessions: z.natural().min(1).default(DEFAULT_MAX_HISTORY_SESSIONS),
    maxSearchMatches: z.natural().min(1).default(DEFAULT_MAX_SEARCH_MATCHES),
  })

  private providers = new Map<string, MarketDataProvider>()
  private readonly providerId: string | undefined
  private readonly maxHistorySessions: number
  private readonly maxSearchMatches: number

  constructor(ctx: Context, config: MarketDataRuntimeConfig) {
    super(ctx, 'marketData')
    this.providerId = config.provider
    this.maxHistorySessions = config.maxHistorySessions
    this.maxSearchMatches = config.maxSearchMatches
  }

  /**
   * Register a market-data provider. Throws {@link MarketDataError}
   * `MARKET_DATA_DUPLICATE_PROVIDER` if its id is already registered. Returns a
   * disposer; disposed with the calling fiber.
   * @param provider - the provider; its `id` is the registry key.
   * @returns the disposer that unregisters the provider.
   */
  registerProvider(provider: MarketDataProvider): () => void {
    if (this.providers.has(provider.id)) {
      throw new MarketDataError(
        `a market-data provider with id "${provider.id}" is already registered`,
        'MARKET_DATA_DUPLICATE_PROVIDER',
      )
    }
    const store = this.providers
    const dispose = this.ctx.effect(function* () {
      store.set(provider.id, provider)
      yield () => store.delete(provider.id)
    }, 'marketData.registerProvider()')
    // ctx.effect's disposer returns Promise<void>; this disposer API is
    // synchronous fire-and-forget — discard the always-resolved promise.
    return () => void dispose()
  }

  /**
   * Find the listings a typed query names, through the selected provider.
   * Resolves the provider at call time; throws {@link MarketDataError} when the
   * capability cannot run, and rejects a `limit` above the configured ceiling
   * instead of trimming it, so a caller that asked for fifty and drew twenty
   * knows it was refused.
   * @param request - the query and how many matches to return.
   * @param signal - optional cancellation signal forwarded to the provider.
   * @returns the matched listings, best first.
   */
  async search(request: InstrumentSearchRequest, signal?: AbortSignal): Promise<InstrumentSearchResult> {
    if (request.limit > this.maxSearchMatches) {
      throw new MarketDataError(
        `requested ${request.limit} matches, above the configured ceiling of ${this.maxSearchMatches}`,
        'MARKET_DATA_SEARCH_RANGE_REFUSED',
      )
    }
    return (await this.resolveProvider()).search(request, signal)
  }

  /**
   * Read one instrument's latest quote through the selected provider. Resolves
   * the provider at call time; throws {@link MarketDataError} when the
   * capability cannot run.
   * @param request - the instrument to price.
   * @param signal - optional cancellation signal forwarded to the provider.
   * @returns the quote observation.
   */
  async quote(request: QuoteRequest, signal?: AbortSignal): Promise<Quote> {
    return (await this.resolveProvider()).quote(request, signal)
  }

  /**
   * Read one instrument's recent session bars through the selected provider.
   * Resolves the provider at call time; throws {@link MarketDataError} when the
   * capability cannot run, and rejects a `sessions` count above the configured
   * ceiling instead of trimming it.
   * @param request - the instrument and how many sessions to read.
   * @param signal - optional cancellation signal forwarded to the provider.
   * @returns the bars in ascending date order with their adjustment.
   */
  async priceHistory(request: PriceHistoryRequest, signal?: AbortSignal): Promise<PriceHistory> {
    if (request.sessions > this.maxHistorySessions) {
      throw new MarketDataError(
        `requested ${request.sessions} sessions, above the configured ceiling of ${this.maxHistorySessions}`,
        'MARKET_DATA_HISTORY_RANGE_REFUSED',
      )
    }
    return (await this.resolveProvider()).priceHistory(request, signal)
  }

  /** Resolve the selected provider or throw the matching {@link MarketDataError}. */
  private async resolveProvider(): Promise<MarketDataProvider> {
    const configuredId = this.providerId
    if (configuredId !== undefined) {
      const provider = this.providers.get(configuredId)
      if (!provider) {
        throw new MarketDataError(
          `configured market-data provider "${configuredId}" is not registered`,
          'MARKET_DATA_PROVIDER_CONFIGURED_MISSING',
        )
      }
      if (!await provider.available()) {
        throw new MarketDataError(
          `configured market-data provider "${configuredId}" is registered but unavailable`,
          'MARKET_DATA_PROVIDER_CONFIGURED_UNAVAILABLE',
        )
      }
      return provider
    }
    // Every candidate is asked at once: availability is a credential or
    // entitlement read per provider, and asking them in sequence would make
    // selection cost grow with a roster the caller did not choose.
    const registered = [...this.providers.values()]
    const answers = await Promise.all(registered.map(provider => provider.available()))
    const usable = registered.filter((_, index) => answers[index] === true)
    const [single] = usable
    if (single === undefined) {
      throw new MarketDataError(
        'no usable market-data provider is registered',
        'MARKET_DATA_PROVIDER_UNAVAILABLE',
      )
    }
    if (usable.length > 1) {
      const ids = usable.map(provider => provider.id).join(', ')
      throw new MarketDataError(
        `multiple usable market-data providers are registered (${ids}); configure one explicitly`,
        'MARKET_DATA_PROVIDER_AMBIGUOUS',
      )
    }
    return single
  }
}

export default MarketDataRuntime
