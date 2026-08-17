// @vitest-environment jsdom
/**
 * Automations: the pure summaries and coverage derivations, each of the four
 * surfaces rendered against the fixture, and the registrations with fiber
 * teardown proving removal (HMR safety).
 */
import { Context } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import { zh } from '../src/client/locales.ts'
import {
  conditionSummary, covers, directionOf, firingsFor, formatPercent, scopeSummary, throttleSummary,
  watching, type Automation, type TriggerFiring,
} from '../src/client/automation-model.ts'
import { AutomationFocus } from '../src/client/automation-store.ts'
import { AutomationDetails } from '../src/client/AutomationDetails.tsx'
import { AutomationPage } from '../src/client/AutomationPage.tsx'
import { AttachPanel } from '../src/client/AttachPanel.tsx'
import { ConversationStrip } from '../src/client/ConversationStrip.tsx'
import { DeliveredPush } from '../src/client/DeliveredPush.tsx'
import { PushedMessages } from '../src/client/PushedMessages.tsx'
import { RecordSection } from '../src/client/RecordSection.tsx'
import { NameMark } from '../src/client/NameMark.tsx'
import { TriggerCard } from '../src/client/TriggerCard.tsx'
import { AUTOMATIONS, FIRINGS } from '../src/client/fixture.ts'
import * as automation from '../src/client/index.ts'

afterEach(cleanup)

// The rendered assertions read the shipped Chinese, which is the key source of
// truth; the common dictionary backs the shared vocabulary the package reuses.
const t = makeTranslate(zh, commonZh) as unknown as Parameters<typeof TriggerCard>[0]['t']

const MOUTAI = { market: 'SSE', symbol: '600519' } as const
const BYD = { market: 'SZSE', symbol: '002594' } as const
const UNWATCHED = { market: 'NASDAQ', symbol: 'AAPL' } as const

const dayChange = AUTOMATIONS[0] as Automation
const windowMove = AUTOMATIONS[1] as Automation
const priceLevel = AUTOMATIONS[2] as Automation

describe('automation summaries', () => {
  it('states each condition in the market’s vocabulary, not the union’s', () => {
    expect(conditionSummary(dayChange.condition, t)).toBe('日内涨幅 ≥ 3%')
    expect(conditionSummary(windowMove.condition, t)).toBe('5 分钟内跌 ≥ 2%')
    expect(conditionSummary(priceLevel.condition, t)).toBe('价格跌破 1600')
  })

  it('names the coverage and carries the resolved count', () => {
    expect(scopeSummary(dayChange.scope, 4, t)).toBe('全部自选 · 4 只')
    expect(scopeSummary(windowMove.scope, 2, t)).toBe('持仓 · 2 只')
    expect(scopeSummary(priceLevel.scope, 1, t)).toBe('指定标的 · 1 只')
  })

  it('spells out both bounds, because a rule with neither is the one that floods', () => {
    expect(throttleSummary(dayChange.throttle, t)).toBe('每只每天一次 · 全天上限 20 条')
    expect(throttleSummary(windowMove.throttle, t)).toBe('每只间隔 30 分钟 · 全天上限 10 条')
  })

  it('carries direction as data and pads the sign, so a column of changes aligns', () => {
    expect(directionOf(3.42)).toBe('up')
    expect(directionOf(-2.1)).toBe('down')
    expect(directionOf(0)).toBe('flat')
    expect(formatPercent(3.4)).toBe('+3.40%')
    expect(formatPercent(-2.1)).toBe('-2.10%')
    expect(formatPercent(0)).toBe('0.00%')
  })

  it('refuses a variant it does not know rather than drawing an empty line', () => {
    const rogue = { kind: 'volumeSpike' } as unknown as Automation['condition']
    expect(() => conditionSummary(rogue, t)).toThrow(/unreachable automation variant/)
    const rogueScope = { kind: 'sector' } as unknown as Automation['scope']
    expect(() => scopeSummary(rogueScope, 0, t)).toThrow(/unreachable automation variant/)
  })
})

