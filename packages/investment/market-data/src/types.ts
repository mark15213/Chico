/**
 * Public type vocabulary of the market-data capability seam: instrument
 * identity, the two observation values, the provider interface, and the seam's
 * error class. Types plus the error class only — provider selection and the
 * service live in `index.ts`.
 * @module @deepseek-ai/dsh-market-data/src/types
 */

/**
 * Venue an instrument trades on. Closed because settlement calendar, price
 * limits, and lot size differ per venue and every consumer must switch on a
 * known member rather than a free string.
 */
export type Market = 'SSE' | 'SZSE' | 'BSE' | 'HKEX' | 'NASDAQ' | 'NYSE'

/**
 * Instrument identity. Not an opaque id: the venue and the venue's own code
 * are both meaningful to consumers, and the pair is what a provider resolves.
 * The same code under two venues is two instruments.
 */
export interface InstrumentRef {
  /** Trading venue. */
  readonly market: Market
  /** The venue's own instrument code, exactly as the venue writes it. */
  readonly symbol: string
}

/**
 * Where one observation came from and when it was acquired.
 *
 * An observation's own event time says when the venue priced the instrument and
 * nothing about how that value reached this process. A reader deciding whether
 * to act on a figure needs both, so every observation carries this beside its
 * numbers: the feed that served it, the datasets inside that feed the values
 * were read from, and the instant they were read.
 */
export interface ObservationSource {
  /** Registry id of the provider that served the observation ({@link MarketDataProvider.id}). */
  readonly providerId: string
  /**
   * The provider's own datasets the values were read from, in the order the
   * provider consulted them — an endpoint, a table, or whatever that feed calls
   * its addressable unit of data.
   */
  readonly datasets: readonly string[]
  /**
   * When the provider acquired the values (ISO-8601 instant), or null when
   * there was no acquisition. A provider that computes its values in-process
   * has no retrieval to report, and stamping the clock there would present a
   * generated number as a fetched one.
   */
  readonly retrievedAt: string | null
}

/**
 * One instrument's latest observed price and the session context needed to
 * read it. Every field is as of {@link Quote.asOf}; a consumer that needs a
 * different instant asks again rather than extrapolating.
 */
export interface Quote {
  /** The instrument this quote describes. */
  readonly instrument: InstrumentRef
  /** Display name in the venue's own language. */
  readonly name: string
  /** ISO-4217 code the price is denominated in. */
  readonly currency: string
  /** Last traded price. */
  readonly last: number
  /** Previous session's closing price, the reference for {@link Quote.changePercent}. */
  readonly previousClose: number
  /** Change from {@link Quote.previousClose} in percent; negative for a decline. */
  readonly changePercent: number
  /** Session volume in shares or contracts. */
  readonly volume: number
  /**
   * Event time of this observation (ISO-8601). This is when the venue priced
   * the instrument, never when the provider was asked or when a UI rendered it.
   */
  readonly asOf: string
  /**
   * Whether the venue was open at {@link Quote.asOf}. A closed-venue quote is
   * still a valid observation; it just will not change until the next session.
   */
  readonly session: 'open' | 'closed'
  /** Which feed served these numbers and when they were read. */
  readonly source: ObservationSource
}

/**
 * One trading session's price range for an instrument. `date` is the session's
 * trading date at the venue, not a timestamp, because a bar covers a session
 * rather than an instant.
 */
export interface PriceBar {
  /** Trading date at the venue (ISO-8601 calendar date, `YYYY-MM-DD`). */
  readonly date: string
  /** First traded price of the session. */
  readonly open: number
  /** Highest traded price of the session. */
  readonly high: number
  /** Lowest traded price of the session. */
  readonly low: number
  /** Last traded price of the session. */
  readonly close: number
  /** Session volume in shares or contracts. */
  readonly volume: number
}

/**
 * One listing a search matched. Carries identity and name only: a search
 * answers "which instrument does the user mean", and a caller that then needs
 * a price asks for a quote.
 */
export interface InstrumentMatch {
  /** The matched instrument. */
  readonly instrument: InstrumentRef
  /** Display name in the venue's own language. */
  readonly name: string
}

/** Request for instruments matching what a user typed. */
export interface InstrumentSearchRequest {
  /** What the user typed: a code, a name, or part of either. */
  readonly query: string
  /** Largest number of matches to return; a provider may return fewer. */
  readonly limit: number
}

/** The listings one search matched, best first as the provider ranks them. */
export interface InstrumentSearchResult {
  /** Matched listings; empty when the query names nothing. */
  readonly matches: readonly InstrumentMatch[]
}

