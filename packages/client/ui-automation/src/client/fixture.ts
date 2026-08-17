/**
 * Static rules and firings for the design review of these columns.
 *
 * THIS FILE IS THE WHOLE OF THE PACKAGE'S DATA. Nothing here is read from a
 * feed, nothing is written back, and no rule in it is evaluated: the engine
 * that decides conditions and the registry that stores them are host-side and
 * are not built yet. Wiring this package replaces this module with reads over
 * that seam; every component below already takes its data as props, so nothing
 * else in the package changes when it goes.
 */
import type { Automation, TriggerFiring } from './automation-model.ts'

const BYD = { market: 'SZSE', symbol: '002594' } as const
const CATL = { market: 'SZSE', symbol: '300750' } as const
const MOUTAI = { market: 'SSE', symbol: '600519' } as const
const HIKVISION = { market: 'SZSE', symbol: '002415' } as const

/** The rules the review reads against. */
export const AUTOMATIONS: readonly Automation[] = [
  {
    id: 'a-day-change',
    name: '自选涨超 3%',
    condition: { kind: 'dayChange', direction: 'up', thresholdPercent: 3 },
    scope: { kind: 'watchlist' },
    throttle: { perNameCooldownMinutes: null, dailyCap: 20 },
    interpret: true,
    enabled: true,
    covers: [
      { instrument: MOUTAI, displayName: '贵州茅台' },
      { instrument: CATL, displayName: '宁德时代' },
      { instrument: BYD, displayName: '比亚迪' },
      { instrument: HIKVISION, displayName: '海康威视' },
    ],
    firedToday: 2,
  },
  {
    id: 'a-window-move',
    name: '持仓 5 分钟急跌',
    condition: { kind: 'windowMove', direction: 'down', windowMinutes: 5, thresholdPercent: 2 },
    scope: { kind: 'posture', posture: 'holding' },
    throttle: { perNameCooldownMinutes: 30, dailyCap: 10 },
    interpret: true,
    enabled: true,
    covers: [
      { instrument: MOUTAI, displayName: '贵州茅台' },
      { instrument: BYD, displayName: '比亚迪' },
    ],
    firedToday: 1,
  },
  {
    id: 'a-price-level',
    name: '茅台跌破 1600',
    condition: { kind: 'priceLevel', direction: 'below', price: 1600 },
    scope: { kind: 'names', instruments: [MOUTAI] },
    throttle: { perNameCooldownMinutes: null, dailyCap: 3 },
    interpret: false,
    enabled: false,
    covers: [{ instrument: MOUTAI, displayName: '贵州茅台' }],
    firedToday: 0,
  },
]

/** The firings the history and the cards are drawn from, newest first. */
export const FIRINGS: readonly TriggerFiring[] = [
  {
    id: 'f-3',
    automationId: 'a-window-move',
    automationName: '持仓 5 分钟急跌',
    instrument: MOUTAI,
    displayName: '贵州茅台',
    firedAt: '2026-08-17T01:55:00.000Z',
    last: 1662.4,
    changePercent: -1.18,
    windowMovePercent: -2.1,
    windowMinutes: 5,
    volumeRatio: 1.6,
    ordinalToday: 1,
    interpretation: '五分钟内回落 2.1%，成交量放大到近五日均量的 1.6 倍，跌幅集中在 09:52 之后的三分钟内。',
  },
  {
    id: 'f-2',
    automationId: 'a-day-change',
    automationName: '自选涨超 3%',
    instrument: CATL,
    displayName: '宁德时代',
    firedAt: '2026-08-17T02:02:00.000Z',
    last: 210.4,
    changePercent: 3.11,
    windowMovePercent: null,
    windowMinutes: null,
    volumeRatio: 1.2,
    ordinalToday: 2,
    interpretation: null,
  },
  {
    id: 'f-1',
    automationId: 'a-day-change',
    automationName: '自选涨超 3%',
    instrument: BYD,
    displayName: '比亚迪',
    firedAt: '2026-08-17T01:41:00.000Z',
    last: 245.1,
    changePercent: 3.42,
    windowMovePercent: null,
    windowMinutes: null,
    volumeRatio: 2.1,
    ordinalToday: 1,
    interpretation: '成交量为近五日均量的 2.1 倍，涨幅集中在 09:35–09:41 的开盘后第一段，盘中未见公告。',
  },
]
