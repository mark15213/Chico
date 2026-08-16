// @vitest-environment jsdom
/**
 * The evidence column: the pure derivation of what each answer rests on from
 * the session log, and the column that renders it — including the original text
 * a reader opens to check a claim.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type { ConversationSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import { en } from '../src/client/locales.ts'
import { attributionModel, compactStamp, sameAttribution } from '../src/client/attribution-model.ts'
import { AttributionPanel } from '../src/client/AttributionPanel.tsx'
import { NameDetails } from '../src/client/NameDetails.tsx'
import { WorkbenchFocus } from '../src/client/workbench-store.ts'

afterEach(cleanup)

// English so the assertions read as the copy a user sees.
const t = makeTranslate(en, commonZh)

/** The provenance a market tool writes into its result metadata. */
const tushare = { providerId: 'tushare', datasets: ['daily', 'stock_basic'], retrievedAt: '2026-08-15T01:12:00.000Z' }

let seq = 0

/** One reader message, which opens an exchange. */
function ask(text: string, time = 1_000): Record<string, unknown> {
  return { kind: 'user', seq: seq += 1, time, content: [{ type: 'text', text }], source: null }
}

/** One settled tool call, with everything the derivation reads off it. */
function result(over: {
  name: string
  args?: Record<string, unknown>
  text?: string
  time?: number
  meta?: unknown
  resultView?: unknown
  isError?: boolean
  subCalls?: readonly unknown[]
}): Record<string, unknown> {
  const at = seq += 1
  return {
    kind: 'tool-result',
    seq: at,
    time: over.time ?? 2_000,
    callId: `call-${at}`,
    call: { name: over.name, argsRaw: JSON.stringify(over.args ?? {}) },
    callTime: null,
    content: [{ type: 'text', text: over.text ?? '' }],
    isError: over.isError ?? false,
    meta: over.meta,
    callView: null,
    resultView: over.resultView ?? null,
    subCalls: over.subCalls ?? [],
  }
}

/** A conversation carrying only the nodes the derivation reads. */
function conversation(...nodes: readonly Record<string, unknown>[]): ConversationSnapshot {
  return { nodes } as unknown as ConversationSnapshot
}

/** Mount the evidence column over one conversation. */
function mount(snapshot: ConversationSnapshot) {
  const useSession = ((select: (state: ConversationSnapshot) => unknown) =>
    select(snapshot)) as never
  return render(<AttributionPanel useSession={useSession} t={t} />)
}

