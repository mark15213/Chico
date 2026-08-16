/**
 * Chico mock 数据集生成器。
 *
 * 运行：`node mock-data/generate.mjs`（无依赖，Node 22+）。
 * 输出：`mock-data/data/**`，全部为确定性结果——同一份 anchors.mjs 在任何机器上
 * 重跑得到逐字节相同的 JSON，因此可以安全地进版本库、进快照测试。
 *
 * 生成顺序有依赖：指数序列先生成，个股复用其基准指数的市场因子（Beta 与相关性
 * 由此自然成立，而不是事后填一个数字）；财务先于估值（PE/PB 分位数由价格序列
 * 与滚动财务真实计算）；价格与财务先于风险指标（回撤、夏普、Beta 全部由序列算出）。
 */

import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ANCHOR_DATE, SESSIONS, CN_HOLIDAYS, HKEX_HOLIDAYS, INDEXES, STOCKS, FUNDS, FUND_HOLDINGS,
} from './anchors.mjs'

const ROOT = dirname(fileURLToPath(import.meta.url))
const OUT = join(ROOT, 'data')

/** 数据集版本：结构变更时递增，消费方据此判断是否需要适配。 */
const DATASET_VERSION = 1

// ---------------------------------------------------------------------------
// 确定性随机
// ---------------------------------------------------------------------------

/**
 * mulberry32：32 位状态的确定性伪随机数发生器。
 * @param {number} seed - 初始状态。
 * @returns {() => number} 均匀分布于 [0,1) 的取数函数。
 */
function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * 把任意字符串折叠成一个种子，使每个标的的序列互不相同又可复现。
 * @param {string} text - 种子来源，通常是 `市场:代码:用途`。
 * @returns {number} 32 位种子。
 */
function seedOf(text) {
  let h = 2166136261
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/**
 * Box-Muller 变换：由两个均匀分布取数得到一个标准正态取数。
 * @param {() => number} rng - 均匀分布发生器。
 * @returns {number} 标准正态随机数。
 */
function gauss(rng) {
  const u = Math.max(rng(), 1e-12)
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng())
}

/**
 * 四舍五入到指定小数位，消除浮点尾数，使 JSON 稳定。
 * @param {number} value - 原值。
 * @param {number} digits - 小数位数。
 * @returns {number} 定点结果。
 */
const r = (value, digits) => Number(value.toFixed(digits))

// ---------------------------------------------------------------------------
// 交易日历
// ---------------------------------------------------------------------------

const DAY_MS = 86400000

/**
 * 把休市区间展开成日期集合。
 * @param {Array<[string,string]>} ranges - `[起, 止]` 闭区间列表。
 * @returns {Set<string>} `YYYY-MM-DD` 集合。
 */
function expandHolidays(ranges) {
  const set = new Set()
  for (const [from, to] of ranges) {
    for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += DAY_MS) {
      set.add(new Date(t).toISOString().slice(0, 10))
    }
  }
  return set
}

const CN_OFF = expandHolidays(CN_HOLIDAYS)
// 港股只跟随内地的春节、国庆首日与元旦，其余以港股自身假期为准。
const HK_OFF_FINAL = new Set([
  ...expandHolidays(HKEX_HOLIDAYS),
  ...[...CN_OFF].filter((d) => d.includes('-02-') || d.endsWith('-10-01') || d.endsWith('-01-01')),
])

/**
 * 从锚定日向前取 `count` 个交易日。
 * @param {'CN'|'HK'} calendar - 使用哪本休市日历。
 * @param {number} count - 需要的交易日根数。
 * @returns {string[]} 升序 `YYYY-MM-DD` 列表，末位为锚定日。
 */
function tradingDays(calendar, count) {
  const off = calendar === 'HK' ? HK_OFF_FINAL : CN_OFF
  const days = []
  let t = Date.parse(`${ANCHOR_DATE}T00:00:00Z`)
  while (days.length < count) {
    const d = new Date(t)
    const wd = d.getUTCDay()
    const iso = d.toISOString().slice(0, 10)
    if (wd !== 0 && wd !== 6 && !off.has(iso)) days.push(iso)
    t -= DAY_MS
  }
  return days.reverse()
}

const CAL_CN = tradingDays('CN', SESSIONS)
const CAL_HK = tradingDays('HK', SESSIONS)

// ---------------------------------------------------------------------------
// 价格路径
// ---------------------------------------------------------------------------

/**
 * 生成一条市场因子序列：含波动聚集的冲击，再标准化到单位方差。
 *
 * 波动聚集让序列出现真实的平静期与动荡期；标准化是 Beta 能被精确控制的前提——
 * 个股冲击由基准冲击与独立冲击线性合成，只有两者都是单位方差时，合成权重才
 * 等于相关系数。
 *
 * @param {string} key - 种子来源。
 * @param {number} n - 长度。
 * @returns {number[]} 均值 0、方差 1 的冲击序列。
 */
function factorSeries(key, n) {
  const rng = mulberry32(seedOf(key))
  const raw = []
  let ewma = 1
  for (let i = 0; i < n; i += 1) {
    const z = gauss(rng)
    ewma = 0.88 * ewma + 0.12 * Math.abs(z)
    raw.push(z * (0.55 + 0.55 * ewma))
  }
  const mean = raw.reduce((a, b) => a + b, 0) / n
  const sd = Math.sqrt(raw.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1))
  return raw.map((v) => (v - mean) / sd)
}

/**
 * 合成一条与基准相关的冲击序列，使结果对基准的 Beta 等于目标值。
 *
 * 依据 `Beta = ρ · σ标的 / σ基准`：给定目标 Beta 与两者的年化波动率，相关系数
 * 被唯一确定。直接按经验值设相关系数会让高波动标的的 Beta 系统性偏低。
 *
 * @param {number[]} benchShocks - 基准的单位方差冲击。
 * @param {number[]} ownShocks - 标的自身的单位方差冲击。
 * @param {number} betaTarget - 目标 Beta。
 * @param {number} volSelf - 标的年化波动率。
 * @param {number} volBench - 基准年化波动率。
 * @returns {number[]} 合成后的单位方差冲击。
 */
function correlatedShocks(benchShocks, ownShocks, betaTarget, volSelf, volBench) {
  const rho = Math.max(-0.95, Math.min(0.95, (betaTarget * volBench) / volSelf))
  const residual = Math.sqrt(1 - rho * rho)
  return ownShocks.map((z, i) => rho * benchShocks[i] + residual * z)
}

/**
 * 由冲击序列构造锚定收盘价序列。
 *
 * 序列两端都被真实观测钉住：末值等于 `spec.close`，起点由 `spec.return2Y` 决定。
 * 步骤顺序不可调换——趋势校准只加一条线性斜坡，不改变波动结构；52 周缩放会
 * 改变斜率，所以之后要再校准一次趋势；涨跌停截断必须最后做，而末值平移是整体
 * 加常数、不改变任何一天的涨跌幅，所以放在截断之后仍然安全。
 *
 * @param {object} spec - 标的画像。
 * @param {number[]} shocks - 该标的自身的单位方差冲击序列。
 * @param {string[]} dates - 交易日历。
 * @returns {number[]} 与 `dates` 等长的收盘价序列，末位等于 `spec.close`。
 */