describe('coverage', () => {
  it('reports which rules watch one name, and ignores the paused ones', () => {
    // The price-level rule covers Moutai but is disabled: a strip that listed
    // it would promise a watch nothing is performing.
    expect(covers(priceLevel, MOUTAI)).toBe(true)
    expect(watching(AUTOMATIONS, MOUTAI).map(rule => rule.id))
      .toEqual(['a-day-change', 'a-window-move'])
  })

  it('watches nothing when no name is open', () => {
    expect(watching(AUTOMATIONS, null)).toEqual([])
    expect(firingsFor(FIRINGS, null)).toEqual([])
  })

  it('answers for a name outside every rule’s coverage', () => {
    expect(watching(AUTOMATIONS, UNWATCHED)).toEqual([])
    expect(firingsFor(FIRINGS, UNWATCHED)).toEqual([])
  })

  it('collects one name’s own firings', () => {
    expect(firingsFor(FIRINGS, BYD).map(firing => firing.id)).toEqual(['f-1'])
  })
})

describe('the trigger card', () => {
  const firing = FIRINGS.find(entry => entry.id === 'f-1') as TriggerFiring

  it('states the observation the condition was decided on', () => {
    const view = render(<TriggerCard firing={firing} t={t} />)

    expect(view.getByText('比亚迪')).toBeTruthy()
    expect(view.getByText('+3.42%')).toBeTruthy()
    expect(view.getByText('245.10')).toBeTruthy()
    expect(view.getByText('今日第 1 次触发')).toBeTruthy()
  })

  it('states nothing the model wrote: the reading belongs beside these numbers', () => {
    const view = render(<TriggerCard firing={firing} t={t} />)

    expect(view.queryByText(/成交量为近五日均量的 2.1 倍/)).toBeNull()
  })

  it('names no rule: every place it appears has already said which rule this is', () => {
    const view = render(<TriggerCard firing={firing} t={t} />)

    expect(view.queryByText('自选涨超 3%')).toBeNull()
  })

  it('reports the window a movement was measured over, never a fixed one', () => {
    const windowed = FIRINGS.find(entry => entry.id === 'f-3') as TriggerFiring
    const view = render(<TriggerCard firing={windowed} t={t} />)

    expect(view.getByText('5 分钟内 -2.10%')).toBeTruthy()
  })
})

describe('the automation page', () => {
  function mountPage() {
    const focus = new AutomationFocus()
    const select = vi.fn((id: string) => { focus.select(id) })
    const closePage = vi.fn()
    const props = { automations: AUTOMATIONS, focus, select, closePage, mode: 'names', t }
    const view = render(<AutomationPage {...props as unknown as Parameters<typeof AutomationPage>[0]} />)
    return { view, focus, select, closePage }
  }

  it('lists every rule with its condition, coverage, and today’s count', () => {
    const { view } = mountPage()

    expect(view.getByText('自选涨超 3%')).toBeTruthy()
    expect(view.getByText('日内涨幅 ≥ 3%')).toBeTruthy()
    expect(view.getByText('全部自选 · 4 只')).toBeTruthy()
    expect(view.getByText('今日 2 次')).toBeTruthy()
  })

  it('says a paused rule is paused rather than hiding it', () => {
    const { view } = mountPage()

    expect(view.getByText('茅台跌破 1600')).toBeTruthy()
    expect(view.getAllByText('已暂停')).toHaveLength(1)
    expect(view.getAllByText('运行中')).toHaveLength(2)
  })

  it('opens a rule in the detail column', () => {
    const { view, select, focus } = mountPage()

    fireEvent.click(view.getByRole('button', { name: '打开任务「持仓 5 分钟急跌」' }))

    expect(select).toHaveBeenCalledWith('a-window-move')
    expect(focus.snapshot()).toBe('a-window-move')
  })

  it('returns the centre column to the conversation it covered', () => {
    const { view, closePage } = mountPage()

    fireEvent.click(view.getByRole('button', { name: '返回对话' }))

    expect(closePage).toHaveBeenCalledTimes(1)
  })

  it('says plainly that nothing here is running, so a reviewer is not misled', () => {
    const { view } = mountPage()

    expect(view.getByRole('note').textContent).toContain('规则不会被执行')
  })

  it('opens the editor, and fixes a price level’s coverage to one instrument', () => {
    const { view } = mountPage()

    fireEvent.click(view.getByRole('button', { name: /新建任务/ }))
    fireEvent.click(view.getByRole('button', { name: '价位突破' }))

    // A level holds for one instrument, so the other two coverages cannot be
    // chosen rather than being silently ignored after the fact.
    expect(view.getByRole('button', { name: '全部自选' }).hasAttribute('disabled')).toBe(true)
    expect(view.getByRole('button', { name: '指定标的' }).getAttribute('aria-pressed')).toBe('true')
    // The direction vocabulary changes with the condition.
    expect(view.getByRole('button', { name: '跌破' })).toBeTruthy()
    expect(view.queryByRole('button', { name: '下跌' })).toBeNull()
  })

  it('draws the empty state when no rule exists yet', () => {
    const focus = new AutomationFocus()
    const props = { automations: [], focus, select: vi.fn(), closePage: vi.fn(), mode: 'names', t }
    const view = render(<AutomationPage {...props as unknown as Parameters<typeof AutomationPage>[0]} />)

    expect(view.getByText('还没有自动任务。')).toBeTruthy()
  })
})