describe('deriving what an answer rests on', () => {
  it('files each source under the question that prompted it, newest question first', () => {
    const model = attributionModel(conversation(
      ask('茅台最近怎么样'),
      result({ name: 'market_quote', args: { market: 'SSE', symbol: '600519' } }),
      ask('宁德呢'),
      result({ name: 'market_quote', args: { market: 'SZSE', symbol: '300750' } }),
    ))

    expect(model.map(exchange => exchange.question)).toEqual(['宁德呢', '茅台最近怎么样'])
    expect(model[0]?.citations.map(one => one.subject)).toEqual(['SZSE:300750'])
    expect(model[1]?.citations.map(one => one.subject)).toEqual(['SSE:600519'])
  })

  it('reads a market row’s feed, datasets, and both time facts off the result metadata', () => {
    const [exchange] = attributionModel(conversation(
      ask('茅台收在多少'),
      result({
        name: 'market_quote',
        args: { market: 'SSE', symbol: '600519' },
        meta: { source: tushare, asOf: '2026-08-14T07:00:00.000Z' },
      }),
    ))
    const [citation] = exchange?.citations ?? []

    expect(citation).toMatchObject({
      kind: 'market',
      subject: 'SSE:600519',
      provider: 'tushare',
      datasets: ['daily', 'stock_basic'],
      observedAt: '2026-08-14T07:00:00.000Z',
      retrievedAt: '2026-08-15T01:12:00.000Z',
    })
  })

  it('keeps a computed provider’s missing retrieval rather than dating it from the call', () => {
    const [exchange] = attributionModel(conversation(
      ask('茅台收在多少'),
      result({
        name: 'market_quote',
        args: { market: 'SSE', symbol: '600519' },
        meta: { source: { providerId: 'fixture', datasets: ['fixture-table'], retrievedAt: null }, asOf: null },
      }),
    ))

    expect(exchange?.citations[0]?.retrievedAt).toBeNull()
    expect(exchange?.citations[0]?.observedAt).toBeNull()
  })

  it('dates a fetch by the call, because the harness did the retrieving itself', () => {
    const [exchange] = attributionModel(conversation(
      ask('看看这篇公告'),
      result({
        name: 'web_fetch',
        args: { url: 'https://www.sse.com.cn/notice/1' },
        time: Date.parse('2026-08-15T02:30:00.000Z'),
      }),
    ))

    expect(exchange?.citations[0]).toMatchObject({
      kind: 'web',
      subject: 'https://www.sse.com.cn/notice/1',
      provider: 'www.sse.com.cn',
      retrievedAt: '2026-08-15T02:30:00.000Z',
    })
  })

  it('lists the documents a web search returned, so each one can be opened', () => {
    const [exchange] = attributionModel(conversation(
      ask('储能订单'),
      result({
        name: 'web_search',
        args: { query: '储能 订单' },
        resultView: {
          card: 'web',
          kind: 'search',
          sources: [
            { url: 'https://a.example/1', title: '订单落地', publishedAt: '2026-08-10' },
            { url: 'https://b.example/2' },
          ],
        },
      }),
    ))

    expect(exchange?.citations[0]?.subject).toBe('储能 订单')
    expect(exchange?.citations[0]?.references).toEqual([
      { url: 'https://a.example/1', title: '订单落地', publishedAt: '2026-08-10' },
      { url: 'https://b.example/2', title: 'https://b.example/2', publishedAt: null },
    ])
  })

  it('counts a file the conversation read out of the archive', () => {
    const [exchange] = attributionModel(conversation(
      ask('我之前怎么写的'),
      result({ name: 'read', args: { file_path: '/archive/600519.md' }, text: '# 茅台\n毛利率见底' }),
    ))

    expect(exchange?.citations[0]).toMatchObject({
      kind: 'file',
      subject: '/archive/600519.md',
      provider: null,
      text: '# 茅台\n毛利率见底',
    })
  })

  it('counts a source read inside another call, which the tree would otherwise hide', () => {
    const [exchange] = attributionModel(conversation(
      ask('跑一段'),
      result({
        name: 'run_code',
        subCalls: [result({ name: 'market_quote', args: { market: 'SSE', symbol: '600519' } })],
      }),
    ))

    expect(exchange?.citations.map(one => one.tool)).toEqual(['market_quote'])
  })

  it('leaves work the conversation did out of what it learned', () => {
    const [exchange] = attributionModel(conversation(
      ask('记一下'),
      result({ name: 'todo_write', args: { todos: [] } }),
    ))

    expect(exchange?.citations).toEqual([])
  })

  it('keeps an answer that used nothing, because that is the finding', () => {
    const model = attributionModel(conversation(ask('你觉得呢')))

    expect(model).toHaveLength(1)
    expect(model[0]?.citations).toEqual([])
  })

  it('keeps a source whose question fell outside the loaded window', () => {
    const model = attributionModel(conversation(
      result({ name: 'market_quote', args: { market: 'SSE', symbol: '600519' } }),
    ))

    expect(model[0]?.question).toBe('')
    expect(model[0]?.citations).toHaveLength(1)
  })

  it.each([
    ['truncated mid-stream', '{"url":'],
    ['not an object at all', '[]'],
    ['empty', ''],
  ])('falls back to the tool name when the arguments are %s', (_case, argsRaw) => {
    const model = attributionModel(conversation(
      ask('看看'),
      { ...result({ name: 'web_fetch' }), call: { name: 'web_fetch', argsRaw } },
    ))

    expect(model[0]?.citations[0]?.subject).toBe('web_fetch')
    expect(model[0]?.citations[0]?.provider).toBeNull()
  })

  it.each([
    ['market', 'market_quote'],
    ['web', 'web_search'],
    ['file', 'read'],
  ])('falls back to the tool name when a %s call names nothing it recognizes', (_family, name) => {
    const model = attributionModel(conversation(ask('看看'), result({ name, args: {} })))

    expect(model[0]?.citations[0]?.subject).toBe(name)
  })

  it('leaves the publisher unnamed when the fetched address is not a URL', () => {
    const model = attributionModel(conversation(
      ask('看看'),
      result({ name: 'web_fetch', args: { url: 'notes/600519.md' } }),
    ))

    expect(model[0]?.citations[0]?.provider).toBeNull()
  })

  it.each([
    ['absent', undefined],
    ['a non-object', 'nope'],
    ['an array', []],
    ['carrying no source', { bars: [] }],
    ['a source that is not an object', { source: 'tushare' }],
    ['a source with no provider id', { source: { datasets: [], retrievedAt: null } }],
    ['datasets that are not strings', { source: { providerId: 'x', datasets: [1], retrievedAt: null } }],
    ['datasets that are not a list', { source: { providerId: 'x', datasets: 'daily', retrievedAt: null } }],
    ['a retrieval time that is not a stamp', { source: { providerId: 'x', datasets: [], retrievedAt: 7 } }],
    ['an event time that is not a stamp', { source: { providerId: 'x', datasets: [], retrievedAt: null }, asOf: 7 }],
  ])('names the tool rather than a feed when the metadata is %s', (_case, meta) => {
    const model = attributionModel(conversation(
      ask('茅台'),
      result({ name: 'market_quote', args: { market: 'SSE', symbol: '600519' }, meta }),
    ))

    expect(model[0]?.citations[0]?.provider).toBeNull()
  })

  it('reads a non-text result block as the original it is', () => {
    const model = attributionModel(conversation(
      ask('看看'),
      { ...result({ name: 'read', args: { path: '/a' } }), content: [{ type: 'image', attachment: 'a-1' }] },
    ))

    expect(model[0]?.citations[0]?.text).toContain('"type": "image"')
  })

  it('leaves the original empty when a call returned neither content nor an error', () => {
    const model = attributionModel(conversation(
      ask('看看'),
      { ...result({ name: 'read', args: { path: '/a' } }), content: [] },
    ))

    expect(model[0]?.citations[0]?.text).toBe('')
  })

  it('skips a call still running and one whose head fell outside the window', () => {
    const model = attributionModel(conversation(
      ask('跑一段'),
      {
        ...result({ name: 'run_code' }),
        subCalls: [
          { callId: 'c-live', name: 'market_quote', argsRaw: '{}', turn: 1, step: 1, time: 1, callView: null, subCalls: [] },
          { ...result({ name: 'read', args: { path: '/a' } }), call: null },
        ],
      },
    ))

    expect(model[0]?.citations).toEqual([])
  })

  it('ignores a node that is neither a message nor a tool result', () => {
    const model = attributionModel(conversation(
      ask('看看'),
      { kind: 'assistant', seq: 99, time: 3_000, turn: 1, step: 1, blocks: [] },
    ))

    expect(model).toHaveLength(1)
    expect(model[0]?.citations).toEqual([])
  })

  it('takes the text of a question that also carried an image', () => {
    const model = attributionModel(conversation({
      ...ask('这张图'),
      content: [{ type: 'image', attachment: 'a-1' }, { type: 'text', text: '这张图' }],
    }))

    expect(model[0]?.question).toBe('这张图')
  })

  it('records a refusal as a failed row carrying what went wrong', () => {
    const model = attributionModel(conversation(
      ask('港股呢'),
      {
        ...result({ name: 'market_quote', args: { market: 'HKEX', symbol: '00700' }, isError: true }),
        content: [],
        error: { name: 'MarketDataError', code: 'MARKET_DATA_VENUE_UNSUPPORTED' },
      },
    ))

    expect(model[0]?.citations[0]?.failed).toBe(true)
    expect(model[0]?.citations[0]?.text).toBe('MarketDataError: MARKET_DATA_VENUE_UNSUPPORTED')
  })

  it('takes the question’s first line, so a pasted prompt does not fill the column', () => {
    const model = attributionModel(conversation(ask('  第一行  \n第二行')))

    expect(model[0]?.question).toBe('第一行')
  })
})

