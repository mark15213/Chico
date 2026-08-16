/**
 * Pure derivation of what a conversation's answers rest on: for each question
 * the reader asked, the external sources the answer drew on, each with the
 * original text it returned.
 *
 * Everything here comes off the session log, which is the point — the rule that
 * anything model-visible is reconstructable from the log is what makes an
 * after-the-fact attribution honest rather than a second story told beside the
 * first. Three families are recognized, because those are the three a Chico
 * answer rests on: a venue feed, the web, and files in the archive. A tool
 * outside them contributes no row, so an answer built without external data
 * shows an exchange with no sources — which is itself the finding.
 *
 * The market rows read the market-data tools' presentation metadata and the web
 * rows read the web tools' result view. Both arrive over the wire as opaque
 * values, so both are narrowed defensively here; metadata written before those
 * tools carried provenance degrades to naming the tool rather than inventing a
 * feed.
 * @module
 */
import type {
  ConversationSnapshot, ToolCallBlock, ToolResultNode,
} from '@deepseek-ai/dsh-client-runtime/client'

/**
 * Which family of source one citation names. The panel reads a market row
 * against a venue and an event time, a web row against a publisher, and a file
 * row against the archive, so the three are told apart rather than flattened
 * into one list of tool calls.
 */
export type SourceKind = 'market' | 'web' | 'file'

/**
 * The tools whose results are external evidence, and the family each belongs
 * to. A tool absent from this table produces no citation: the panel answers
 * "what did this answer rest on", and a todo write or a plan update is work the
 * conversation did, not something it learned.
 */
const SOURCE_TOOLS: Readonly<Record<string, SourceKind>> = {
  'market_quote': 'market',
  'market_history': 'market',
  'web_search': 'web',
  'web_fetch': 'web',
  'read': 'file',
  'grep': 'file',
  'glob': 'file',
}

/** One document a source named inside a citation whose result listed several. */
export interface CitationReference {
  /** Where the document lives. */
  readonly url: string
  /** The document's title, or its URL when the source returned no title. */
  readonly title: string
  /** The publisher's own date, when the source stated one. */
  readonly publishedAt: string | null
}

/** One external source an answer drew on, and the original text it returned. */
export interface SourceCitation {
  /** The tool call that produced it; stable across renders and the React key. */
  readonly callId: string
  /** Which family this source belongs to. */
  readonly kind: SourceKind
  /** The tool that read it, named as the model called it. */
  readonly tool: string
  /** What the call addressed: an instrument, a URL, a query, a path. */
  readonly subject: string
  /** The feed or publisher identity, when the source states one. */
  readonly provider: string | null
  /** The provider's own datasets the values were read from. */
  readonly datasets: readonly string[]
  /**
   * Event time of the observation (ISO-8601): the venue's own instant or
   * trading date. Null when the source states none, which is not the same as
   * the value being current.
   */
  readonly observedAt: string | null
  /**
   * When the values were acquired (ISO-8601): a feed's own stamp, or the
   * harness's call for a read it performed itself. Null when the source
   * computed its values rather than acquiring them — never the clock, because
   * substituting the current time would present a generated number as a fetched
   * one.
   */
  readonly retrievedAt: string | null
  /** Unix epoch ms the workbench received the result. */
  readonly time: number
  /** The documents a source listed, when it returned several. */
  readonly references: readonly CitationReference[]
  /** What the source returned, verbatim — the text the reader opens to check a claim. */
  readonly text: string
  /** Whether the call failed: the row records a refusal, not an observation. */
  readonly failed: boolean
}

/** One question and everything the answer to it drew on. */
export interface AttributedExchange {
  /** Log position of the opening message; stable across renders and the React key. */
  readonly seq: number
  /** Unix epoch ms of the opening message. */
  readonly time: number
  /** What was asked, as one line; empty when the exchange opened without text. */
  readonly question: string
  /** The sources the answer rested on, in call order. */
  readonly citations: readonly SourceCitation[]
}

/** Mutable accumulator for one exchange while the node list is walked. */
interface OpenExchange {
  readonly seq: number
  readonly time: number
  readonly question: string
  readonly citations: SourceCitation[]
}

/** First line of `text`, trimmed, so a long prompt does not take the whole row. */
function headline(text: string): string {
  const [first = ''] = text.trim().split('\n')
  return first.trim()
}