function closeSeries(spec, shocks, dates) {
  const n = dates.length
  const sd = spec.vol / Math.sqrt(252)
  const logret = shocks.map((z) => sd * z)

  const cum = [0]
  for (let i = 1; i < n; i += 1) cum.push(cum[i - 1] + logret[i])
  let rel = cum.map((c) => c - cum[n - 1])

  // 相对末值的对数偏移：起点应为 -ln(1+两年收益)。斜坡在末位为 0，锚定不受影响。
  const startTarget = -Math.log(1 + spec.return2Y)
  const applyTrend = (series) => {
    const delta = startTarget - series[0]
    return series.map((v, i) => v + (1 - i / (n - 1)) * delta)
  }
  rel = applyTrend(rel)

  if (spec.low52 && spec.high52) {
    const tail = rel.slice(Math.max(0, n - 250))
    const up = Math.max(...tail)
    const down = Math.min(...tail)
    const kUp = up > 1e-6 ? Math.log(spec.high52 / spec.close) / up : 1
    const kDown = down < -1e-6 ? Math.log(spec.low52 / spec.close) / down : 1
    rel = applyTrend(rel.map((v) => (v > 0 ? v * kUp : v * kDown)))
  }

  let ret = [0]
  for (let i = 1; i < n; i += 1) ret.push(rel[i] - rel[i - 1])

  for (const ex of spec.exDividends ?? []) {
    const idx = dates.indexOf(ex.date)
    if (idx > 0) ret[idx] += Math.log(1 - ex.ratio)
  }

  if (spec.limitPct) {
    const cap = Math.log(1 + spec.limitPct / 100) * 0.985
    ret = ret.map((v) => Math.max(-cap, Math.min(cap, v)))
  }

  const out = [0]
  for (let i = 1; i < n; i += 1) out.push(out[i - 1] + ret[i])
  const shift = out[n - 1]
  return out.map((v) => spec.close * Math.exp(v - shift))
}

/**
 * 由收盘价序列展开成完整日线：开高低收、成交量、成交额、换手率、振幅。
 *
 * 开盘跳空与日内振幅都由当日收益幅度驱动，成交量与波动正相关并带独立噪声，
 * 因此放量与波动同步出现，而不是两条互不相干的随机序列。
 *
 * @param {object} spec - 标的画像。
 * @param {number[]} closes - 收盘价序列。
 * @param {string[]} dates - 交易日历。
 * @param {number} lot - 成交量取整单位（A 股 100 股，指数为 1）。
 * @returns {object[]} 日线数组，升序。
 */
function buildBars(spec, closes, dates, lot) {
  const rng = mulberry32(seedOf(`${spec.market}:${spec.symbol ?? spec.code}:bars`))
  const dailyVol = spec.vol / Math.sqrt(252)
  const cap = spec.limitPct ? spec.limitPct / 100 : null
  const bars = []
  for (let i = 0; i < closes.length; i += 1) {
    const close = closes[i]
    const prev = i === 0 ? close / (1 + gauss(rng) * dailyVol * 0.5) : closes[i - 1]
    const ret = close / prev - 1
    let open = prev * (1 + gauss(rng) * dailyVol * 0.45 + ret * 0.35)
    const span = (Math.abs(ret) * 0.9 + dailyVol * (0.55 + 0.9 * rng())) * close
    let high = Math.max(open, close) + span * (0.25 + 0.6 * rng())
    let low = Math.min(open, close) - span * (0.25 + 0.6 * rng())
    if (cap) {
      const hi = prev * (1 + cap)
      const lo = prev * (1 - cap)
      open = Math.min(hi, Math.max(lo, open))
      high = Math.min(hi, high)
      low = Math.max(lo, low)
    }
    high = Math.max(high, open, close)
    low = Math.min(low, open, close)

    const shares = spec.floatShares ?? spec.totalShares ?? 1e9
    const heat = 1 + 2.4 * Math.min(2.5, Math.abs(ret) / dailyVol) * 0.28
    const volume = Math.round((spec.turnoverBase ?? 0.004) * shares * (0.55 + 0.9 * rng()) * heat / lot) * lot
    const vwap = (high + low + 2 * close) / 4
    bars.push({
      date: dates[i],
      open: r(open, 2),
      high: r(high, 2),
      low: r(low, 2),
      close: r(close, 2),
      volume,
      amount: r(vwap * volume, 0),
      changePercent: r(ret * 100, 2),
      amplitude: r(((high - low) / prev) * 100, 2),
      turnoverRate: r((volume / shares) * 100, 3),
    })
  }
  return bars
}

// ---------------------------------------------------------------------------
// 由序列真实计算的统计量
// ---------------------------------------------------------------------------

/**
 * 计算一段收盘价序列的最大回撤及其发生区间。
 * @param {number[]} values - 价格或净值序列。
 * @param {string[]} dates - 与之等长的日期。
 * @returns {{maxDrawdown:number, peakDate:string, troughDate:string}} 回撤幅度为负值。
 */
function maxDrawdown(values, dates) {
  let peak = values[0]
  let peakAt = 0
  let worst = 0
  let from = 0
  let to = 0
  for (let i = 1; i < values.length; i += 1) {
    if (values[i] > peak) {
      peak = values[i]
      peakAt = i
    }
    const dd = values[i] / peak - 1
    if (dd < worst) {
      worst = dd
      from = peakAt
      to = i
    }
  }
  return { maxDrawdown: r(worst * 100, 2), peakDate: dates[from], troughDate: dates[to] }
}

/**
 * 由收盘价序列算出一组绩效与风险指标，可选相对基准的 Beta 与相关系数。
 * @param {number[]} values - 价格或净值序列。
 * @param {string[]} dates - 与之等长的日期。
 * @param {number[]|null} bench - 基准序列，长度需一致；为 null 时不计算 Beta。
 * @param {number} rf - 无风险年化利率。
 * @returns {object} 指标集合，收益率与波动率均为百分数。
 */