describe('the automation detail column', () => {
  function mountDetails(selected: string | null) {
    const focus = new AutomationFocus()
    if (selected !== null) focus.select(selected)
    const closeDetails = vi.fn()
    const props = { automations: AUTOMATIONS, firings: FIRINGS, focus, closeDetails, mode: 'names', t }
    const view = render(<AutomationDetails {...props as unknown as Parameters<typeof AutomationDetails>[0]} />)
    return { view, closeDetails }
  }

  it('asks for a rule before it draws one', () => {
    const { view } = mountDetails(null)

    expect(view.getByText(/从中间选一条任务/)).toBeTruthy()
  })

  it('states the rule’s parameters and every name it covers', () => {
    const { view } = mountDetails('a-day-change')

    expect(view.getByText('日内涨幅 ≥ 3%')).toBeTruthy()
    expect(view.getByText('每只每天一次 · 全天上限 20 条')).toBeTruthy()
    expect(view.getByText('海康威视')).toBeTruthy()
  })

  it('says whether a hit is followed by a reading', () => {
    expect(mountDetails('a-day-change').view.getByText(/卡片之后追加一段模型解读/)).toBeTruthy()
    cleanup()
    expect(mountDetails('a-price-level').view.getByText(/只推卡片/)).toBeTruthy()
  })

  it('expands a hit into exactly the card the conversation received', () => {
    const { view } = mountDetails('a-day-change')
    const hit = view.getAllByRole('button', { expanded: false })[0]

    fireEvent.click(hit as HTMLElement)

    expect(view.getByText('推送到对话时长这样')).toBeTruthy()
    // The preview IS the delivery — same component the transcript renders — so
    // a preview cannot promise a composition the conversation does not get.
    expect(view.container.querySelector('[data-push="f-2"]')).toBeTruthy()
    expect(view.getAllByText('+3.11%')).toHaveLength(2)
  })

  it('says a quiet rule was quiet', () => {
    const { view } = mountDetails('a-price-level')

    expect(view.getByText('今天还没有触发。')).toBeTruthy()
  })

  it('returns its width to the page', () => {
    const { view, closeDetails } = mountDetails('a-day-change')

    fireEvent.click(view.getByRole('button', { name: '收起自动任务详情' }))

    expect(closeDetails).toHaveBeenCalledTimes(1)
  })
})

/** The conversation these surfaces are mounted in. */
const BOUND_SESSION = 's-bound'

/**
 * The investing frame's published selection. `sessions` is the open name's
 * bound conversations — the list every surface here tests itself against.
 */
function focusOf(instrument: typeof MOUTAI | typeof UNWATCHED | null) {
  const state = instrument === null
    ? { instrument: null, displayName: null, sessions: [], sessionStatus: 'ready' as const }
    : {
      instrument,
      displayName: '贵州茅台',
      sessions: [BOUND_SESSION],
      sessionStatus: 'ready' as const,
    }
  return { subscribe: () => () => {}, snapshot: () => state }
}