/** Request for one instrument's latest quote. */
export interface QuoteRequest {
  /** The instrument to price. */
  readonly instrument: InstrumentRef
}

/** Request for one instrument's recent session bars. */
export interface PriceHistoryRequest {
  /** The instrument to read. */
  readonly instrument: InstrumentRef
  /** Number of most recent sessions to return; a provider may return fewer. */
  readonly sessions: number
}

/**
 * One instrument's session bars, oldest first, with the adjustment the prices
 * carry. A consumer comparing a bar against a recorded price must know which
 * adjustment produced it, so the field is required rather than assumed.
 */
export interface PriceHistory {
  /** The instrument these bars describe. */
  readonly instrument: InstrumentRef
  /** Session bars in ascending date order. */
  readonly bars: readonly PriceBar[]
  /**
   * Corporate-action adjustment applied to the prices: `none` is as-traded,
   * `backward` restates history onto today's basis, `forward` restates onto
   * the first bar's basis.
   */
  readonly adjustment: 'none' | 'backward' | 'forward'
  /**
   * Which feed served these bars and when they were read. Restatement reads a
   * second dataset, so a provider that restated lists both.
   */
  readonly source: ObservationSource
}

/**
 * A market-data source. Providers are registered by id and selected at call
 * time; `available()` reports whether this provider can serve a request now
 * (credentials present, entitlement live), and is consulted per call rather
 * than cached, so a provider that loses its entitlement stops being selected.
 */
export interface MarketDataProvider {
  /** Registry key; unique among market-data providers. */
  readonly id: string
  /**
   * Whether this provider can serve a request right now. Asynchronous because
   * the usual answer is a credential lookup: a provider that had to answer
   * synchronously could only mirror a cached flag, and a stale mirror is
   * exactly what per-call consultation exists to avoid.
   * @returns true when the provider is usable.
   */
  available(): Promise<boolean>
  /**
   * Find the listings a typed query names. A provider whose feed has no
   * lookup endpoint rejects with `MARKET_DATA_SEARCH_UNSUPPORTED` rather than
   * resolving empty, so a consumer can tell "nothing matched" from "this
   * source cannot answer".
   * @param request - the query and how many matches to return.
   * @param signal - optional cancellation signal.
   * @returns the matched listings, best first.
   */
  search(request: InstrumentSearchRequest, signal?: AbortSignal): Promise<InstrumentSearchResult>
  /**
   * Read one instrument's latest quote.
   * @param request - the instrument to price.
   * @param signal - optional cancellation signal.
   * @returns the quote observation.
   */
  quote(request: QuoteRequest, signal?: AbortSignal): Promise<Quote>
  /**
   * Read one instrument's recent session bars.
   * @param request - the instrument and how many sessions to read.
   * @param signal - optional cancellation signal.
   * @returns the bars in ascending date order with their adjustment.
   */
  priceHistory(request: PriceHistoryRequest, signal?: AbortSignal): Promise<PriceHistory>
}

/**
 * Reasons the market-data seam refuses to run or rejects a registration.
 *
 * The `PROVIDER_*` members describe the composition and would fail every
 * request identically; the rest describe one request, and a consumer reading a
 * list may degrade that entry alone. `VENUE_UNSUPPORTED` is on the request side
 * even though it is a fact about the provider: a source that serves Shanghai
 * but not Hong Kong is correctly selected and correctly refuses that one name.
 */
export type MarketDataErrorCode =
  | 'MARKET_DATA_DUPLICATE_PROVIDER'
  | 'MARKET_DATA_PROVIDER_CONFIGURED_MISSING'
  | 'MARKET_DATA_PROVIDER_CONFIGURED_UNAVAILABLE'
  | 'MARKET_DATA_PROVIDER_AMBIGUOUS'
  | 'MARKET_DATA_PROVIDER_UNAVAILABLE'
  | 'MARKET_DATA_UNKNOWN_INSTRUMENT'
  | 'MARKET_DATA_VENUE_UNSUPPORTED'
  | 'MARKET_DATA_HISTORY_RANGE_REFUSED'
  | 'MARKET_DATA_SEARCH_RANGE_REFUSED'
  | 'MARKET_DATA_SEARCH_UNSUPPORTED'

/** Error thrown by the market-data seam and by providers refusing a request. */
export class MarketDataError extends Error {
  /**
   * @param message - human-readable cause.
   * @param code - the machine-readable reason.
   */
  constructor(message: string, readonly code: MarketDataErrorCode) {
    super(message)
    this.name = 'MarketDataError'
  }
}
