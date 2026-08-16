/**
 * 数据集不变量校验。
 *
 * 运行：`node mock-data/verify.mjs`（无依赖）。任何一条不变量不成立即以非零码退出，
 * 因此可以直接挂进 CI 或 pre-commit。
 *
 * 校验的是 README「数据满足的不变量」一节列出的性质——这些性质是数据可以当作
 * 真实数据替身的理由。换掉生成方式、换掉锚点、接入真实数据源之后，这个脚本仍然
 * 应该通过；通不过说明新数据在某个下游代码会依赖的地方与旧数据行为不同。
 */

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const DATA = join(dirname(fileURLToPath(import.meta.url)), 'data')

/**
 * 读取并解析一个数据文件。
 * @param {string} rel - 相对 `data/` 的路径。
 * @returns {any} 解析后的内容。
 */
const load = (rel) => JSON.parse(readFileSync(join(DATA, rel), 'utf8'))

const failures = []

/**
 * 断言一条不变量。
 * @param {boolean} ok - 是否成立。
 * @param {string} message - 不成立时报告的内容。
 */
function check(ok, message) {
  if (!ok) failures.push(message)
}

const instruments = load('instruments.json')
const quotes = load('quotes.json')
const valuations = load('valuation.json')
const risk = load('risk-metrics.json')
const funds = load('funds.json')

const metaOf = (symbol) => instruments.instruments.find((i) => i.instrument.symbol === symbol)

console.log('日线序列')
for (const quote of quotes.quotes) {
  const { market, symbol } = quote.instrument
  const file = load(`bars/${market}-${symbol}.json`)
  const bars = file.bars
  const meta = metaOf(symbol)

  check(bars.length === 500, `${symbol}: 日线根数为 ${bars.length}，应为 500`)
  check(bars.at(-1).close === quote.last, `${symbol}: 快照现价与末根收盘不一致`)
  check(bars.at(-2).close === quote.previousClose, `${symbol}: 快照前收与倒数第二根收盘不一致`)

  let limitBreaks = 0
  let ohlcBreaks = 0
  let dateBreaks = 0
  for (let i = 1; i < bars.length; i += 1) {
    const bar = bars[i]
    const move = Math.abs(bar.close / bars[i - 1].close - 1) * 100
    if (meta.priceLimitPercent && move > meta.priceLimitPercent + 0.01) limitBreaks += 1
    if (bar.low > Math.min(bar.open, bar.close) + 1e-9) ohlcBreaks += 1
    if (bar.high < Math.max(bar.open, bar.close) - 1e-9) ohlcBreaks += 1
    if (bar.volume <= 0 || bar.amount <= 0) ohlcBreaks += 1
    if (bar.date <= bars[i - 1].date) dateBreaks += 1
  }
  check(limitBreaks === 0, `${symbol}: ${limitBreaks} 个交易日突破 ±${meta.priceLimitPercent}% 涨跌停`)
  check(ohlcBreaks === 0, `${symbol}: ${ohlcBreaks} 个交易日的开高低收或量额不自洽`)
  check(dateBreaks === 0, `${symbol}: ${dateBreaks} 处日期非严格升序`)

  const high52 = Math.max(...bars.slice(-250).map((b) => b.high))
  const low52 = Math.min(...bars.slice(-250).map((b) => b.low))
  check(Math.abs(high52 - quote.week52High) < 1e-6, `${symbol}: 快照 52 周高与日线不符`)
  check(Math.abs(low52 - quote.week52Low) < 1e-6, `${symbol}: 快照 52 周低与日线不符`)

  const factors = file.adjustmentFactors
  check(factors.at(-1).factor <= 1 + 1e-9, `${symbol}: 复权因子未以锚定日为基准 1`)
  console.log(`  ${symbol} ${quote.name}  ${bars[0].date}..${bars.at(-1).date}  末值 ${bars.at(-1).close}`)
}

console.log('披露日守恒')
for (const quote of quotes.quotes) {
  const { market, symbol } = quote.instrument
  const fundamentals = load(`fundamentals-${market}-${symbol}.json`)
  for (const period of fundamentals.periods) {
    check(period.disclosedOn > period.period, `${symbol} ${period.period}: 披露日不晚于报告期末`)
  }
  const ordered = fundamentals.periods.every((p, i, all) => i === 0 || p.period > all[i - 1].period)
  check(ordered, `${symbol}: 报告期非升序`)
  const model = fundamentals.statementModel
  const last = fundamentals.periods.at(-1)
  check(
    model === 'bank' ? last.netInterestMargin !== undefined : last.grossMargin !== undefined,
    `${symbol}: statementModel 为 ${model}，但科目不匹配`,
  )
}
console.log(`  ${quotes.quotes.length} 个标的的报告期均带披露日且晚于期末`)