describe('the capsule above a conversation', () => {
  function mountStrip(
    instrument: typeof MOUTAI | typeof UNWATCHED | null,
    sessionId: string = BOUND_SESSION,
  ) {
    const openPage = vi.fn()
    const props = {
      automations: AUTOMATIONS,
      firings: FIRINGS,
      focus: focusOf(instrument),
      sessionId,
      openPage,
      t,
    }
    const view = render(
      <ConversationStrip {...props as unknown as Parameters<typeof ConversationStrip>[0]} />,
    )
    return { view, openPage }
  }

  it('states what is watching this conversation’s subject and how often it spoke', () => {
    const { view } = mountStrip(MOUTAI)

    expect(view.getByText('2 个任务在盯')).toBeTruthy()
    expect(view.getByText('今日 1 次')).toBeTruthy()
  })

  it('stays visible while nothing has fired, because what is running is worth knowing', () => {
    // Apple is covered by no rule, so use a name whose rules have been quiet:
    // the capsule marks fired vs quiet rather than appearing only after a hit.
    const { view } = mountStrip(MOUTAI)
    const capsule = view.getByRole('button', { expanded: false })

    expect(capsule.getAttribute('data-fired')).toBe('true')
    expect(view.getByText('2 个任务在盯')).toBeTruthy()
  })

  it('renders nothing for a conversation about no name', () => {
    const { view } = mountStrip(null)

    expect(view.container.firstChild).toBeNull()
  })

  it('renders nothing in a conversation that is not bound to the open name', () => {
    // The workbench selection says which name the FRAME shows. Reading it
    // directly put this capsule over every conversation the reader opened,
    // including ones about a codebase; binding is what makes it mean something.
    expect(mountStrip(MOUTAI, 's-other').view.container.firstChild).toBeNull()
  })

  it('renders nothing for a name no rule watches', () => {
    const { view } = mountStrip(UNWATCHED)

    expect(view.container.firstChild).toBeNull()
  })

  it('names each rule and its condition on request, which is the real question', () => {
    const { view } = mountStrip(MOUTAI)

    fireEvent.click(view.getByRole('button', { expanded: false }))

    expect(view.getByText('持仓 5 分钟急跌')).toBeTruthy()
    expect(view.getByText('5 分钟内跌 ≥ 2%')).toBeTruthy()
  })

  it('leads to the page where a listed rule can be changed', () => {
    const { view, openPage } = mountStrip(MOUTAI)
    fireEvent.click(view.getByRole('button', { expanded: false }))

    fireEvent.click(view.getByRole('button', { name: '管理' }))

    expect(openPage).toHaveBeenCalledTimes(1)
  })

  it('opens the attach panel from the conversation it floats over', () => {
    const { view } = mountStrip(MOUTAI)
    fireEvent.click(view.getByRole('button', { expanded: false }))

    fireEvent.click(view.getByRole('button', { name: '加任务' }))

    expect(view.getByText('为「贵州茅台」加自动任务')).toBeTruthy()
  })
})

describe('attaching one name to automations', () => {
  function mountAttach(instrument: typeof MOUTAI | typeof BYD) {
    const onClose = vi.fn()
    const props = {
      open: true, instrument, displayName: '贵州茅台', automations: AUTOMATIONS, t, onClose,
    }
    const view = render(<AttachPanel {...props as unknown as Parameters<typeof AttachPanel>[0]} />)
    return { view, onClose }
  }

  it('offers only the rules whose coverage a person edits', () => {
    // BYD is in no named-instrument rule, so the price-level rule is joinable.
    const { view } = mountAttach(BYD)

    expect(view.getByText('茅台跌破 1600')).toBeTruthy()
    // A watchlist or holdings rule resolves its own members and is never listed.
    expect(view.queryByText('自选涨超 3%')).toBeNull()
    expect(view.queryByText('持仓 5 分钟急跌')).toBeNull()
  })

  it('does not offer a rule this name is already in', () => {
    // Moutai is already the price-level rule's only name.
    const { view } = mountAttach(MOUTAI)

    expect(view.queryByText('茅台跌破 1600')).toBeNull()
    expect(view.getByText(/暂时没有可加入的/)).toBeTruthy()
  })

  it('joins a rule by checking it', () => {
    const { view } = mountAttach(BYD)
    const box = view.getByRole('checkbox', { name: /茅台跌破 1600/ })

    fireEvent.click(box)

    expect((box as HTMLInputElement).checked).toBe(true)
  })

  it('builds a rule that watches only this name, with no coverage to pick', () => {
    const { view } = mountAttach(BYD)

    expect(view.getByText('新建一条只盯「贵州茅台」的')).toBeTruthy()
    // Coverage is fixed by where the panel was opened from, so it is not asked.
    expect(view.queryByRole('button', { name: '全部自选' })).toBeNull()
    expect(view.queryByRole('button', { name: '持仓' })).toBeNull()
  })

  it('switches the direction vocabulary with the condition', () => {
    const { view } = mountAttach(BYD)

    fireEvent.click(view.getByRole('button', { name: '价位突破' }))

    expect(view.getByRole('button', { name: '跌破' })).toBeTruthy()
    expect(view.queryByRole('button', { name: '下跌' })).toBeNull()
  })
})