function riskStats(values, dates, bench, rf = 0.018) {
  const rets = []
  for (let i = 1; i < values.length; i += 1) rets.push(values[i] / values[i - 1] - 1)
  const n = rets.length
  const mean = rets.reduce((a, b) => a + b, 0) / n
  const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)
  const vol = Math.sqrt(variance * 252)
  const downside = Math.sqrt(rets.filter((x) => x < 0).reduce((a, b) => a + b * b, 0) / n * 252)
  const totalYears = n / 252
  const annual = (values[n] / values[0]) ** (1 / totalYears) - 1
  const dd = maxDrawdown(values, dates)
  const sorted = [...rets].sort((a, b) => a - b)

  const window = (days) => {
    const from = Math.max(0, values.length - 1 - days)
    return r((values[values.length - 1] / values[from] - 1) * 100, 2)
  }

  let beta = null
  let corr = null
  if (bench) {
    const br = []
    for (let i = 1; i < bench.length; i += 1) br.push(bench[i] / bench[i - 1] - 1)
    const bmean = br.reduce((a, b) => a + b, 0) / n
    let cov = 0
    let bvar = 0
    for (let i = 0; i < n; i += 1) {
      cov += (rets[i] - mean) * (br[i] - bmean)
      bvar += (br[i] - bmean) ** 2
    }
    cov /= n - 1
    bvar /= n - 1
    beta = r(cov / bvar, 3)
    corr = r(cov / (Math.sqrt(variance) * Math.sqrt(bvar)), 3)
  }

  return {
    return1M: window(21),
    return3M: window(63),
    return6M: window(126),
    return1Y: window(250),
    return2Y: r((values[n] / values[0] - 1) * 100, 2),
    annualizedReturn: r(annual * 100, 2),
    annualizedVolatility: r(vol * 100, 2),
    downsideVolatility: r(downside * 100, 2),
    maxDrawdown: dd.maxDrawdown,
    maxDrawdownPeak: dd.peakDate,
    maxDrawdownTrough: dd.troughDate,
    sharpe: r((annual - rf) / vol, 3),
    sortino: r((annual - rf) / downside, 3),
    calmar: r(annual / Math.abs(dd.maxDrawdown / 100 || 1), 3),
    var95Daily: r(sorted[Math.floor(n * 0.05)] * 100, 2),
    beta,
    correlation: corr,
  }
}

/**
 * 一条价格序列的已实现年化波动率。
 * @param {number[]} values - 价格序列。
 * @returns {number} 年化波动率（小数）。
 */
function realizedVol(values) {
  const rets = []
  for (let i = 1; i < values.length; i += 1) rets.push(Math.log(values[i] / values[i - 1]))
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length
  return Math.sqrt((rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1)) * 252)
}

/**
 * 序列中某个观测值所处的历史分位。专业用法里估值高低只有相对自身历史才有意义。
 * @param {number[]} series - 历史观测。
 * @param {number} value - 当前值。
 * @returns {number} 0–100 的分位数。
 */
function percentileOf(series, value) {
  const below = series.filter((x) => x <= value).length
  return r((below / series.length) * 100, 1)
}

// ---------------------------------------------------------------------------
// 财务
// ---------------------------------------------------------------------------

/** 报告期序列：从 2023Q4 到 2026Q2，覆盖 3 个完整年度加 2 个已披露的当年季度。 */
const PERIODS = [
  '2023-12-31', '2024-03-31', '2024-06-30', '2024-09-30', '2024-12-31',
  '2025-03-31', '2025-06-30', '2025-09-30', '2025-12-31', '2026-03-31', '2026-06-30',
]

/** 报告期对应的实际披露日（近似规律：年报 3–4 月、一季报 4 月、半年报 8 月、三季报 10 月）。 */
const DISCLOSURE = {
  '2023-12-31': '2024-04-02', '2024-03-31': '2024-04-27', '2024-06-30': '2024-08-09',
  '2024-09-30': '2024-10-26', '2024-12-31': '2025-03-28', '2025-03-31': '2025-04-25',
  '2025-06-30': '2025-08-15', '2025-09-30': '2025-10-24', '2025-12-31': '2026-03-27',
  '2026-03-31': '2026-04-24', '2026-06-30': '2026-08-13',
}

/**
 * 单季营收的季节分布。白酒一季度旺季、汽车与半导体下半年走强、银行较平滑，
 * 这些形状直接决定季度环比读数，用一个平均分布会让所有标的看起来一样。
 * @param {string} symbol - 标的代码。
 * @returns {number[]} 四个季度的权重，和为 1。
 */
function seasonality(symbol) {
  switch (symbol) {
    case '600519': return [0.31, 0.22, 0.23, 0.24]
    case '002594': return [0.19, 0.24, 0.27, 0.30]
    case '688981': return [0.22, 0.24, 0.27, 0.27]
    case '600036': return [0.26, 0.25, 0.25, 0.24]
    case '300750': return [0.20, 0.24, 0.27, 0.29]
    default: return [0.24, 0.25, 0.25, 0.26]
  }
}

/**
 * 一个标的各年度的营收与归母净利。
 *
 * 以 2025 年度为基准按 `revGrowth` 前后推算；当锚点带有真实的 2026 上半年利润
 * （`np2026H1`）时，2026 年度由它按季节权重反推，而不是继续用增长率外推——
 * 半年报是已披露的事实，用它覆盖假设才能让财务与"股价下跌、估值处于历史低分位"
 * 讲同一个故事。同一份年度路径同时供财务序列与卖方预测使用，两者不会互相矛盾。
 *
 * @param {object} stock - 标的画像。
 * @returns {{rev: Record<number, number>, np: Record<number, number>}} 按年份索引的营收与净利（亿元）。
 */
function annualPath(stock) {
  const g = stock.fin.revGrowth
  const rev = {
    2022: stock.fin.rev2025 / (1 + g) ** 3,
    2023: stock.fin.rev2025 / (1 + g) ** 2,
    2024: stock.fin.rev2025 / (1 + g),
    2025: stock.fin.rev2025,
  }
  const np = {
    2022: stock.fin.np2025 / (1 + g * 1.25) ** 3,
    2023: stock.fin.np2025 / (1 + g * 1.25) ** 2,
    2024: stock.fin.np2025 / (1 + g * 1.25),
    2025: stock.fin.np2025,
  }
  const season = seasonality(stock.symbol)
  const h1Weight = season[0] + season[1]
  if (stock.fin.np2026H1) {
    np[2026] = stock.fin.np2026H1 / h1Weight
    rev[2026] = stock.fin.rev2025 * (np[2026] / stock.fin.np2025)
  } else {
    np[2026] = stock.fin.np2025 * (1 + g * 1.1)
    rev[2026] = stock.fin.rev2025 * (1 + g * 0.92)
  }
  return { rev, np }
}

/**
 * 生成一个标的的季度财务序列。
 *
 * 以锚点里的 2025 年度营收与归母净利为基准，按 `revGrowth` 反推历史年度、
 * 按季节权重拆到单季，再叠加一条确定性的小幅扰动，使同比读数不是一条直线。
 * 银行标的走另一套科目（净利息收入、净息差、不良率），因为用制造业的毛利率
 * 口径描述银行是错的，而下游任何一个估值或对比页面都会立刻暴露这一点。
 *
 * @param {object} stock - 标的画像。
 * @returns {object[]} 报告期数组，升序，金额单位为人民币亿元。
 */
