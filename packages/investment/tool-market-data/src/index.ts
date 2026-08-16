/**
 * Model-facing `market_quote` and `market_history` tools over `ctx.marketData`.
 * This package owns schemas, argument validation, prompt guidance, bounds, and
 * presentation, never concrete providers. An enabled tool stays visible when no
 * provider is usable and fails with a structured error at execution time.
 * @module @deepseek-ai/dsh-tool-market-data
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type {
  GenericCallView, GenericResultView, JsonValue, PriceSeriesBar, PriceSeriesResultView, ToolResult,
} from '@deepseek-ai/dsh-tools'
import type { Market, ObservationSource, PriceHistory, Quote } from '@deepseek-ai/dsh-market-data'
import type {} from '@deepseek-ai/dsh-system-prompt'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'tool-market-data'

/** Services required by the market-data tool suite. */
export const inject = ['tools', 'marketData', 'systemPrompt']

/** Venues the tools accept, mirroring the seam's closed `Market` union. */
export const MARKETS: readonly Market[] = ['SSE', 'SZSE', 'BSE', 'HKEX', 'NASDAQ', 'NYSE']

/** Default session count for `market_history` when the model omits one. */
export const DEFAULT_HISTORY_SESSIONS = 60

/** Default cooperative tool-call timeout budget (ms) for the market-data tools. */
export const DEFAULT_MARKET_TOOL_TIMEOUT_MS = 15_000

/** Plugin config: which tools to register, the default range, and the budget. */
export interface Config {
  /** Register `market_quote`. Defaults to true. */
  quote?: boolean
  /** Register `market_history`. Defaults to true. */
  history?: boolean
  /** Sessions returned when `market_history` omits a count. Defaults to 60. */
  defaultHistorySessions?: number
  /** Cooperative timeout budget (ms) for both tools. Defaults to 15000. */
  timeoutMs?: number
}

export const Config: z<Config> = z.object({
  quote: z.boolean().default(true),
  history: z.boolean().default(true),
  defaultHistorySessions: z.natural().min(1).default(DEFAULT_HISTORY_SESSIONS),
  timeoutMs: z.natural().min(1).default(DEFAULT_MARKET_TOOL_TIMEOUT_MS),
})

/**
 * Shared output fragment naming where an observation came from. Both tools
 * report it, because a figure a reader cannot trace is a figure they have to
 * take on faith.
 */
const SOURCE_PROPERTY = {
  type: 'object',
  required: true,
  additionalProperties: false,
  description: 'Which feed served these values, which of its datasets they were read from, and when.',
  properties: {
    providerId: { type: 'string', required: true },
    datasets: { type: 'array', required: true, items: { type: 'string' } },
    retrievedAt: {
      required: true,
      oneOf: [{ type: 'string' }, { type: 'null' }],
      description: 'When the feed was read, or null when the values were computed rather than acquired.',
    },
  },
} as const

/** Shared instrument parameters; both tools address one instrument the same way. */
const INSTRUMENT_PARAMETERS = {
  market: {
    type: 'string',
    required: true,
    enum: MARKETS,
    description: 'Trading venue the instrument is listed on.',
  },
  symbol: {
    type: 'string',
    required: true,
    description: "The venue's own instrument code, exactly as the venue writes it (for example 300750).",
  },
} as const

/**
 * Validate what the schema DSL cannot express: a non-blank symbol.
 * @param symbol - the schema-validated symbol argument.
 * @returns the accepted symbol, trimmed of surrounding whitespace.
 */
export function parseSymbol(symbol: string): string {
  const trimmed = symbol.trim()
  if (trimmed.length === 0) throw new Error('symbol must be a non-empty string')
  return trimmed
}

/**
 * Provenance as both tools report it. Structurally the seam's
 * {@link ObservationSource}; declared here because the output schema, not the
 * seam, is what a consumer of a tool result reads it back through.
 */
export interface SourceValue {
  /** Registry id of the feed that served the values. */
  readonly providerId: string
  /** The feed's own datasets the values were read from. */
  readonly datasets: readonly string[]
  /** When the feed was read (ISO-8601), or null when the values were computed rather than acquired. */
  readonly retrievedAt: string | null
}

/** Canonical `market_quote` output: the seam's quote minus its instrument echo. */
export type QuoteValue = Omit<Quote, 'instrument' | 'source'> & { readonly source: SourceValue }

/** Canonical `market_history` output: the seam's history minus its instrument echo. */
export type HistoryValue = Omit<PriceHistory, 'instrument' | 'source'> & { readonly source: SourceValue }