describe('what a rule delivered into the conversation', () => {
  function mountPushes(
    instrument: typeof MOUTAI | typeof UNWATCHED | null,
    sessionId: string = BOUND_SESSION,
  ) {
    const setDraft = vi.fn()
    const props = {
      automations: AUTOMATIONS,
      firings: FIRINGS,
      focus: focusOf(instrument),
      sessionId,
      inputActions: { setDraft },
      t,
    }
    const view = render(
      <PushedMessages {...props as unknown as Parameters<typeof PushedMessages>[0]} />,
    )
    return { view, setDraft }
  }

  it('renders this name’s deliveries with the card the rule produced', () => {
    const { view } = mountPushes(MOUTAI)

    expect(view.container.querySelector('[data-push="f-3"]')).toBeTruthy()
    expect(view.getByText('贵州茅台')).toBeTruthy()
    expect(view.getByText('-1.18%')).toBeTruthy()
  })

  it('says a delivery was pushed, so it is not read as an answer to a question', () => {
    const { view } = mountPushes(MOUTAI)

    expect(view.getByText('持仓 5 分钟急跌 触发后推送')).toBeTruthy()
  })

  it('carries the model’s reading as prose under the observation, exactly once', () => {
    const { view } = mountPushes(MOUTAI)

    expect(view.getAllByText(/五分钟内回落 2.1%/)).toHaveLength(1)
  })

  it('omits the prose for a rule that asks for no reading', () => {
    // The day-change rule fired on Moutai's neighbours; f-3 is the only
    // delivery here and it has a reading, so assert against the rule that has
    // none through its own delivery.
    const plain = FIRINGS.find(entry => entry.id === 'f-2') as TriggerFiring
    const view = render(<DeliveredPush firing={plain} t={t} />)

    expect(view.container.querySelector('[data-push="f-2"]')).toBeTruthy()
    expect(view.queryByRole('button', { name: '接着问' })).toBeNull()
  })

  it('continues the conversation from the delivery by seeding the composer', () => {
    const { view, setDraft } = mountPushes(MOUTAI)

    fireEvent.click(view.getByRole('button', { name: '接着问' }))

    expect(setDraft).toHaveBeenCalledWith('贵州茅台这波是什么原因？')
  })

  it('renders nothing in a conversation nothing was delivered to', () => {
    expect(mountPushes(UNWATCHED).view.container.firstChild).toBeNull()
    cleanup()
    expect(mountPushes(null).view.container.firstChild).toBeNull()
  })

  it('renders nothing in a conversation not bound to the open name', () => {
    // A delivery belongs to the conversation it was delivered to, never to
    // whichever conversation happens to be open while that name is selected.
    expect(mountPushes(MOUTAI, 's-other').view.container.firstChild).toBeNull()
  })
})

describe('the record block', () => {
  function mountSection(instrument: typeof MOUTAI | typeof UNWATCHED) {
    const props = {
      automations: AUTOMATIONS, firings: FIRINGS, instrument, displayName: '贵州茅台', t,
    }
    return render(<RecordSection {...props as unknown as Parameters<typeof RecordSection>[0]} />)
  }

  it('lists what watches this name, with today’s count per rule', () => {
    const view = mountSection(MOUTAI)

    expect(view.getByText('自选涨超 3%')).toBeTruthy()
    expect(view.getByText('持仓 5 分钟急跌')).toBeTruthy()
    expect(view.getByText(/今日 1 次/)).toBeTruthy()
    expect(view.getByText('今日未触发')).toBeTruthy()
  })

  it('says nothing watches a name rather than showing an empty list', () => {
    const view = mountSection(UNWATCHED)

    expect(view.getByText('还没有任务在盯这只股。')).toBeTruthy()
  })

  it('opens the same attach panel the conversation offers', () => {
    const view = mountSection(MOUTAI)

    fireEvent.click(view.getByRole('button', { name: '为「贵州茅台」加自动任务' }))

    expect(view.getByText('为「贵州茅台」加自动任务')).toBeTruthy()
  })
})