function buildFinancials(stock) {
  const rng = mulberry32(seedOf(`${stock.symbol}:fin`))
  const season = seasonality(stock.symbol)
  const g = stock.fin.revGrowth
  const { rev: yearRev, np: yearNp } = annualPath(stock)

  const rows = []
  for (const period of PERIODS) {
    const year = Number(period.slice(0, 4))
    const q = Math.floor(Number(period.slice(5, 7)) / 3)
    const wobble = 1 + gauss(rng) * 0.035
    const revenue = yearRev[year] * season[q - 1] * wobble
    const netProfit = yearNp[year] * season[q - 1] * (1 + gauss(rng) * 0.06)
    const cumWeight = season.slice(0, q).reduce((a, b) => a + b, 0)
    const equity = stock.fin.equity * (1 - (2026 - year) * 0.11 - (4 - q) * 0.022)

    const row = {
      period,
      periodType: q === 4 ? 'annual' : 'quarterly',
      disclosedOn: DISCLOSURE[period],
      currency: stock.reportCurrency ?? stock.currency,
      unit: '亿元',
      revenue: r(revenue, 2),
      revenueYoY: r((wobble * (yearRev[year] / yearRev[year - 1]) - 1) * 100, 2),
      netProfitAttributable: r(netProfit, 2),
      netProfitYoY: r(((yearNp[year] / yearNp[year - 1]) * (1 + gauss(rng) * 0.05) - 1) * 100, 2),
      netProfitDeducted: r(netProfit * (0.955 + rng() * 0.03), 2),
      revenueYtd: r(yearRev[year] * cumWeight * wobble, 2),
      netProfitYtd: r(yearNp[year] * cumWeight, 2),
      eps: r((netProfit / (stock.totalShares / 1e8)) , 3),
      bps: r(equity / (stock.totalShares / 1e8), 3),
      totalEquity: r(equity, 2),
    }

    if (stock.bank) {
      const nii = revenue * 0.62
      Object.assign(row, {
        netInterestIncome: r(nii, 2),
        nonInterestIncome: r(revenue - nii, 2),
        netInterestMargin: r((stock.bank.nim + gauss(rng) * 0.0008) * 100, 3),
        nplRatio: r((stock.bank.npl + gauss(rng) * 0.00035) * 100, 3),
        provisionCoverage: r((stock.bank.provisionCoverage + gauss(rng) * 0.08) * 100, 1),
        cet1Ratio: r((stock.bank.cet1 + gauss(rng) * 0.0012) * 100, 2),
        costIncomeRatio: r((stock.bank.costIncome + gauss(rng) * 0.006) * 100, 2),
        roeAnnualized: r((netProfit * 4 / equity) * 100, 2),
        totalAssets: r(equity * 11.8, 2),
        customerLoans: r(equity * 6.4, 2),
        customerDeposits: r(equity * 8.1, 2),
        retailAum: r(stock.bank.aum * (1 - (2026 - year) * 0.09), 0),
      })
    } else {
      const grossProfit = revenue * (stock.fin.gross + gauss(rng) * 0.008)
      const rd = revenue * (stock.symbol === '688981' ? 0.108 : stock.symbol === '300750' ? 0.052 : stock.symbol === '002594' ? 0.062 : 0.012)
      const ocf = netProfit * (1.05 + rng() * 0.4)
      const capex = revenue * (stock.symbol === '688981' ? 0.42 : stock.symbol === '300750' ? 0.11 : 0.05)
      const assets = equity * (stock.symbol === '002594' ? 3.3 : stock.symbol === '300750' ? 2.6 : 1.35)
      Object.assign(row, {
        grossProfit: r(grossProfit, 2),
        grossMargin: r((grossProfit / revenue) * 100, 2),
        netMargin: r((netProfit / revenue) * 100, 2),
        operatingProfit: r(netProfit * 1.32, 2),
        sellingExpense: r(revenue * 0.038, 2),
        adminExpense: r(revenue * 0.041, 2),
        rdExpense: r(rd, 2),
        rdRatio: r((rd / revenue) * 100, 2),
        operatingCashFlow: r(ocf, 2),
        capex: r(capex, 2),
        freeCashFlow: r(ocf - capex, 2),
        totalAssets: r(assets, 2),
        totalLiabilities: r(assets - equity, 2),
        debtToAsset: r(((assets - equity) / assets) * 100, 2),
        interestBearingDebt: r(assets * (stock.symbol === '600519' ? 0.001 : 0.14), 2),
        cashAndEquivalents: r(assets * 0.22, 2),
        inventory: r(revenue * (stock.symbol === '600519' ? 0.62 : 0.18), 2),
        accountsReceivable: r(revenue * (stock.symbol === '600519' ? 0.002 : 0.21), 2),
        roeDiluted: r((netProfit * 4 / equity) * 100, 2),
        roic: r((netProfit * 4 / (equity + assets * 0.14)) * 100, 2),
        currentRatio: r(1.15 + rng() * 1.4, 2),
      })
    }
    rows.push(row)
  }
  return rows
}

/**
 * 滚动 12 个月归母净利，用于 PE-TTM。
 * @param {object[]} rows - 财务序列。
 * @param {string} asOf - 观察日；只取该日之前已披露的报告期。
 * @returns {number} TTM 归母净利（亿元）。
 */
function ttmProfit(rows, asOf) {
  const visible = rows.filter((row) => row.disclosedOn <= asOf)
  const last4 = visible.slice(-4)
  if (last4.length < 4) return rows.slice(0, 4).reduce((a, b) => a + b.netProfitAttributable, 0)
  return last4.reduce((a, b) => a + b.netProfitAttributable, 0)
}

// ---------------------------------------------------------------------------
// 事件流
// ---------------------------------------------------------------------------