describe('holding the column still', () => {
  /** Re-derive one log from the same starting position, so identities repeat. */
  function derive(text: string, extra = false) {
    seq = 0
    const nodes = [
      ask('茅台收在多少'),
      result({ name: 'market_quote', args: { market: 'SSE', symbol: '600519' }, text }),
      ...extra ? [result({ name: 'read', args: { path: '/archive/600519.md' } })] : [],
    ]
    return attributionModel(conversation(...nodes))
  }

  it('treats a re-derivation of the same log as the same column', () => {
    expect(sameAttribution(derive('Last 1486 CNY'), derive('Last 1486 CNY'))).toBe(true)
  })

  it('redraws when a source’s original changes, which is what the reader is reading', () => {
    expect(sameAttribution(derive('Last 1486 CNY'), derive('Last 1490 CNY'))).toBe(false)
  })

  it('redraws when a source is added to an exchange', () => {
    expect(sameAttribution(derive('Last 1486 CNY'), derive('Last 1486 CNY', true))).toBe(false)
  })

  it('redraws when an exchange is added, or when one moves in the log', () => {
    const one = derive('Last 1486 CNY')
    const moved = one.map(exchange => ({ ...exchange, seq: exchange.seq + 10 }))

    expect(sameAttribution(one, [])).toBe(false)
    expect(sameAttribution(one, moved)).toBe(false)
  })

  it('redraws when a source at the same position is a different call', () => {
    const one = derive('Last 1486 CNY')
    const relabelled = one.map(exchange => ({
      ...exchange,
      citations: exchange.citations.map(citation => ({ ...citation, callId: 'other' })),
    }))

    expect(sameAttribution(one, relabelled)).toBe(false)
  })
})