/**
 * Project one seam source into the tool's own output value. The arrays are
 * copied because the output value is plain JSON the harness may mutate on its
 * way to the model, and the seam's record is shared with other callers.
 * @param source - the observation's provenance as the seam recorded it.
 * @returns the value the output schema declares.
 */
function sourceValue(source: ObservationSource): { providerId: string; datasets: string[]; retrievedAt: string | null } {
  return { providerId: source.providerId, datasets: [...source.datasets], retrievedAt: source.retrievedAt }
}

/**
 * Format an observation's provenance as one model-facing line. The retrieval
 * absence is spelled out rather than left blank: a value computed in process is
 * a different claim from one whose fetch time went unrecorded.
 * @param value - the provenance carried by the tool output.
 * @returns the formatted source line.
 */
export function formatSource(value: SourceValue): string {
  const datasets = value.datasets.length === 0 ? 'an unnamed dataset' : value.datasets.join(', ')
  const retrieval = value.retrievedAt === null
    ? 'computed in process, so there is no retrieval time'
    : `retrieved ${value.retrievedAt}`
  return `Source ${value.providerId} via ${datasets}; ${retrieval}.`
}

/**
 * Format a quote as one model-facing text block. The as-of instant and the
 * session state are always stated, because a price the model cannot date is a
 * price it cannot reason about.
 * @param instrument - the venue and code the call addressed.
 * @param value - the canonical quote output.
 * @returns the formatted quote line set.
 */
export function formatQuote(instrument: { market: string; symbol: string }, value: QuoteValue): string {
  const direction = value.changePercent >= 0 ? '+' : ''
  return [
    `${value.name} (${instrument.market}:${instrument.symbol})`,
    `Last ${value.last} ${value.currency} (${direction}${value.changePercent}% vs previous close ${value.previousClose})`,
    `Volume ${value.volume}`,
    `As of ${value.asOf}; venue ${value.session}.`,
    formatSource(value.source),
  ].join('\n')
}

/**
 * Format session bars as one model-facing text block: a header naming the
 * adjustment, then one line per session. The adjustment is stated because a
 * model comparing these prices against an earlier figure needs the basis.
 * @param instrument - the venue and code the call addressed.
 * @param value - the canonical history output.
 * @returns the formatted bar table.
 */
export function formatHistory(instrument: { market: string; symbol: string }, value: HistoryValue): string {
  const header = `${instrument.market}:${instrument.symbol} — ${value.bars.length} sessions, ${value.adjustment} adjustment`
  const source = formatSource(value.source)
  if (value.bars.length === 0) return `${header}\n(no sessions returned)\n${source}`
  const rows = value.bars.map(
    bar => `${bar.date}  open ${bar.open}  high ${bar.high}  low ${bar.low}  close ${bar.close}  volume ${bar.volume}`,
  )
  return `${header}\n${source}\ndate        open / high / low / close / volume\n${rows.join('\n')}`
}

/**
 * Pending-call presentation for either tool: a generic card naming the
 * instrument. Pure in `args`, as replay requires.
 * @param title - the card title the calling tool supplies.
 * @param args - the raw tool arguments.
 * @returns the generic call view.
 */
function presentInstrumentCall(title: string, args: { market: string; symbol: string }): GenericCallView {
  return {
    card: 'generic',
    kind: 'read',
    title: `${title} ${args.market}:${args.symbol}`,
    rawInput: args,
  }
}

/**
 * Completed-call presentation for either tool: a generic card titled by the
 * instrument. Result copy stays in the tool result so a UI without a richer
 * card still shows the numbers.
 * @param title - the card title the calling tool supplies.
 * @param args - the raw tool arguments.
 * @returns the generic result view.
 */
function presentInstrumentResult(title: string, args: { market: string; symbol: string }): GenericResultView {
  return { card: 'generic', title: `${title} ${args.market}:${args.symbol}` }
}

/**
 * Where one completed call's numbers came from, carried as replayable result
 * metadata by both tools. The rendered text states the same facts, but a
 * surface that lists what an answer rests on has to read them back as data
 * rather than re-parse prose, and it is the metadata — not the output value —
 * that the session log keeps.
 */
export interface ObservationMeta {
  /** Which feed served the values and when they were read. */
  source: SourceValue
  /**
   * Event time of the observation: the quote's own instant, or the trading date
   * of the last session a history returned. Null when a history returned none.
   */
  asOf: string | null
}