/** 每个标的的关键事件。真实事件优先，其余为合成的定期披露与公司行动。 */
const EVENTS = {
  '600519': [
    ['2026-08-13', '业绩', '贵州茅台披露 2026 年半年报：上半年归母净利润 445 亿元，日均净赚 2.45 亿元', 'positive', 'high'],
    ['2026-06-25', '分红', '2025 年度权益分派实施：每 10 股派现 385.20 元（含税），今日除权除息', 'neutral', 'high'],
    ['2026-05-08', '经营', '公司回应 i茅台 渠道调整：直销占比提升至 46%，控量稳价策略延续', 'neutral', 'medium'],
    ['2026-03-27', '业绩', '2025 年报：营业总收入 1902 亿元，同比增长 7.2%', 'positive', 'high'],
    ['2026-02-11', '行业', '春节动销数据低于预期，飞天茅台批价回落至 2100 元区间', 'negative', 'high'],
  ],
  '300750': [
    ['2026-08-13', '业绩', '宁德时代半年报：储能出货同比翻倍，毛利率环比改善 1.4 个百分点', 'positive', 'high'],
    ['2026-07-02', '产品', '第三代神行超充电池量产下线，配套车型覆盖 30 款以上', 'positive', 'high'],
    ['2026-05-19', '股东', '境外战略投资者完成配售，H 股流通比例提升', 'neutral', 'medium'],
    ['2026-04-24', '业绩', '2026 年一季报：营收同比增长 9.4%，海外收入占比 34%', 'positive', 'high'],
    ['2026-03-12', '行业', '碳酸锂价格企稳，行业排产环比回升', 'positive', 'medium'],
  ],
  '600036': [
    ['2026-08-11', '经营', '招商银行零售客户管理总资产（AUM）突破 18 万亿元', 'positive', 'high'],
    ['2026-08-13', '业绩', '2026 年半年报：净息差 1.85%，不良率 0.92%，拨备覆盖率 390%', 'neutral', 'high'],
    ['2026-07-08', '分红', '2025 年度分红实施：每股派现 2.011 元（含税），股息率约 5.2%', 'positive', 'high'],
    ['2026-05-15', '监管', '存款利率再度下调，行业息差压力延续', 'negative', 'medium'],
    ['2026-03-27', '业绩', '2025 年报：营业收入 3412 亿元，归母净利润 1500 亿元', 'neutral', 'high'],
  ],
  '688981': [
    ['2026-08-13', '业绩', '中芯国际 Q2 毛利率由 20.1% 升至 25.3%，单季营收首次突破 30 亿美元', 'positive', 'high'],
    ['2026-06-18', '产能', '京津新厂 12 英寸产线通线，2026 年资本开支指引维持不变', 'neutral', 'high'],
    ['2026-05-06', '行业', '成熟制程价格竞争加剧，同业下调全年出货指引', 'negative', 'high'],
    ['2026-04-24', '业绩', '一季报：产能利用率 92.4%，环比提升 3.1 个百分点', 'positive', 'medium'],
    ['2026-01-20', '监管', '出口管制清单更新，设备采购周期延长', 'negative', 'high'],
  ],
  '002594': [
    ['2026-08-13', '业绩', '比亚迪半年报：海外销量占比升至 28%，单车盈利环比回升', 'positive', 'high'],
    ['2026-07-03', '经营', '6 月新能源汽车销量公布，出口连续第五个月创新高', 'positive', 'high'],
    ['2026-05-28', '行业', '行业价格战再起，多家车企跟进降价', 'negative', 'high'],
    ['2026-04-24', '业绩', '一季报：营收同比增长 10.8%，毛利率 19.1%', 'neutral', 'medium'],
    ['2026-02-05', '产品', '第五代 DM 技术平台发布，亏电油耗进入 2L 时代', 'positive', 'high'],
  ],
  '00700': [
    ['2026-08-13', '业绩', '腾讯 Q2 营收同比增长 11%，AI 基础设施投入推高资本开支，自由现金流转负', 'negative', 'high'],
    ['2026-08-05', '资金', '南向资金单周净买入 68.3 亿港元，为近三个月最高', 'positive', 'medium'],
    ['2026-06-11', '产品', '微信生态接入自研大模型，广告加载率小幅提升', 'positive', 'high'],
    ['2026-05-14', '回购', '年内累计回购金额超 400 亿港元', 'positive', 'medium'],
    ['2026-03-19', '业绩', '2025 年报：非国际准则归母净利润 2265 亿元人民币', 'positive', 'high'],
  ],
}

// ---------------------------------------------------------------------------
// 生成
// ---------------------------------------------------------------------------

rmSync(OUT, { recursive: true, force: true })
for (const sub of ['bars', 'index-bars', 'fund-nav']) mkdirSync(join(OUT, sub), { recursive: true })

/**
 * 写出一个 JSON 文件，统一带上数据集元信息与合成声明。
 * @param {string} rel - 相对 `data/` 的路径。
 * @param {object} payload - 文件内容。
 */
function emit(rel, payload) {
  const body = {
    $schema: 'https://deepseek-harness.local/chico-mock/v1',
    datasetVersion: DATASET_VERSION,
    synthetic: true,
    anchorDate: ANCHOR_DATE,
    ...payload,
  }
  writeFileSync(join(OUT, rel), `${JSON.stringify(body, null, 2)}\n`)
}

// --- 指数 ---------------------------------------------------------------

/** @type {Record<string, {dates:string[], closes:number[], shocks:number[]}>} */
const indexSeries = {}
for (const idx of INDEXES) {
  const dates = idx.market === 'HKEX' ? CAL_HK : CAL_CN
  const shocks = factorSeries(`index:${idx.code}`, SESSIONS)
  const closes = closeSeries({ ...idx, limitPct: null }, shocks, dates)
  indexSeries[idx.code] = { dates, closes, shocks }
  const bars = buildBars({ ...idx, symbol: idx.code, floatShares: 1e12, turnoverBase: 0.0009 }, closes, dates, 1)
  emit(`index-bars/${idx.code}.json`, {
    index: { code: idx.code, market: idx.market, name: idx.name, currency: idx.currency },
    adjustment: 'none',
    bars: bars.map(({ turnoverRate, ...rest }) => rest),
  })
}

// --- 个股 ---------------------------------------------------------------

/** 除权日：年度分红通常在次年 6–7 月实施，两个历史除权日足以让复权口径可被验证。 */
const EX_DIV = {
  '600519': [{ date: '2025-06-26', ratio: 0.0245, dps: 34.98 }, { date: '2026-06-25', ratio: 0.0281, dps: 38.52 }],
  '300750': [{ date: '2025-06-18', ratio: 0.0132, dps: 4.85 }, { date: '2026-06-17', ratio: 0.0142, dps: 5.60 }],
  '600036': [{ date: '2025-07-09', ratio: 0.0498, dps: 1.972 }, { date: '2026-07-08', ratio: 0.0516, dps: 2.011 }],
  '002594': [{ date: '2025-06-20', ratio: 0.0121, dps: 1.21 }, { date: '2026-06-19', ratio: 0.0150, dps: 1.35 }],
  '688981': [],
  '00700': [{ date: '2025-05-22', ratio: 0.0082, dps: 4.20 }, { date: '2026-05-21', ratio: 0.0094, dps: 4.50 }],
}

const instruments = []
const quotes = []
const valuations = []
const consensus = []
const flows = []
const actions = []
const riskRows = []
const newsRows = []

