/**
 * Compile `mock-data/data/` into this package's own dataset module.
 *
 * Run: `node packages/investment/market-data-mock/scripts/build-dataset.mjs`
 *
 * The provider ships the compiled module rather than reading the repository
 * dataset at runtime, because a published package cannot reach a directory that
 * exists only in this checkout. `src/dataset.ts` is therefore a generated,
 * committed artifact — edit `mock-data/anchors.mjs`, rerun `mock-data/generate.mjs`,
 * then rerun this script.
 *
 * Columns rather than an array of bar objects: the same 500 sessions cost about
 * a third as much source text, and the provider rebuilds bar objects on read.
 *
 * Only instruments the seam can name are compiled in. `Market` is a closed
 * union with no member for an off-exchange fund, so the dataset's two
 * open-ended funds (005827, 000198) have no address here and are skipped.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const DATA = join(HERE, '../../../../mock-data/data')
const OUT = join(HERE, '../src/dataset.ts')

/**
 * Read one dataset file.
 * @param {string} rel - path relative to `mock-data/data`.
 * @returns {any} the parsed JSON.
 */
const load = (rel) => JSON.parse(readFileSync(join(DATA, rel), 'utf8'))

/** Instruments compiled into the provider, in listing order. */
const SERIES = [
  { file: 'bars/SSE-600519.json', market: 'SSE', symbol: '600519' },
  { file: 'bars/SZSE-300750.json', market: 'SZSE', symbol: '300750' },
  { file: 'bars/SSE-600036.json', market: 'SSE', symbol: '600036' },
  { file: 'bars/SSE-688981.json', market: 'SSE', symbol: '688981' },
  { file: 'bars/SZSE-002594.json', market: 'SZSE', symbol: '002594' },
  { file: 'bars/HKEX-00700.json', market: 'HKEX', symbol: '00700' },
  { file: 'index-bars/000300.json', market: 'SSE', symbol: '000300' },
  { file: 'index-bars/000001.json', market: 'SSE', symbol: '000001' },
  { file: 'index-bars/399006.json', market: 'SZSE', symbol: '399006' },
  { file: 'index-bars/HSI.json', market: 'HKEX', symbol: 'HSI' },
]

const instruments = load('instruments.json').instruments
const indexes = load('indexes.json').indexes

/**
 * Display name for one compiled instrument, from whichever catalogue names it.
 * @param {string} market - venue.
 * @param {string} symbol - venue code.
 * @returns {string} the display name.
 */
function nameOf(market, symbol) {
  const listed = instruments.find((row) => row.instrument.symbol === symbol)
  if (listed !== undefined) return listed.name
  const index = indexes.find((row) => row.code === symbol)
  if (index !== undefined) return index.name
  throw new Error(`build-dataset: no name for ${market}:${symbol}`)
}

/**
 * Render a number array as source text, wrapped so no line exceeds the
 * repository's length limit — a 500-number column on one line is 4000
 * characters and fails lint.
 * @param {number[]} values - the column.
 * @returns {string} a bracketed, wrapped literal.
 */
function column(values) {
  const lines = []
  let line = ''
  for (const value of values) {
    const piece = `${value},`
    if (line.length + piece.length > 120) {
      lines.push(line)
      line = ''
    }
    line += piece
  }
  if (line !== '') lines.push(line)
  return `[\n      ${lines.join('\n      ')}\n    ]`
}

/**
 * Render a long string as concatenated, wrapped source text.
 * @param {string} text - the whole string.
 * @returns {string} a parenthesised concatenation no line of which is over-long.
 */
function wrapText(text) {
  const chunks = text.match(/.{1,110}/g) ?? ['']
  return chunks.length === 1
    ? `'${chunks[0]}'`
    : `(\n      '${chunks.join("'\n      + '")}'\n    )`
}

const entries = SERIES.map(({ file, market, symbol }) => {
  const series = load(file)
  const bars = series.bars
  const name = nameOf(market, symbol)
  return `  {
    market: '${market}',
    symbol: '${symbol}',
    name: '${name}',
    currency: '${series.currency ?? 'CNY'}',
    adjustment: '${series.adjustment}',
    dates: ${wrapText(bars.map((bar) => bar.date.replace(/-/g, '')).join(','))},
    open: ${column(bars.map((bar) => bar.open))},
    high: ${column(bars.map((bar) => bar.high))},
    low: ${column(bars.map((bar) => bar.low))},
    close: ${column(bars.map((bar) => bar.close))},
    volume: ${column(bars.map((bar) => Math.round(bar.volume)))},
  },`
})

const anchor = load('instruments.json').anchorDate

const source = `/**
 * The compiled mock dataset this provider serves. **Generated — do not edit.**
 *
 * Produced by \`scripts/build-dataset.mjs\` from \`mock-data/data/\`; see that
 * dataset's README for how the series were built and which real observations
 * their magnitudes were calibrated against. Every price here is synthetic.
 *
 * Stored as columns with the dates as one comma-joined string: the same 500
 * sessions cost about a third as much source text as an array of bar objects,
 * and the provider rebuilds bar objects on read.
 * @module @deepseek-ai/dsh-market-data-mock/dataset
 */

import type { Market } from '@deepseek-ai/dsh-market-data'

/** One instrument's compiled series. Every column is aligned by index. */
export interface MockSeries {
  /** Trading venue. */
  readonly market: Market
  /** The venue's own code. */
  readonly symbol: string
  /** Display name in the venue's own language. */
  readonly name: string
  /** ISO-4217 code the prices are denominated in. */
  readonly currency: string
  /** Corporate-action basis the prices carry. */
  readonly adjustment: 'none' | 'backward' | 'forward'
  /** Trading dates as \`YYYYMMDD\`, comma-joined, ascending. */
  readonly dates: string
  /** Session opens. */
  readonly open: readonly number[]
  /** Session highs. */
  readonly high: readonly number[]
  /** Session lows. */
  readonly low: readonly number[]
  /** Session closes. */
  readonly close: readonly number[]
  /** Session volumes in shares. */
  readonly volume: readonly number[]
}

/** Trading date every compiled series ends on. */
export const ANCHOR_DATE = '${anchor}'

/** The compiled series, in listing order. */
export const DATASET: readonly MockSeries[] = [
${entries.join('\n')}
]
`

writeFileSync(OUT, source)
const sessions = load(SERIES[0].file).bars.length
console.log(`build-dataset: wrote ${OUT}`)
console.log(`  ${SERIES.length} instruments × ${sessions} sessions, anchor ${anchor}`)