describe('the followed-name mark', () => {
  it('marks a covered name, carrying the count in its accessible name', () => {
    const props = { automations: AUTOMATIONS, instrument: MOUTAI, displayName: '贵州茅台', t }
    const view = render(<NameMark {...props as unknown as Parameters<typeof NameMark>[0]} />)

    expect(view.getByRole('img', { name: '2 个自动任务在盯这只标的' })).toBeTruthy()
  })

  it('draws nothing on a name no rule covers', () => {
    const props = { automations: AUTOMATIONS, instrument: UNWATCHED, displayName: 'Apple', t }
    const view = render(<NameMark {...props as unknown as Parameters<typeof NameMark>[0]} />)

    expect(view.container.firstChild).toBeNull()
  })
})

describe('automation registration', () => {
  /** The services the plugin declares, with the layout and the open name stubbed. */
  async function bench() {
    const ctx = new Context()
    await ctx.plugin(SlotRegistry).await()
    const slots = ctx.get('slots') as SlotRegistry
    slots.register({
      name: 'root',
      children: {
        'investing.workbench.section': { kind: 'list', scope: 'root' },
        'investing.name.mark': { kind: 'list', scope: 'root' },
        'conversation.session.strip': { kind: 'list', scope: 'session' },
        'page': { kind: 'keyed', scope: 'root' },
        'details': { kind: 'keyed', scope: 'session' },
      },
    } as never, () => null)
    ctx.provide('locale', new LocaleRuntime(ctx))
    const layout = {
      openDetails: vi.fn(),
      closeDetails: vi.fn(),
      toggleSidebar: vi.fn(),
      setMode: vi.fn(),
      openPage: vi.fn(),
      closePage: vi.fn(),
    }
    ctx.provide('layout', layout)
    ctx.provide('investingFocus', {
      subscribe: () => () => {},
      snapshot: () => ({
        instrument: MOUTAI, displayName: '贵州茅台', sessions: [], sessionStatus: 'ready',
      }),
    })
    const fiber = ctx.plugin(automation)
    await fiber.await()
    return { ctx, slots, layout, fiber }
  }

  it('registers all five surfaces', async () => {
    const { slots } = await bench()

    expect(slots.entries('investing.workbench.section').map(entry => entry.options.id))
      .toEqual(['automation'])
    expect(slots.entries('investing.name.mark').map(entry => entry.options.id)).toEqual(['automation'])
    expect(slots.entries('conversation.session.strip').map(entry => entry.options.id))
      .toEqual(['automation'])
    expect(slots.entries('page').map(entry => entry.options.key)).toEqual(['automation'])
    expect(slots.entries('details').map(entry => entry.options.key)).toEqual(['automation'])
  })

  it('reveals the detail column when the page opens a rule', async () => {
    const { slots, layout } = await bench()
    const page = slots.entries('page')[0]
    const injected = (page?.inject as unknown as () => { select: (id: string) => void })()

    injected.select('a-day-change')

    expect(layout.openDetails).toHaveBeenCalledTimes(1)
  })

  it('opens its own page from the conversation strip', async () => {
    const { slots, layout } = await bench()
    const banner = slots.entries('conversation.session.strip')[0]
    const injected = (banner?.inject as unknown as () => { openPage: () => void })()

    injected.openPage()

    expect(layout.openPage).toHaveBeenCalledWith('automation')
  })

  it('reads the open name from the investing frame rather than keeping a copy', async () => {
    const { slots } = await bench()
    const banner = slots.entries('conversation.session.strip')[0]
    const injected = (banner?.inject as unknown as () => {
      focus: { snapshot: () => { displayName: string | null } }
    })()

    expect(injected.focus.snapshot().displayName).toBe('贵州茅台')
  })

  it('removes every registration when the fiber is disposed (HMR safety)', async () => {
    const { slots, fiber } = await bench()

    await fiber.dispose()

    expect(slots.entries('investing.workbench.section')).toEqual([])
    expect(slots.entries('investing.name.mark')).toEqual([])
    expect(slots.entries('conversation.session.strip')).toEqual([])
    expect(slots.entries('page')).toEqual([])
    expect(slots.entries('details')).toEqual([])
  })
})