for (const stock of STOCKS) {
  const dates = stock.market === 'HKEX' ? CAL_HK : CAL_CN
  const bench = indexSeries[stock.benchmark]
  const idio = factorSeries(`${stock.market}:${stock.symbol}`, SESSIONS)
  const spec = { ...stock, exDividends: EX_DIV[stock.symbol] ?? [] }
  const benchVol = realizedVol(bench.closes)

  // 52 周区间校准会改变路径的已实现波动，而 Beta 依赖的是已实现波动而非设定值。
  // 用上一轮量出的实际波动反解下一轮的相关系数，三轮后实测 Beta 收敛到目标附近。
  let volEstimate = stock.vol
  let shocks = []
  let closes = []
  for (let pass = 0; pass < 3; pass += 1) {
    shocks = correlatedShocks(bench.shocks, idio, stock.betaTarget, volEstimate, benchVol)
    closes = closeSeries(spec, shocks, dates)
    volEstimate = realizedVol(closes)
  }
  const bars = buildBars(spec, closes, dates, stock.market === 'HKEX' ? 100 : 100)

  // 后复权因子：以今天为基准 1，向历史回溯时每过一个除权日乘上 (1 - 除权比例)，
  // 把当日的价格跳空抹平。`后复权价 = 收盘价 × 因子`，因此复权序列的涨幅就是含息总收益。
  let factor = 1
  const adjFactors = new Array(dates.length).fill(1)
  for (let i = dates.length - 1; i >= 0; i -= 1) {
    adjFactors[i] = r(factor, 6)
    const ex = spec.exDividends.find((e) => e.date === dates[i])
    if (ex) factor *= 1 - ex.ratio
  }
  const adjCloses = closes.map((c, i) => c * adjFactors[i])

  emit(`bars/${stock.market}-${stock.symbol}.json`, {
    instrument: { market: stock.market, symbol: stock.symbol },
    name: stock.name,
    currency: stock.currency,
    adjustment: 'none',
    adjustmentFactors: dates.map((d, i) => ({ date: d, factor: adjFactors[i] })).filter((x, i) => i === 0 || x.factor !== adjFactors[i - 1]),
    bars,
  })

  const last = bars[bars.length - 1]
  const prev = bars[bars.length - 2]
  instruments.push({
    instrument: { market: stock.market, symbol: stock.symbol },
    name: stock.name,
    enName: stock.enName,
    type: 'stock',
    currency: stock.currency,
    reportCurrency: stock.reportCurrency ?? stock.currency,
    board: stock.board,
    listedOn: stock.listedOn,
    priceLimitPercent: stock.limitPct,
    lotSize: stock.market === 'HKEX' ? 100 : 100,
    industry: stock.industry,
    tags: stock.tags,
    totalShares: stock.totalShares,
    floatShares: stock.floatShares,
    connect: stock.connect,
    status: 'listed',
  })

  const fin = buildFinancials(stock)
  const annual = annualPath(stock)
  const ttm = ttmProfit(fin, ANCHOR_DATE)
  const marketCap = (last.close * stock.totalShares) / 1e8
  const floatCap = (last.close * stock.floatShares) / 1e8
  const equity = fin[fin.length - 1].totalEquity
  const dps = (EX_DIV[stock.symbol] ?? []).slice(-1)[0]?.dps ?? 0

  quotes.push({
    instrument: { market: stock.market, symbol: stock.symbol },
    name: stock.name,
    currency: stock.currency,
    last: last.close,
    previousClose: prev.close,
    open: last.open,
    high: last.high,
    low: last.low,
    changePercent: last.changePercent,
    volume: last.volume,
    amount: last.amount,
    turnoverRate: last.turnoverRate,
    amplitude: last.amplitude,
    limitUp: stock.limitPct ? r(prev.close * (1 + stock.limitPct / 100), 2) : null,
    limitDown: stock.limitPct ? r(prev.close * (1 - stock.limitPct / 100), 2) : null,
    week52High: Math.max(...bars.slice(-250).map((b) => b.high)),
    week52Low: Math.min(...bars.slice(-250).map((b) => b.low)),
    marketCap: r(marketCap, 2),
    floatMarketCap: r(floatCap, 2),
    asOf: `${ANCHOR_DATE}T15:00:00+08:00`,
    session: 'closed',
  })

  // 估值分位由价格序列与滚动 TTM 真实计算，而不是给一个孤立的当前值。
  const peSeries = bars.map((bar) => (bar.close * stock.totalShares) / 1e8 / ttmProfit(fin, bar.date))
  const pbSeries = bars.map((bar) => (bar.close * stock.totalShares) / 1e8 / equity)
  const pe = marketCap / ttm
  const pb = marketCap / equity
  valuations.push({
    instrument: { market: stock.market, symbol: stock.symbol },
    asOf: ANCHOR_DATE,
    peTtm: r(pe, 2),
    peStatic: r(marketCap / stock.fin.np2025, 2),
    pb: r(pb, 3),
    psTtm: r(marketCap / stock.fin.rev2025, 2),
    pcfTtm: r(marketCap / (stock.fin.np2025 * 1.25), 2),
    evToEbitda: stock.bank ? null : r((marketCap + stock.fin.equity * 0.14) / (stock.fin.np2025 * 1.45), 2),
    dividendYieldTtm: r((dps / last.close) * 100, 3),
    dividendPayoutRatio: r((dps * (stock.totalShares / 1e8)) / stock.fin.np2025 * 100, 2),
    marketCap: r(marketCap, 2),
    floatMarketCap: r(floatCap, 2),
    pePercentile2Y: percentileOf(peSeries, pe),
    pbPercentile2Y: percentileOf(pbSeries, pb),
    peRangeLow2Y: r(Math.min(...peSeries), 2),
    peRangeHigh2Y: r(Math.max(...peSeries), 2),
    industryMedianPe: r(pe * (0.82 + (seedOf(stock.symbol) % 40) / 100), 2),
    industryName: stock.industry.l2,
  })

  const c = stock.consensus
  consensus.push({
    instrument: { market: stock.market, symbol: stock.symbol },
    asOf: ANCHOR_DATE,
    coverageCount: c.coverage,
    rating: { buy: c.buy, hold: c.hold, sell: c.sell },
    consensusRating: c.buy / c.coverage > 0.7 ? '买入' : c.sell > 2 ? '中性' : '增持',
    targetPrice: { mean: c.targetMean, high: c.targetHigh, low: c.targetLow, median: r((c.targetMean + c.targetHigh) / 2 * 0.96, 2) },
    upsideToMean: r((c.targetMean / last.close - 1) * 100, 2),
    // 预测从本年度的实际路径起步，而不是从上一完整年度外推：2026 半年报已经披露，
    // 一份把它无视掉的卖方预测在页面上会和财务报表直接打架。
    forecasts: [2026, 2027, 2028].map((year, i) => {
      const np = annual.np[2026] * (1 + stock.fin.revGrowth * 1.15) ** i
      return {
        fiscalYear: year,
        revenue: r(annual.rev[2026] * (1 + stock.fin.revGrowth) ** i, 2),
        netProfit: r(np, 2),
        eps: r(np / (stock.totalShares / 1e8), 3),
        impliedPe: r(marketCap / np, 2),
        analystCount: Math.max(6, c.coverage - i * 7),
      }
    }),
    revision3M: { upgrades: (seedOf(stock.symbol) % 7), downgrades: (seedOf(stock.symbol + 'd') % 5), epsRevisionPercent: r(((seedOf(stock.symbol) % 21) - 10) / 2, 2) },
  })

  const frng = mulberry32(seedOf(`${stock.symbol}:flow`))
  const isHk = stock.market === 'HKEX'
  flows.push({
    instrument: { market: stock.market, symbol: stock.symbol },
    asOf: ANCHOR_DATE,
    [isHk ? 'southboundHoldingPercent' : 'northboundHoldingPercent']: r(2 + frng() * 8, 3),
    [isHk ? 'southboundChange30D' : 'northboundChange30D']: r((frng() - 0.45) * 1.6, 3),
    mainCapitalNet5D: r((frng() - 0.5) * floatCap * 0.02, 2),
    orderFlow: {
      extraLarge: r((frng() - 0.5) * floatCap * 0.012, 2),
      large: r((frng() - 0.5) * floatCap * 0.009, 2),
      medium: r((frng() - 0.5) * floatCap * 0.006, 2),
      small: r((frng() - 0.5) * floatCap * 0.005, 2),
    },
    marginBalance: isHk ? null : r(floatCap * (0.012 + frng() * 0.03), 2),
    marginBalanceToFloatCap: isHk ? null : r((0.012 + frng() * 0.03) * 100, 2),
    shortBalance: isHk ? r(floatCap * 0.004, 2) : null,
    shareholderCount: Math.round(60000 + frng() * 420000),
    shareholderCountChangeQoQ: r((frng() - 0.5) * 14, 2),
    institutionalHoldingPercent: r(28 + frng() * 40, 2),
    topShareholders: Array.from({ length: 5 }, (_, i) => ({
      rank: i + 1,
      name: ['香港中央结算有限公司', '中国证券金融股份有限公司', '全国社保基金一一八组合', '中央汇金资产管理有限责任公司', '国家集成电路产业投资基金'][i],
      percent: r(14 / (i + 1.4) + frng(), 3),
      changeShares: Math.round((frng() - 0.5) * 2.4e7),
    })),
    lockupExpiries: [{ date: '2026-11-13', shares: Math.round(stock.totalShares * 0.014), percentOfFloat: r(1.4 + frng(), 2), type: '首发原股东限售股' }],
  })

  for (const ex of EX_DIV[stock.symbol] ?? []) {
    actions.push({
      instrument: { market: stock.market, symbol: stock.symbol },
      type: 'dividend',
      fiscalYear: Number(ex.date.slice(0, 4)) - 1,
      dividendPerShare: ex.dps,
      currency: stock.currency,
      recordDate: new Date(Date.parse(`${ex.date}T00:00:00Z`) - DAY_MS).toISOString().slice(0, 10),
      exDate: ex.date,
      payDate: new Date(Date.parse(`${ex.date}T00:00:00Z`) + 6 * DAY_MS).toISOString().slice(0, 10),
      bonusShareRatio: 0,
      transferShareRatio: stock.symbol === '002594' && ex.date.startsWith('2025') ? 8 : 0,
    })
  }
  if (stock.symbol === '00700') {
    actions.push({
      instrument: { market: 'HKEX', symbol: '00700' }, type: 'buyback', announcedOn: '2026-01-08',
      amount: 400.0, currency: 'HKD', unit: '亿元', completedPercent: 62.4, note: '年度回购计划',
    })
  }

  // 两套口径都给：价格收益是页面上看到的涨跌，含息总收益才是持有人真正拿到的。
  // 高股息标的两者相差可达每年数个百分点，只报一个会让排序和归因都失真。
  const priceStats = riskStats(closes, dates, bench.closes)
  const totalStats = riskStats(adjCloses, dates, bench.closes)
  riskRows.push({
    instrument: { market: stock.market, symbol: stock.symbol },
    benchmark: stock.benchmark,
    asOf: ANCHOR_DATE,
    ...priceStats,
    totalReturn: {
      return1Y: totalStats.return1Y,
      return2Y: totalStats.return2Y,
      annualizedReturn: totalStats.annualizedReturn,
      maxDrawdown: totalStats.maxDrawdown,
      sharpe: totalStats.sharpe,
    },
    dividendContribution2Y: r(totalStats.return2Y - priceStats.return2Y, 2),
    excessReturn2Y: r(totalStats.return2Y - riskStats(bench.closes, dates, null).return2Y, 2),
  })

  for (const [date, category, headline, sentiment, importance] of EVENTS[stock.symbol] ?? []) {
    newsRows.push({ instrument: { market: stock.market, symbol: stock.symbol }, date, category, headline, sentiment, importance })
  }
  for (const row of fin) {
    newsRows.push({
      instrument: { market: stock.market, symbol: stock.symbol },
      date: row.disclosedOn,
      category: '定期报告',
      headline: `${row.period.slice(0, 4)} 年${row.period.endsWith('12-31') ? '年度报告' : row.period.endsWith('06-30') ? '半年度报告' : '季度报告'}披露`,
      sentiment: 'neutral',
      importance: 'medium',
    })
  }

  emit(`fundamentals-${stock.market}-${stock.symbol}.json`, {
    instrument: { market: stock.market, symbol: stock.symbol },
    name: stock.name,
    reportCurrency: stock.reportCurrency ?? stock.currency,
    unit: '亿元',
    statementModel: stock.bank ? 'bank' : 'general',
    periods: fin,
  })
}