console.log('估值与风险指标的可推导性')
for (const valuation of valuations.valuations) {
  const symbol = valuation.instrument.symbol
  const quote = quotes.quotes.find((q) => q.instrument.symbol === symbol)
  const meta = metaOf(symbol)
  const cap = (quote.last * meta.totalShares) / 1e8
  check(Math.abs(cap - valuation.marketCap) < 0.5, `${symbol}: 市值与现价×总股本不一致`)
  check(Math.abs(cap - quote.marketCap) < 0.5, `${symbol}: 快照市值与估值文件不一致`)
  check(
    valuation.pePercentile2Y >= 0 && valuation.pePercentile2Y <= 100,
    `${symbol}: PE 分位 ${valuation.pePercentile2Y} 越界`,
  )
  check(
    valuation.peRangeLow2Y <= valuation.peTtm && valuation.peTtm <= valuation.peRangeHigh2Y,
    `${symbol}: 当前 PE 落在历史区间之外`,
  )
}

for (const row of risk.stocks) {
  const symbol = row.instrument.symbol
  check(row.maxDrawdown <= 0, `${symbol}: 最大回撤应为非正值`)
  check(row.maxDrawdownPeak < row.maxDrawdownTrough, `${symbol}: 回撤前高日不早于谷底日`)
  check(
    Math.abs(row.totalReturn.return2Y - row.return2Y - row.dividendContribution2Y) < 0.01,
    `${symbol}: 总收益 − 价格收益 ≠ 股息贡献`,
  )
  const dividendPositive = row.dividendContribution2Y >= 0
  check(dividendPositive, `${symbol}: 股息贡献为负`)
}
console.log(`  ${valuations.valuations.length} 个标的的市值、分位、收益拆分自洽`)

console.log('基金')
for (const fund of funds.funds) {
  const navFile = load(`fund-nav/${fund.code}.json`)
  const navs = navFile.navs
  check(navs.length === 500, `${fund.code}: 净值点数为 ${navs.length}，应为 500`)
  check(Math.abs(navs.at(-1).nav - fund.nav) < 1e-4, `${fund.code}: 档案净值与序列末值不一致`)
  check(fund.listed === (fund.market !== null), `${fund.code}: listed 与 market 矛盾`)

  if (fund.kind === 'money') {
    check(navs.every((p) => p.nav === 1), `${fund.code}: 货币基金净值不恒为 1`)
    check(navs.every((p) => p.yield7dAnnualized > 0), `${fund.code}: 货币基金缺七日年化`)
    check(fund.peerRanking === null, `${fund.code}: 货币基金不应有同类排名`)
  } else {
    check(navs.every((p) => p.nav > 0), `${fund.code}: 存在非正净值`)
  }
  if (fund.listed && fund.kind !== 'money') {
    check(navs.every((p) => p.marketPrice > 0), `${fund.code}: 场内基金缺市价`)
    check(navs.every((p) => Math.abs(p.premiumDiscount) < 5), `${fund.code}: 折溢价率超出 ±5%`)
  } else {
    check(navs.every((p) => p.marketPrice === undefined), `${fund.code}: 场外基金不应有市价`)
  }
  if (fund.trackIndex) {
    check(fund.trackingErrorAnnualized > 0, `${fund.code}: 指数基金缺跟踪误差`)
  }
  console.log(`  ${fund.code} ${fund.shortName}  ${fund.kind}  净值 ${fund.nav}  规模 ${fund.netAssets} 亿`)
}

const holdings = load('fund-holdings.json').holdings
for (const entry of holdings) {
  const sum = entry.holdings.reduce((a, h) => a + h.weight, 0)
  check(Math.abs(sum - entry.topTenWeight) < 0.05, `${entry.code}: 前十大权重合计与 topTenWeight 不符`)
  check(sum <= 100, `${entry.code}: 前十大权重合计超过 100%`)
  const alloc = entry.assetAllocation
  const total = alloc.equity + alloc.bond + alloc.cash + alloc.other
  check(Math.abs(total - 100) < 0.5, `${entry.code}: 资产配置合计为 ${total}%`)
  check(entry.disclosedOn > entry.period, `${entry.code}: 持仓披露日不晚于报告期末`)
}
console.log(`  ${holdings.length} 只基金的持仓权重与配置合计成立`)

if (failures.length > 0) {
  console.error(`\n${failures.length} 条不变量不成立：`)
  for (const failure of failures) console.error(`  ✗ ${failure}`)
  process.exit(1)
}
console.log('\n全部不变量通过')