/** Replayable presentation state for one completed `market_history` call. */
export interface HistoryMeta {
  /** Session bars in ascending date order. */
  bars: PriceSeriesBar[]
  /** The corporate-action adjustment the bars carry. */
  adjustment: 'none' | 'backward' | 'forward'
}

/**
 * Project provenance into the metadata shape both tools persist.
 * @param source - the observation's provenance.
 * @param asOf - the observation's event time, or null when it has none.
 * @returns the provenance as plain JSON data.
 */
function observationMetaValue(
  source: SourceValue,
  asOf: string | null,
): { source: { providerId: string; datasets: string[]; retrievedAt: string | null }; asOf: string | null } {
  return { source: sourceValue(source), asOf }
}

/**
 * Project a validated `market_quote` output into replayable presentation meta.
 * The quote's card is generic, so this metadata exists for provenance alone.
 * @param value - the canonical `market_quote` output value.
 * @returns the provenance as opaque JSON.
 */
export function quoteMetaFromValue(value: QuoteValue): JsonValue {
  return observationMetaValue(value.source, value.asOf)
}

/**
 * Project a validated `market_history` output into replayable presentation
 * meta. The card cannot be rebuilt from the rendered text, so the bars travel
 * as durable result metadata the same way the web card's sources do, and the
 * provenance travels with them.
 * @param value - the canonical `market_history` output value.
 * @returns the bars, adjustment, and provenance as opaque JSON.
 */
export function historyMetaFromValue(value: HistoryValue): JsonValue {
  return {
    bars: value.bars.map(bar => ({ ...bar })),
    adjustment: value.adjustment,
    ...observationMetaValue(value.source, value.bars.at(-1)?.date ?? null),
  }
}

/** Whether `value` is a valid {@link SourceValue} (defensive narrowing from opaque `meta`). */
function isSourceValue(value: unknown): value is SourceValue {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const { providerId, datasets, retrievedAt } = value as Record<string, unknown>
  return typeof providerId === 'string'
    && Array.isArray(datasets) && datasets.every(entry => typeof entry === 'string')
    && (retrievedAt === null || typeof retrievedAt === 'string')
}

/**
 * Narrow opaque live or replayed result metadata to an {@link ObservationMeta}.
 * Metadata written before either tool carried provenance narrows to
 * `undefined`, so a surface reading it degrades to naming the tool instead of
 * inventing a feed.
 * @param meta - result metadata.
 * @returns the validated provenance, or `undefined` for absent or malformed data.
 */
export function observationMetaFromResult(meta: unknown): ObservationMeta | undefined {
  if (typeof meta !== 'object' || meta === null || Array.isArray(meta)) return undefined
  const { source, asOf } = meta as Record<string, unknown>
  if (!isSourceValue(source)) return undefined
  if (asOf !== null && typeof asOf !== 'string') return undefined
  return { source, asOf }
}

/** Whether `value` is a valid {@link PriceSeriesBar} (defensive narrowing from opaque `meta`). */
function isPriceSeriesBar(value: unknown): value is PriceSeriesBar {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const { date, open, high, low, close, volume } = value as Record<string, unknown>
  return typeof date === 'string'
    && typeof open === 'number' && typeof high === 'number' && typeof low === 'number'
    && typeof close === 'number' && typeof volume === 'number'
}

/**
 * Narrow opaque live or replayed result metadata to a {@link HistoryMeta}.
 * Malformed metadata returns `undefined` so presentation falls back to the
 * generic card instead of throwing during replay.
 * @param meta - result metadata.
 * @returns the validated history meta, or `undefined` for absent or malformed data.
 */
export function historyMetaFromResult(meta: unknown): HistoryMeta | undefined {
  if (typeof meta !== 'object' || meta === null || Array.isArray(meta)) return undefined
  const { bars, adjustment } = meta as Record<string, unknown>
  if (!Array.isArray(bars) || !bars.every(isPriceSeriesBar)) return undefined
  if (adjustment !== 'none' && adjustment !== 'backward' && adjustment !== 'forward') return undefined
  return { bars, adjustment }
}

/**
 * Completed-call presentation for `market_history`: a price-series card a
 * capable UI charts. Falls back to the generic card when the call errored or
 * the metadata is absent or malformed, so a replay never loses the row.
 * @param args - the raw tool arguments; the instrument becomes the card label.
 * @param result - the final tool result; `meta` carries the bars.
 * @returns the price-series view, or the generic card.
 */