// --- 基金 ---------------------------------------------------------------

/** 基金类别的中文标签，`instruments.json` 与 `funds.json` 共用。 */
const FUND_KIND_LABEL = {
  etf: '交易型开放式指数基金',
  lof: '上市开放式基金',
  open: '开放式混合型基金',
  money: '货币市场基金',
}

const fundProfiles = []
const fundHoldings = []
const fundRisk = []

for (const fund of FUNDS) {
  const dates = CAL_CN
  const trackedIndex = fund.trackIndex === '000016' ? '000300' : fund.trackIndex === '000688' ? '399006' : '000300'
  const bench = indexSeries[trackedIndex]
  const idio = factorSeries(`fund:${fund.code}`, SESSIONS)

  let navs
  if (fund.kind === 'money') {
    navs = dates.map(() => 1)
  } else {
    // 指数基金几乎完全由跟踪指数解释；主动基金留出选股带来的独立部分。
    const rho = fund.kind === 'open' ? 0.80 : 0.97
    const benchVol = INDEXES.find((i) => i.code === trackedIndex).vol
    const shocks = correlatedShocks(bench.shocks, idio, (rho * fund.vol) / benchVol, fund.vol, benchVol)
    navs = closeSeries({ ...fund, close: fund.nav, limitPct: null, low52: null, high52: null }, shocks, dates)
  }

  const rng = mulberry32(seedOf(`fund:${fund.code}:nav`))
  const navRows = dates.map((date, i) => {
    if (fund.kind === 'money') {
      const y = fund.yield7d * (0.86 + 0.3 * rng())
      return {
        date,
        nav: 1,
        yield7dAnnualized: r(y * 100, 4),
        incomePerTenThousand: r((y / 365) * 10000, 4),
      }
    }
    const nav = navs[i]
    const row = {
      date,
      nav: r(nav, 4),
      cumulativeNav: r(nav * (fund.cumNav / fund.nav), 4),
      dailyReturn: r(i === 0 ? 0 : (navs[i] / navs[i - 1] - 1) * 100, 3),
    }
    if (fund.kind === 'etf' || fund.kind === 'lof') {
      const premium = (rng() - 0.5) * (fund.kind === 'etf' ? 0.006 : 0.02)
      row.marketPrice = r(nav * (1 + premium), 3)
      row.premiumDiscount = r(premium * 100, 3)
      row.iopv = r(nav * (1 + (rng() - 0.5) * 0.001), 4)
    }
    return row
  })
  if (fund.kind === 'etf' && fund.marketPrice) {
    const tail = navRows[navRows.length - 1]
    tail.marketPrice = fund.marketPrice
    tail.premiumDiscount = r((fund.marketPrice / tail.nav - 1) * 100, 3)
  }

  emit(`fund-nav/${fund.code}.json`, {
    fund: { code: fund.code, market: fund.market, name: fund.name, kind: fund.kind, currency: fund.currency },
    navs: navRows,
  })

  // 货币基金没有净值波动，收益只能由七日年化按持有天数折算，不能套用价格序列口径。
  const stats = fund.kind === 'money'
    ? {
        return1M: r((fund.yield7d * 21) / 252 * 100, 3),
        return3M: r((fund.yield7d * 63) / 252 * 100, 3),
        return6M: r((fund.yield7d * 126) / 252 * 100, 3),
        return1Y: r(fund.yield7d * 100, 3),
        return2Y: r(fund.return2Y * 100, 3),
        annualizedReturn: r(fund.yield7d * 100, 3),
        annualizedVolatility: 0.02,
        maxDrawdown: 0,
        sharpe: null,
        sortino: null,
        beta: null,
        correlation: null,
      }
    : riskStats(navs, dates, bench.closes)
  fundRisk.push({ code: fund.code, benchmark: fund.benchmark, asOf: ANCHOR_DATE, ...stats })

  const prng = mulberry32(seedOf(`fund:${fund.code}:rank`))
  const rankOf = (ret) => {
    const pos = Math.max(1, Math.round(fund.peerCount * Math.min(0.97, Math.max(0.02, 0.5 - ret / 60 + (prng() - 0.5) * 0.12))))
    return `${pos}/${fund.peerCount}`
  }

  fundProfiles.push({
    code: fund.code,
    market: fund.market,
    name: fund.name,
    shortName: fund.shortName,
    kind: fund.kind,
    kindLabel: FUND_KIND_LABEL[fund.kind],
    company: fund.company,
    inceptionDate: fund.inceptionDate,
    currency: fund.currency,
    riskLevel: fund.riskLevel,
    listed: fund.market !== null,
    trackIndex: fund.trackIndex,
    trackIndexName: fund.trackIndexName,
    benchmark: fund.benchmark,
    trackingErrorAnnualized: fund.trackingError,
    fees: fund.fees,
    nav: fund.kind === 'money' ? 1 : r(navs[navs.length - 1], 4),
    cumulativeNav: fund.cumNav,
    shares: fund.shares,
    netAssets: r((fund.kind === 'money' ? 1 : navs[navs.length - 1]) * fund.shares / 1e8, 2),
    netAssetsUnit: '亿元',
    managers: fund.managers,
    peerRanking: fund.kind === 'money'
      ? null
      : { '1M': rankOf(stats.return1M), '3M': rankOf(stats.return3M), '6M': rankOf(stats.return6M), '1Y': rankOf(stats.return1Y), '2Y': rankOf(stats.return2Y) },
    scaleHistory: ['2025-09-30', '2025-12-31', '2026-03-31', '2026-06-30'].map((period, i) => ({
      period,
      netAssets: r((fund.shares * fund.nav / 1e8) * (1.18 - i * 0.05), 2),
      shares: Math.round(fund.shares * (1.1 - i * 0.03)),
    })),
    dataSource: fund.source,
  })

  const holdings = FUND_HOLDINGS[fund.code]
  if (holdings) {
    const totalWeight = holdings.reduce((a, [, , w]) => a + w, 0)
    fundHoldings.push({
      code: fund.code,
      period: '2026-06-30',
      disclosedOn: '2026-08-13',
      topTenWeight: r(totalWeight * 100, 2),
      turnoverRateAnnual: r(fund.kind === 'open' ? 42 : 18, 1),
      holdings: holdings.map(([symbol, name, weight], i) => ({
        rank: i + 1,
        symbol,
        name,
        weight: r(weight * 100, 3),
        marketValue: r(weight * fund.shares * fund.nav / 1e8, 2),
        marketValueUnit: '亿元',
      })),
      assetAllocation: fund.kind === 'open'
        ? { equity: 91.2, bond: 0.0, cash: 7.4, other: 1.4 }
        : { equity: 99.1, bond: 0.0, cash: 0.8, other: 0.1 },
      industryAllocation: fund.code === '161725'
        ? [{ industry: '食品饮料', weight: 98.4 }, { industry: '现金及其他', weight: 1.6 }]
        : fund.code === '588000'
          ? [{ industry: '电子', weight: 52.8 }, { industry: '计算机', weight: 18.4 }, { industry: '医药生物', weight: 12.1 }, { industry: '电力设备', weight: 9.3 }, { industry: '机械设备', weight: 6.2 }, { industry: '现金及其他', weight: 1.2 }]
          : [{ industry: '食品饮料', weight: 34.2 }, { industry: '银行', weight: 18.7 }, { industry: '传媒', weight: 15.1 }, { industry: '非银金融', weight: 11.4 }, { industry: '医药生物', weight: 8.3 }, { industry: '现金及其他', weight: 12.3 }],
    })
  }
}

