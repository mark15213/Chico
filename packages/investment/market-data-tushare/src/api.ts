/**
 * Tushare Pro transport: the single POST endpoint every interface shares, its
 * envelope, and the column-array decoding each response arrives in.
 *
 * Tushare answers every interface at one URL, distinguished by an `api_name`
 * in the body, and returns rows as parallel arrays under a `fields` header
 * rather than as objects. Decoding that back into named values is the whole of
 * this module; which interface to call and what its numbers mean belongs to
 * the provider.
 * @module @deepseek-ai/dsh-market-data-tushare/src/api
 */

import { MarketDataError } from '@deepseek-ai/dsh-market-data'

/** One decoded row: the interface's own column names mapped onto their values. */
export type TushareRow = Readonly<Record<string, unknown>>

/** Everything one call needs beyond the request itself. */
export interface TushareEndpoint {
  /** Base URL of the Tushare Pro API. */
  readonly baseURL: string
  /** The account token; every interface authenticates with it. */
  readonly token: string
  /** Wall-clock budget for one call, after which it is abandoned. */
  readonly timeoutMs: number
}

/** One Tushare call: the interface, its parameters, and the columns wanted. */
export interface TushareRequest {
  /** Interface name, such as `daily` or `stock_basic`. */
  readonly apiName: string
  /** Interface parameters, already stringified as the API expects them. */
  readonly params: Readonly<Record<string, string>>
  /** Columns to return; Tushare rejects a field the token is not entitled to. */
  readonly fields: readonly string[]
}

/**
 * The refusal for anything that makes this provider unable to answer: a
 * transport failure, a rejected token, an entitlement the account lacks, or a
 * response that does not decode. All four would fail every instrument
 * identically, which is what separates them from a refusal about one name.
 * @param detail - what went wrong, in the provider's own terms.
 * @returns the seam error to reject with.
 */
export function providerUnavailable(detail: string): MarketDataError {
  return new MarketDataError(`tushare: ${detail}`, 'MARKET_DATA_PROVIDER_UNAVAILABLE')
}

/** The envelope Tushare wraps every answer in; `data` is null on refusal. */
interface TushareEnvelope {
  code?: unknown
  msg?: unknown
  data?: { fields?: unknown; items?: unknown } | null
}

/**
 * Decode the column-array payload into named rows, rejecting anything that
 * does not match the documented layout. This is a wire boundary: the response
 * is JSON from another service, so its structure is checked rather than
 * trusted.
 * @param data - the envelope's `data` member.
 * @returns one row per item, keyed by the response's own column names.
 */
function decodeRows(data: TushareEnvelope['data']): TushareRow[] {
  // A successful call that matched nothing carries a null payload rather than
  // an empty one, so absence here means no rows, not a malformed answer.
  if (data === undefined || data === null) return []
  const { fields, items } = data
  if (!Array.isArray(fields) || !fields.every(field => typeof field === 'string')) {
    throw providerUnavailable('response carried no column header')
  }
  if (!Array.isArray(items)) throw providerUnavailable('response carried no rows')
  return items.map((item) => {
    if (!Array.isArray(item)) throw providerUnavailable('response row was not an array')
    return Object.fromEntries(fields.map((field, index) => [field, item[index]]))
  })
}

/**
 * Call one Tushare interface and return its rows.
 *
 * Tushare reports refusals in the body rather than the status line — a
 * revoked token and an interface the account has too few points for both
 * arrive as HTTP 200 with a non-zero `code` — so the body is what decides
 * success.
 * @param endpoint - base URL, token, and the per-call time budget.
 * @param request - the interface to call, its parameters, and its columns.
 * @param signal - optional caller cancellation, honoured alongside the budget.
 * @returns the decoded rows, empty when the interface matched nothing.
 * @throws {@link MarketDataError} `MARKET_DATA_PROVIDER_UNAVAILABLE` on a
 *   transport failure, a non-zero response code, or an undecodable body.
 */
export async function callTushare(
  endpoint: TushareEndpoint,
  request: TushareRequest,
  signal?: AbortSignal,
): Promise<TushareRow[]> {
  const budget = AbortSignal.timeout(endpoint.timeoutMs)
  let response: Response
  try {
    response = await fetch(endpoint.baseURL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        api_name: request.apiName,
        token: endpoint.token,
        params: request.params,
        fields: request.fields.join(','),
      }),
      signal: signal === undefined ? budget : AbortSignal.any([signal, budget]),
    })
  } catch (error) {
    // The caller's own cancellation is not a provider failure: it travels back
    // untranslated so an abandoned request is told apart from a broken source.
    if (signal?.aborted === true) throw error
    if (budget.aborted) throw providerUnavailable(`${request.apiName} timed out after ${endpoint.timeoutMs}ms`)
    throw providerUnavailable(`${request.apiName} could not be reached: ${String(error)}`)
  }
  if (!response.ok) {
    throw providerUnavailable(`${request.apiName} returned HTTP ${response.status}`)
  }
  const envelope = await response.json() as TushareEnvelope
  if (envelope.code !== 0) {
    const reason = typeof envelope.msg === 'string' && envelope.msg.length > 0 ? envelope.msg : 'no reason given'
    throw providerUnavailable(`${request.apiName} refused (code ${String(envelope.code)}): ${reason}`)
  }
  return decodeRows(envelope.data)
}

/**
 * Read one column as a string, rejecting an absent or non-string value.
 * @param row - the decoded row.
 * @param column - the column name to read.
 * @returns the column's value.
 * @throws {@link MarketDataError} when the column is missing or not a string.
 */
export function text(row: TushareRow, column: string): string {
  const value = row[column]
  if (typeof value !== 'string') throw providerUnavailable(`column "${column}" was not text`)
  return value
}

/**
 * Read one column as a finite number, rejecting anything else. Tushare sends
 * numbers as JSON numbers and sends a missing figure as null, so a null here
 * is a gap in the venue's own data rather than a decoding fault — it is still
 * refused, because a bar with a null close is not a bar.
 * @param row - the decoded row.
 * @param column - the column name to read.
 * @returns the column's value.
 * @throws {@link MarketDataError} when the column is missing or not a finite number.
 */
export function figure(row: TushareRow, column: string): number {
  const value = row[column]
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw providerUnavailable(`column "${column}" was not a finite number`)
  }
  return value
}