describe('stamp display', () => {
  it('cuts an instant to the minute and keeps the zone the source wrote', () => {
    expect(compactStamp('2026-08-14T07:00:00.000Z')).toBe('2026-08-14 07:00Z')
    expect(compactStamp('2026-08-14T15:00:00+08:00')).toBe('2026-08-14 15:00+08:00')
  })

  it('leaves a trading date alone, because a session is not an instant', () => {
    expect(compactStamp('2026-08-14')).toBe('2026-08-14')
  })

  it('leaves anything it does not recognize exactly as written', () => {
    expect(compactStamp('sometime last week')).toBe('sometime last week')
  })
})

describe('the evidence column', () => {
  it('shows a source with its feed and times, and opens the original on demand', () => {
    const view = mount(conversation(
      ask('茅台收在多少'),
      result({
        name: 'market_quote',
        args: { market: 'SSE', symbol: '600519' },
        meta: { source: tushare, asOf: '2026-08-14T07:00:00.000Z' },
        text: 'Last 1486 CNY',
      }),
    ))

    expect(view.getByText('SSE:600519')).toBeTruthy()
    expect(view.getByText('tushare')).toBeTruthy()
    expect(view.getByText('2026-08-14 07:00Z')).toBeTruthy()
    expect(view.queryByText('Last 1486 CNY')).toBeNull()

    fireEvent.click(view.getByText('Read the original'))

    expect(view.getByText('Last 1486 CNY')).toBeTruthy()
  })

  it('says a computed source was never retrieved rather than leaving the field blank', () => {
    const view = mount(conversation(
      ask('茅台收在多少'),
      result({
        name: 'market_quote',
        args: { market: 'SSE', symbol: '600519' },
        meta: { source: { providerId: 'fixture', datasets: ['fixture-table'], retrievedAt: null }, asOf: null },
      }),
    ))

    expect(view.getByText('computed in process; nothing was retrieved')).toBeTruthy()
    expect(view.getByText('not stated')).toBeTruthy()
  })

  it('lists a search’s documents and names the tool when no feed served the row', () => {
    const view = mount(conversation(
      ask('储能订单'),
      result({
        name: 'web_search',
        args: { query: '储能 订单' },
        resultView: {
          card: 'web',
          kind: 'search',
          sources: [
            { url: 'https://a.example/1', title: '订单落地', publishedAt: '2026-08-10' },
            { url: 'https://b.example/2' },
          ],
        },
      }),
    ))

    expect(view.getByText('web_search')).toBeTruthy()
    expect(view.getByText('订单落地').getAttribute('href')).toBe('https://a.example/1')
    expect(view.getByText('· 2026-08-10')).toBeTruthy()
    expect(view.getByText('https://b.example/2')).toBeTruthy()
  })

  it('marks a refusal as failed rather than listing it as an observation', () => {
    const view = mount(conversation(
      ask('港股呢'),
      result({ name: 'market_quote', args: { market: 'HKEX', symbol: '00700' }, isError: true, text: 'refused' }),
    ))

    expect(view.getByText('call failed')).toBeTruthy()
  })

  it('says the question fell outside the window instead of drawing a blank heading', () => {
    const view = mount(conversation(
      result({ name: 'read', args: { path: '/archive/600519.md' } }),
    ))

    expect(view.getByText('(the question is outside the loaded window)')).toBeTruthy()
  })

  it('says outright when an answer rested on nothing external', () => {
    const view = mount(conversation(ask('你觉得呢')))

    expect(view.getByText('This answer drew on no external source. It is the model’s own.')).toBeTruthy()
  })

  it('invites a first conversation when there is none', () => {
    const view = mount(conversation())

    expect(view.getByText('Start a conversation; every source an answer draws on is listed here.')).toBeTruthy()
  })
})