/** Parsed call arguments as a plain record, or undefined when they are not a JSON object. */
function callArgs(argsRaw: string): Record<string, unknown> | undefined {
  if (argsRaw === '') return undefined
  let parsed: unknown
  try {
    parsed = JSON.parse(argsRaw)
  } catch {
    // Non-JSON arguments (a mid-stream truncation): the row falls back to the
    // tool name, which is the only identity left.
    return undefined
  }
  return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : undefined
}

/** The first non-empty string among `keys`, or undefined when the record has none. */
function pick(args: Record<string, unknown>, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = args[key]
    if (typeof value === 'string' && value !== '') return value
  }
  return undefined
}

/**
 * Whether two derivations describe the same evidence.
 *
 * A conversation snapshot is replaced on every streamed chunk, and each
 * replacement re-derives a fresh array; without this the whole column would
 * re-render through a turn that changed nothing it shows. The comparison is by
 * exchange identity and per-citation call identity and text, because those are
 * the facts a row draws — a re-derived citation with the same call and the same
 * original is the same row.
 * @param left - one derivation.
 * @param right - the other.
 * @returns true when the two would draw the same column.
 */
export function sameAttribution(
  left: readonly AttributedExchange[],
  right: readonly AttributedExchange[],
): boolean {
  if (left.length !== right.length) return false
  return left.every((exchange, index) => {
    const other = right[index]
    if (other === undefined || other.seq !== exchange.seq) return false
    if (other.citations.length !== exchange.citations.length) return false
    return exchange.citations.every((citation, at) => {
      const twin = other.citations[at]
      return twin !== undefined && twin.callId === citation.callId && twin.text === citation.text
    })
  })
}

/**
 * Compact an ISO-8601 stamp to the minute for display, without restating it in
 * another zone. A provenance row is read to check a fact, so the offset the
 * source wrote stays on screen; a date-only stamp is returned unchanged.
 * @param value - the stamp as the source wrote it.
 * @returns the compacted stamp, or the input when it is not ISO-8601.
 */
export function compactStamp(value: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/.exec(value)
  if (match === null) return value
  const [, date = value, time, zone = ''] = match
  return time === undefined ? date : `${date} ${time}${zone}`
}

/** Exhaustiveness guard over the closed {@link SourceKind} union. */
/* v8 ignore next 3 -- closed-union backstop; only reached if a source kind is forged */
function assertNever(value: never): never {
  throw new Error(`unhandled source kind: ${String(value)}`)
}

/**
 * What a call addressed, read from its own arguments. A market call is named by
 * the instrument pair rather than by either half, because the same code under
 * two venues is two instruments; the other two families are named by the one
 * address they were given. An unreadable argument set leaves the tool name,
 * which is the only identity a truncated call has left.
 * @param kind - the family the tool belongs to.
 * @param tool - the tool name, as the model called it.
 * @param args - the parsed call arguments, when they were readable.
 * @returns the row's subject.
 */
function subjectOf(kind: SourceKind, tool: string, args: Record<string, unknown> | undefined): string {
  if (args === undefined) return tool
  switch (kind) {
    case 'market':
      return typeof args.market === 'string' && typeof args.symbol === 'string'
        ? `${args.market}:${args.symbol}`
        : tool
    case 'web':
      return pick(args, ['url', 'query']) ?? tool
    case 'file':
      return pick(args, ['path', 'file_path', 'pattern']) ?? tool
    /* v8 ignore next 2 -- closed SourceKind union; SOURCE_TOOLS produces only the three above */
    default:
      return assertNever(kind)
  }
}

/**
 * The host a URL names, which is the publisher identity a fetched page has.
 * @param url - the address the call fetched.
 * @returns the host, or null when the string is not an absolute URL.
 */
function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname
  } catch {
    // URL parsing is the only failure reachable here: an argument that is not
    // an absolute address.
    return null
  }
}

/** Provenance the market-data tools carry as result metadata. */
interface ObservationMeta {
  readonly providerId: string
  readonly datasets: readonly string[]
  readonly retrievedAt: string | null
  readonly asOf: string | null
}

/**
 * Narrow a market tool's opaque result metadata to its provenance.
 * @param meta - the result metadata as it arrived over the wire.
 * @returns the provenance, or null when it is absent or malformed.
 */
function observationOf(meta: unknown): ObservationMeta | null {
  if (typeof meta !== 'object' || meta === null || Array.isArray(meta)) return null
  const record = meta as Record<string, unknown>
  const source = record.source
  if (typeof source !== 'object' || source === null || Array.isArray(source)) return null
  const { providerId, datasets, retrievedAt } = source as Record<string, unknown>
  if (typeof providerId !== 'string') return null
  if (!Array.isArray(datasets) || !datasets.every(entry => typeof entry === 'string')) return null
  if (retrievedAt !== null && typeof retrievedAt !== 'string') return null
  const asOf = record.asOf
  if (asOf !== null && typeof asOf !== 'string') return null
  return { providerId, datasets, retrievedAt, asOf }
}