// --- 汇总文件 -----------------------------------------------------------

for (const fund of FUNDS) {
  instruments.push({
    instrument: fund.market ? { market: fund.market, symbol: fund.code } : { market: null, symbol: fund.code },
    name: fund.name,
    enName: null,
    type: fund.kind === 'money' ? 'money-fund' : fund.kind === 'open' ? 'open-fund' : fund.kind,
    currency: fund.currency,
    board: fund.market ? '基金' : '场外',
    listedOn: fund.inceptionDate,
    priceLimitPercent: fund.market ? 10 : null,
    lotSize: fund.market ? 100 : null,
    industry: null,
    tags: [FUND_KIND_LABEL[fund.kind], fund.company],
    totalShares: fund.shares,
    floatShares: fund.shares,
    connect: null,
    status: 'listed',
  })
}

emit('instruments.json', { count: instruments.length, instruments })
emit('quotes.json', { count: quotes.length, quotes })
emit('valuation.json', { valuations })
emit('consensus.json', { consensus })
emit('flows.json', { flows })
emit('corporate-actions.json', { actions })
emit('risk-metrics.json', { stocks: riskRows, funds: fundRisk })
emit('news.json', { count: newsRows.length, events: newsRows.sort((a, b) => (a.date < b.date ? 1 : -1)) })
emit('funds.json', { count: fundProfiles.length, funds: fundProfiles })
emit('fund-holdings.json', { holdings: fundHoldings })
emit('indexes.json', {
  indexes: INDEXES.map((idx) => ({
    code: idx.code,
    market: idx.market,
    name: idx.name,
    currency: idx.currency,
    close: r(indexSeries[idx.code].closes[SESSIONS - 1], 2),
    asOf: ANCHOR_DATE,
    dataSource: idx.source,
  })),
})
emit('sources.json', {
  note: '锚点来源与观测日期。生成的所有序列均为合成数据，仅量级与下列真实观测对齐。',
  stocks: STOCKS.map((s) => ({ symbol: s.symbol, name: s.name, source: s.source })),
  funds: FUNDS.map((f) => ({ code: f.code, name: f.name, source: f.source })),
  indexes: INDEXES.map((i) => ({ code: i.code, name: i.name, source: i.source })),
})

const files = [
  'instruments.json', 'quotes.json', 'valuation.json', 'consensus.json', 'flows.json',
  'corporate-actions.json', 'risk-metrics.json', 'news.json', 'funds.json', 'fund-holdings.json',
  'indexes.json', 'sources.json',
]
console.log(`生成完成：${STOCKS.length} 只个股 × ${SESSIONS} 根日线，${FUNDS.length} 只基金净值序列，${INDEXES.length} 条指数序列`)
console.log(`汇总文件：${files.length} 个，序列文件：${STOCKS.length + FUNDS.length + INDEXES.length} 个`)