describe('the details column', () => {
  /** Mount the column with a record face that answers nothing, so only the tabs matter. */
  function mountColumn(snapshot: ConversationSnapshot) {
    const props = {
      useSession: (select: (state: ConversationSnapshot) => unknown) => select(snapshot),
      focus: new WorkbenchFocus(),
      read: () => new Promise(() => {}),
      dossier: () => new Promise(() => {}),
      append: () => new Promise(() => {}),
      t,
    } as unknown as Parameters<typeof NameDetails>[0]
    return render(<NameDetails {...props} />)
  }

  it('opens on the evidence, because that is what a reader checks an answer against', () => {
    const view = mountColumn(conversation(
      ask('茅台收在多少'),
      result({ name: 'market_quote', args: { market: 'SSE', symbol: '600519' } }),
    ))

    expect(view.getByRole('tab', { name: 'Evidence' }).getAttribute('aria-selected')).toBe('true')
    expect(view.getByText('SSE:600519')).toBeTruthy()
  })

  it('switches to the record without discarding what the other tab was showing', () => {
    const view = mountColumn(conversation(
      ask('茅台收在多少'),
      result({ name: 'market_quote', args: { market: 'SSE', symbol: '600519' }, text: 'Last 1486 CNY' }),
    ))
    fireEvent.click(view.getByText('Read the original'))

    fireEvent.click(view.getByRole('tab', { name: 'Record' }))

    expect(view.getByRole('tab', { name: 'Record' }).getAttribute('aria-selected')).toBe('true')
    // Still mounted behind the hidden panel: the reader comes back to it open.
    expect(view.getByText('Last 1486 CNY')).toBeTruthy()
  })
})