export function presentHistoryResult(
  args: { market: string; symbol: string },
  result: ToolResult,
): PriceSeriesResultView | GenericResultView {
  const label = `${args.market}:${args.symbol}`
  if (result.isError) return presentInstrumentResult('History', args)
  const meta = historyMetaFromResult(result.meta)
  if (meta === undefined) return presentInstrumentResult('History', args)
  return {
    card: 'price-series',
    title: `History ${label}`,
    label,
    bars: meta.bars,
    adjustment: meta.adjustment,
  }
}

/**
 * Register the enabled market-data tools. Both default to true; a product that
 * wants only one disables the other in config.
 * @param ctx - context whose `tools` and `systemPrompt` registries receive the
 *   registrations; both are effect-scoped and unregister on plugin dispose.
 * @param config - the resolved plugin config.
 */
export function apply(ctx: Context, config: Config): void {
  // schemastery (Config) has already filled every defaulted field.
  const resolved = config as Required<Config>

  ctx.systemPrompt.section({
    name: 'tool:market_data',
    order: 112,
    text: 'Use market_quote for one instrument\'s latest price and market_history for its recent daily sessions. Both report the observation time, the feed and datasets the values came from, and, for history, the corporate-action adjustment; state those when the answer depends on them, and never compare prices across different adjustments.',
  })

  if (resolved.quote) {
    ctx.tools.register(defineTool({
      name: 'market_quote',
      description: "Read one instrument's latest price, change against the previous close, volume, and the venue session state.",
      parameters: INSTRUMENT_PARAMETERS,
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            name: { type: 'string', required: true },
            currency: { type: 'string', required: true },
            last: { type: 'number', required: true },
            previousClose: { type: 'number', required: true },
            changePercent: { type: 'number', required: true },
            volume: { type: 'number', required: true },
            asOf: { type: 'string', required: true },
            session: { type: 'string', required: true, enum: ['open', 'closed'] },
            source: SOURCE_PROPERTY,
          },
        },
        render: (args, value) => [{ type: 'text', text: formatQuote(args, value) }],
        presentationMeta: (_args, value) => quoteMetaFromValue(value),
      },
      timeoutMs: resolved.timeoutMs,
      // Provider reads do not mutate parent-agent state.
      isConcurrencySafe: () => true,
      async execute(args, exec) {
        const quote = await ctx.marketData.quote(
          { instrument: { market: args.market, symbol: parseSymbol(args.symbol) } },
          exec.signal,
        )
        return {
          name: quote.name,
          currency: quote.currency,
          last: quote.last,
          previousClose: quote.previousClose,
          changePercent: quote.changePercent,
          volume: quote.volume,
          asOf: quote.asOf,
          session: quote.session,
          source: sourceValue(quote.source),
        }
      },
      presentCall: args => presentInstrumentCall('Quote', args),
      presentResult: args => presentInstrumentResult('Quote', args),
    }))
  }

  if (resolved.history) {
    ctx.tools.register(defineTool({
      name: 'market_history',
      description: "Read one instrument's recent daily sessions as open/high/low/close/volume bars, oldest first, with the corporate-action adjustment they carry.",
      parameters: {
        ...INSTRUMENT_PARAMETERS,
        sessions: {
          type: 'integer',
          description: `Number of most recent sessions to return. Defaults to ${resolved.defaultHistorySessions}.`,
        },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            adjustment: { type: 'string', required: true, enum: ['none', 'backward', 'forward'] },
            source: SOURCE_PROPERTY,
            bars: {
              type: 'array',
              required: true,
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  date: { type: 'string', required: true },
                  open: { type: 'number', required: true },
                  high: { type: 'number', required: true },
                  low: { type: 'number', required: true },
                  close: { type: 'number', required: true },
                  volume: { type: 'number', required: true },
                },
              },
            },
          },
        },
        render: (args, value) => [{ type: 'text', text: formatHistory(args, value) }],
        presentationMeta: (_args, value) => historyMetaFromValue(value),
      },
      timeoutMs: resolved.timeoutMs,
      isConcurrencySafe: () => true,
      async execute(args, exec) {
        const history = await ctx.marketData.priceHistory(
          {
            instrument: { market: args.market, symbol: parseSymbol(args.symbol) },
            sessions: args.sessions ?? resolved.defaultHistorySessions,
          },
          exec.signal,
        )
        return {
          adjustment: history.adjustment,
          bars: history.bars.map(bar => ({ ...bar })),
          source: sourceValue(history.source),
        }
      },
      presentCall: args => presentInstrumentCall('History', args),
      presentResult: (args, result) => presentHistoryResult(args, result),
    }))
  }
}