/** The documents a completed web search listed, in the order it ranked them. */
function webReferences(node: ToolResultNode): readonly CitationReference[] {
  const view = node.resultView
  if (view?.card !== 'web' || view.kind !== 'search') return []
  return view.sources.map(source => ({
    url: source.url,
    title: source.title ?? source.url,
    publishedAt: source.publishedAt ?? null,
  }))
}

/**
 * What one source returned, verbatim. A failed call whose content is empty
 * falls back to its structured error, so the row still says what went wrong
 * instead of showing an empty original.
 * @param node - the settled tool result.
 * @returns the original text.
 */
function originalText(node: ToolResultNode): string {
  const parts = node.content.map(
    block => block.type === 'text' ? block.text : JSON.stringify(block, null, 2),
  )
  if (parts.length > 0) return parts.join('\n')
  return node.error === undefined ? '' : `${node.error.name}: ${node.error.code}`
}

/**
 * Build one citation from a settled call the source table recognizes.
 * @param kind - the family the tool belongs to.
 * @param call - the call head, whose name and arguments say what was addressed.
 * @param node - the settled tool result.
 * @returns the citation.
 */
function citationOf(
  kind: SourceKind,
  call: { readonly name: string; readonly argsRaw: string },
  node: ToolResultNode,
): SourceCitation {
  const args = callArgs(call.argsRaw)
  const market = kind === 'market' ? observationOf(node.meta) : null
  const fetched = kind === 'web' && args !== undefined && typeof args.url === 'string' ? args.url : null
  return {
    callId: node.callId,
    kind,
    tool: call.name,
    subject: subjectOf(kind, call.name, args),
    provider: market?.providerId ?? (fetched === null ? null : hostOf(fetched)),
    datasets: market?.datasets ?? [],
    observedAt: market?.asOf ?? null,
    // A feed states when it was read; a web or archive read is performed by the
    // harness itself, so the result's own time IS the acquisition instant.
    retrievedAt: kind === 'market'
      ? market?.retrievedAt ?? null
      : new Date(node.time).toISOString(),
    time: node.time,
    references: kind === 'web' ? webReferences(node) : [],
    text: originalText(node),
    failed: node.isError,
  }
}

/**
 * Append every citation this call and its children produced, in dispatch order.
 * A call still running has produced nothing to cite, and one whose head fell
 * outside the window cannot be classified, so both contribute no row while
 * their children are still walked.
 */
function collect(block: ToolCallBlock, into: SourceCitation[]): void {
  if ('kind' in block) {
    const call = block.call
    const kind = call === null ? undefined : SOURCE_TOOLS[call.name]
    if (call !== null && kind !== undefined) into.push(citationOf(kind, call, block))
  }
  for (const child of block.subCalls) collect(child, into)
}

/**
 * Derive what each of a conversation's answers rests on.
 *
 * Exchanges open on the reader's own messages, so a steering message mid-turn
 * lands in the exchange it steered rather than starting a new one. Calls that
 * arrive before any message in the loaded window — the window cut can leave a
 * question outside it — open an unlabelled exchange rather than being dropped,
 * because a source with no visible question is still a source the answer used.
 *
 * Exchanges with no citations are kept: an answer built without external data
 * is model-generated content, and a panel that hid those would report only the
 * grounded half of the conversation.
 * @param snapshot - the conversation as the client currently holds it.
 * @returns the exchanges, newest first.
 */
export function attributionModel(snapshot: ConversationSnapshot): readonly AttributedExchange[] {
  const exchanges: OpenExchange[] = []
  const open = (seq: number, time: number, question: string): OpenExchange => {
    const entry: OpenExchange = { seq, time, question, citations: [] }
    exchanges.push(entry)
    return entry
  }
  for (const node of snapshot.nodes) {
    if (node.kind === 'user') {
      const text = node.content
        .map(block => block.type === 'text' ? block.text : '')
        .join('\n')
      open(node.seq, node.time, headline(text))
      continue
    }
    if (node.kind !== 'tool-result') continue
    const current = exchanges.at(-1) ?? open(node.seq, node.time, '')
    collect(node, current.citations)
  }
  return exchanges.reverse()
}
