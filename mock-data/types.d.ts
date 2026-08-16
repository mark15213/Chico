/**
 * Chico mock 数据集的 TypeScript 类型。
 *
 * 每个 interface 对应 `data/` 下的一个 JSON 文件或其数组元素。类型只描述数据，
 * 不依赖仓库里的任何包——把这个文件复制进消费方即可使用。
 *
 * 与 `@deepseek-ai/dsh-market-data` 的关系：`InstrumentRef`、`PriceBar`、`Quote`
 * 三者是该 seam 已有词汇的超集，多出来的字段（换手率、涨跌停价、成交额）是 A 股
 * 工作台必须显示、而 seam 目前没有的。其余类型在现有 seam 中没有对应物。
 * @module chico-mock/types
 */

/** 交易场所。`null` 表示场外基金——它不在任何交易所挂牌，只有基金代码。 */
export type Market = 'SSE' | 'SZSE' | 'BSE' | 'HKEX' | 'NASDAQ' | 'NYSE' | null

/** 标的身份。同一代码在两个场所是两个标的，所以场所是身份的一部分。 */
export interface InstrumentRef {
  /** 交易场所；场外基金为 `null`。 */
  readonly market: Market
  /** 场所自己书写的代码，或场外基金的六位代码。 */
  readonly symbol: string
}

/** 标的类别。基金按份额形态细分，因为可交易性与费率结构完全不同。 */
export type InstrumentType = 'stock' | 'etf' | 'lof' | 'open-fund' | 'money-fund' | 'index'

/** 申万三级行业分类。个股必有，基金为 `null`。 */
export interface Industry {
  /** 一级行业，如「食品饮料」。 */
  readonly l1: string
  /** 二级行业，如「白酒Ⅱ」。 */
  readonly l2: string
  /** 三级行业，如「白酒Ⅲ」。 */
  readonly l3: string
}

/** `instruments.json` 的元素：标的主数据，所有其他文件通过 `instrument` 关联到它。 */
export interface Instrument {
  readonly instrument: InstrumentRef
  /** 场所语言的显示名。 */
  readonly name: string
  /** 英文名；基金为 `null`。 */
  readonly enName: string | null
  readonly type: InstrumentType
  /** 计价币种（ISO-4217）。港股标的为 `HKD`。 */
  readonly currency: string
  /** 财报币种。与计价币种可以不同：腾讯以港币交易、以人民币报表。 */
  readonly reportCurrency?: string
  /** 上市板块，决定涨跌幅限制与投资者适当性要求。 */
  readonly board: string
  /** 上市日或基金成立日。 */
  readonly listedOn: string
  /** 单边涨跌幅限制（百分数）。港股与场外基金为 `null`，表示无限制。 */
  readonly priceLimitPercent: number | null
  /** 最小交易单位（股/份）；场外基金为 `null`。 */
  readonly lotSize: number | null
  readonly industry: Industry | null
  /** 概念与属性标签，供筛选与分组使用。 */
  readonly tags: readonly string[]
  /** 总股本或基金总份额。 */
  readonly totalShares: number
  /** 流通股本或流通份额。 */
  readonly floatShares: number
  /** 互联互通渠道，如「沪股通」；不适用时为 `null`。 */
  readonly connect: string | null
  /** 交易状态。 */
  readonly status: 'listed' | 'suspended' | 'delisted'
}

/**
 * 一个交易日的价格与成交。`date` 是场所的交易日期而非时间戳，因为一根 K 线
 * 覆盖的是一整个交易时段。
 */
export interface PriceBar {
  /** 交易日（`YYYY-MM-DD`）。 */
  readonly date: string
  readonly open: number
  readonly high: number
  readonly low: number
  readonly close: number
  /** 成交量（股/份）。 */
  readonly volume: number
  /** 成交额（计价币种）。 */
  readonly amount: number
  /** 相对前一交易日收盘的涨跌幅（百分数）。 */
  readonly changePercent: number
  /** 振幅：`(最高 − 最低) / 前收`（百分数）。 */
  readonly amplitude: number
  /** 换手率：`成交量 / 流通股本`（百分数）。 */
  readonly turnoverRate: number
}

/**
 * 复权因子的变化点。`后复权价 = 收盘价 × 因子`，锚定日的因子恒为 1，
 * 因此后复权序列的涨幅就是含股息的总收益。只记录因子发生变化的日期。
 */
export interface AdjustmentFactor {
  readonly date: string
  readonly factor: number
}

/** `bars/{market}-{symbol}.json` 与 `index-bars/{code}.json` 的结构。 */
export interface PriceHistoryFile {
  readonly instrument: InstrumentRef
  readonly name: string
  readonly currency: string
  /** 本文件价格的复权口径。恒为 `none`（as-traded），复权靠 `adjustmentFactors` 自行换算。 */
  readonly adjustment: 'none' | 'backward' | 'forward'
  readonly adjustmentFactors: readonly AdjustmentFactor[]
  /** 升序排列的日线。 */
  readonly bars: readonly PriceBar[]
}

/** `quotes.json` 的元素：锚定日收盘后的最新快照。 */
export interface Quote {
  readonly instrument: InstrumentRef
  readonly name: string
  readonly currency: string
  /** 最新成交价。 */
  readonly last: number
  readonly previousClose: number
  readonly open: number
  readonly high: number
  readonly low: number
  readonly changePercent: number
  readonly volume: number
  readonly amount: number
  readonly turnoverRate: number
  readonly amplitude: number
  /** 当日涨停价；无涨跌幅限制时为 `null`。 */
  readonly limitUp: number | null
  /** 当日跌停价；无涨跌幅限制时为 `null`。 */
  readonly limitDown: number | null
  /** 近 250 个交易日的最高价。 */
  readonly week52High: number
  /** 近 250 个交易日的最低价。 */
  readonly week52Low: number
  /** 总市值（亿元，计价币种）。 */
  readonly marketCap: number
  /** 流通市值（亿元，计价币种）。 */
  readonly floatMarketCap: number
  /** 场所为该标的定价的时刻（ISO-8601，带场所时区偏移）。不是抓取时刻。 */
  readonly asOf: string
  /** `asOf` 时刻场所是否开市。本数据集全部为收盘快照。 */
  readonly session: 'open' | 'closed'
}

/**
 * `valuation.json` 的元素。分位数由本数据集自身的价格序列与滚动 TTM 计算，
 * 窗口为 500 个交易日；换成更长的历史需要更长的价格序列。
 */
export interface Valuation {
  readonly instrument: InstrumentRef
  readonly asOf: string
  /** 滚动 12 个月市盈率。亏损标的为负值，消费方需要自行决定如何显示。 */
  readonly peTtm: number
  /** 按上一完整年度净利计算的静态市盈率。 */
  readonly peStatic: number
  readonly pb: number
  readonly psTtm: number
  readonly pcfTtm: number
  /** 企业价值倍数；银行不适用，为 `null`。 */
  readonly evToEbitda: number | null
  /** 滚动 12 个月股息率（百分数）。 */
  readonly dividendYieldTtm: number
  /** 分红占归母净利的比例（百分数）。 */
  readonly dividendPayoutRatio: number
  readonly marketCap: number
  readonly floatMarketCap: number
  /** 当前 PE 在 500 日历史中的分位（0–100）。 */
  readonly pePercentile2Y: number
  /** 当前 PB 在 500 日历史中的分位（0–100）。 */
  readonly pbPercentile2Y: number
  readonly peRangeLow2Y: number
  readonly peRangeHigh2Y: number
  /** 同行业中位 PE，用于横向对比。 */
  readonly industryMedianPe: number
  readonly industryName: string
}

/** 卖方对某个财年的盈利预测。 */
export interface Forecast {
  readonly fiscalYear: number
  /** 预测营业收入（亿元）。 */
  readonly revenue: number
  /** 预测归母净利润（亿元）。 */
  readonly netProfit: number
  readonly eps: number
  /** 以当前市值除以该年预测净利得到的前瞻 PE。 */
  readonly impliedPe: number
  /** 给出该年预测的机构数量。越往后越少。 */
  readonly analystCount: number
}

/** `consensus.json` 的元素：卖方一致预期。 */
export interface Consensus {
  readonly instrument: InstrumentRef
  readonly asOf: string
  /** 覆盖该标的的机构数量。 */
  readonly coverageCount: number
  /** 评级分布。 */
  readonly rating: { readonly buy: number; readonly hold: number; readonly sell: number }
  /** 综合评级的中文表述。 */
  readonly consensusRating: string
  readonly targetPrice: {
    readonly mean: number
    readonly high: number
    readonly low: number
    readonly median: number
  }
  /** 目标价均值相对现价的空间（百分数）。 */
  readonly upsideToMean: number
  readonly forecasts: readonly Forecast[]
  /** 近三个月的预测调整：上调、下调家数与 EPS 预测变动幅度（百分数）。 */
  readonly revision3M: {
    readonly upgrades: number
    readonly downgrades: number
    readonly epsRevisionPercent: number
  }
}

/** 前十大股东之一。 */
export interface TopShareholder {
  readonly rank: number
  readonly name: string
  /** 持股占总股本比例（百分数）。 */
  readonly percent: number
  /** 相对上一报告期的持股变动（股）；负值为减持。 */
  readonly changeShares: number
}

/** 限售股解禁安排。解禁前后的流通盘变化是短期供给的主要来源。 */
export interface LockupExpiry {
  readonly date: string
  readonly shares: number
  /** 解禁数量占当前流通盘的比例（百分数）。 */
  readonly percentOfFloat: number
  /** 限售股类型，如「首发原股东限售股」。 */
  readonly type: string
}

/**
 * `flows.json` 的元素：资金与筹码。A 股标的有北向持股与两融，港股标的对应为
 * 南向持股与淡仓，因此两组字段互斥地为 `null`。
 */
export interface Flow {
  readonly instrument: InstrumentRef
  readonly asOf: string
  /** 北向（陆股通）持股占总股本比例（百分数）；港股标的没有此字段。 */
  readonly northboundHoldingPercent?: number
  /** 北向持股比例近 30 日变动（百分点）。 */
  readonly northboundChange30D?: number
  /** 南向（港股通）持股占比（百分数）；仅港股标的。 */
  readonly southboundHoldingPercent?: number
  readonly southboundChange30D?: number
  /** 近 5 日主力资金净流入（亿元）。 */
  readonly mainCapitalNet5D: number
  /** 按单笔金额分档的资金净流入（亿元）。 */
  readonly orderFlow: {
    readonly extraLarge: number
    readonly large: number
    readonly medium: number
    readonly small: number
  }
  /** 融资融券余额（亿元）；港股为 `null`。 */
  readonly marginBalance: number | null
  /** 两融余额占流通市值比例（百分数）；港股为 `null`。 */
  readonly marginBalanceToFloatCap: number | null
  /** 淡仓余额（亿元）；A 股为 `null`。 */
  readonly shortBalance: number | null
  /** 股东户数。户数下降通常意味着筹码集中。 */
  readonly shareholderCount: number
  /** 股东户数环比变动（百分数）。 */
  readonly shareholderCountChangeQoQ: number
  /** 机构持股占比（百分数）。 */
  readonly institutionalHoldingPercent: number
  readonly topShareholders: readonly TopShareholder[]
  readonly lockupExpiries: readonly LockupExpiry[]
}

/** `corporate-actions.json` 的元素：分红、回购等公司行动。 */
export interface CorporateAction {
  readonly instrument: InstrumentRef
  readonly type: 'dividend' | 'buyback' | 'split' | 'placement' | 'incentive'
  /** 分红对应的会计年度。 */
  readonly fiscalYear?: number
  /** 每股税前股利。 */
  readonly dividendPerShare?: number
  readonly currency?: string
  /** 股权登记日：持有到这一日收盘才享有本次分红。 */
  readonly recordDate?: string
  /** 除权除息日：价格在这一日按分红金额向下调整。 */
  readonly exDate?: string
  /** 派息日。 */
  readonly payDate?: string
  /** 每 10 股送股数。 */
  readonly bonusShareRatio?: number
  /** 每 10 股转增股数。 */
  readonly transferShareRatio?: number
  readonly announcedOn?: string
  /** 回购金额。 */
  readonly amount?: number
  readonly unit?: string
  readonly completedPercent?: number
  readonly note?: string
}

/** 含股息再投资的收益口径。与价格收益的差额即股息贡献。 */
export interface TotalReturn {
  readonly return1Y: number
  readonly return2Y: number
  readonly annualizedReturn: number
  readonly maxDrawdown: number
  readonly sharpe: number
}

/**
 * `risk-metrics.json` 中的一行。所有指标都由本数据集的序列实测得到，
 * 而不是独立填入的数字——改了价格序列，这里的值会跟着变。
 */
export interface RiskMetrics {
  readonly instrument?: InstrumentRef
  /** 基金用代码而非 `instrument`。 */
  readonly code?: string
  /** 计算 Beta 与超额收益所用的基准。 */
  readonly benchmark: string
  readonly asOf: string
  /** 区间价格收益（百分数），不含股息。 */
  readonly return1M: number
  readonly return3M: number
  readonly return6M: number
  readonly return1Y: number
  readonly return2Y: number
  readonly annualizedReturn: number
  readonly annualizedVolatility: number
  /** 只统计下跌日的波动率，用于索提诺比率。 */
  readonly downsideVolatility: number
  /** 最大回撤（负的百分数）。 */
  readonly maxDrawdown: number
  /** 最大回撤起点（前高日）。 */
  readonly maxDrawdownPeak: string
  /** 最大回撤终点（谷底日）。 */
  readonly maxDrawdownTrough: string
  readonly sharpe: number
  readonly sortino: number
  /** 年化收益与最大回撤之比。 */
  readonly calmar: number
  /** 95% 置信度的单日在险收益（负的百分数）。 */
  readonly var95Daily: number
  /** 相对基准的 Beta；无基准时为 `null`。 */
  readonly beta: number | null
  readonly correlation: number | null
  readonly totalReturn?: TotalReturn
  /** 两年内股息对总收益的贡献（百分点）。 */
  readonly dividendContribution2Y?: number
  /** 两年含息总收益相对基准的超额（百分点）。 */
  readonly excessReturn2Y?: number
}

/** `news.json` 的元素：事件与公告流。 */
export interface NewsEvent {
  readonly instrument: InstrumentRef
  readonly date: string
  /** 事件类别，如「业绩」「分红」「监管」「定期报告」。 */
  readonly category: string
  readonly headline: string
  /** 事件对基本面的方向性判断。 */
  readonly sentiment: 'positive' | 'neutral' | 'negative'
  /** 重要性，用于时间线的密度控制。 */
  readonly importance: 'high' | 'medium' | 'low'
}

/** 通用工商业企业的报告期财务。金额单位为亿元。 */
export interface GeneralFinancialPeriod {
  /** 报告期末日（`YYYY-MM-DD`）。 */
  readonly period: string
  readonly periodType: 'quarterly' | 'annual'
  /** 实际披露日。在这一天之前，这份报表对市场不可见——回测必须尊重它。 */
  readonly disclosedOn: string
  readonly currency: string
  readonly unit: string
  /** 单季营业收入。 */
  readonly revenue: number
  readonly revenueYoY: number
  /** 单季归母净利润。 */
  readonly netProfitAttributable: number
  readonly netProfitYoY: number
  /** 扣除非经常性损益后的归母净利润。 */
  readonly netProfitDeducted: number
  /** 年初至今累计营业收入。 */
  readonly revenueYtd: number
  readonly netProfitYtd: number
  readonly eps: number
  /** 每股净资产。 */
  readonly bps: number
  readonly totalEquity: number
  readonly grossProfit: number
  readonly grossMargin: number
  readonly netMargin: number
  readonly operatingProfit: number
  readonly sellingExpense: number
  readonly adminExpense: number
  readonly rdExpense: number
  readonly rdRatio: number
  readonly operatingCashFlow: number
  readonly capex: number
  /** 自由现金流：经营现金流减资本开支。 */
  readonly freeCashFlow: number
  readonly totalAssets: number
  readonly totalLiabilities: number
  readonly debtToAsset: number
  readonly interestBearingDebt: number
  readonly cashAndEquivalents: number
  readonly inventory: number
  readonly accountsReceivable: number
  readonly roeDiluted: number
  readonly roic: number
  readonly currentRatio: number
}

/**
 * 银行的报告期财务。银行没有营业成本与存货，用毛利率描述银行是错的，
 * 因此走一套独立科目：净息差、不良率、拨备覆盖率、资本充足率。
 */
export interface BankFinancialPeriod {
  readonly period: string
  readonly periodType: 'quarterly' | 'annual'
  readonly disclosedOn: string
  readonly currency: string
  readonly unit: string
  readonly revenue: number
  readonly revenueYoY: number
  readonly netProfitAttributable: number
  readonly netProfitYoY: number
  readonly netProfitDeducted: number
  readonly revenueYtd: number
  readonly netProfitYtd: number
  readonly eps: number
  readonly bps: number
  readonly totalEquity: number
  /** 净利息收入。 */
  readonly netInterestIncome: number
  /** 非利息收入：手续费、投资收益等。 */
  readonly nonInterestIncome: number
  /** 净息差（百分数）。银行最核心的盈利能力指标。 */
  readonly netInterestMargin: number
  /** 不良贷款率（百分数）。 */
  readonly nplRatio: number
  /** 拨备覆盖率（百分数）。 */
  readonly provisionCoverage: number
  /** 核心一级资本充足率（百分数），决定分红与扩表空间。 */
  readonly cet1Ratio: number
  /** 成本收入比（百分数）。 */
  readonly costIncomeRatio: number
  readonly roeAnnualized: number
  readonly totalAssets: number
  readonly customerLoans: number
  readonly customerDeposits: number
  /** 零售客户管理总资产（亿元）。 */
  readonly retailAum: number
}

/** `fundamentals-{market}-{symbol}.json` 的结构。 */
export interface FundamentalsFile {
  readonly instrument: InstrumentRef
  readonly name: string
  /** 报表币种。可能与计价币种不同。 */
  readonly reportCurrency: string
  readonly unit: string
  /** 用哪套科目读这份报表。 */
  readonly statementModel: 'general' | 'bank'
  readonly periods: readonly (GeneralFinancialPeriod | BankFinancialPeriod)[]
}

/** 基金经理任职信息。 */
export interface FundManager {
  readonly name: string
  /** 管理本基金的起始日。 */
  readonly since: string
  /** 任职期间年化回报（小数）。 */
  readonly annualizedReturn: number
  /** 在管总规模（亿元）。 */
  readonly aum: number
  /** 在管基金只数。 */
  readonly funds: number
}

/** 基金费率。场内基金没有申赎费，场外基金没有场内买卖佣金。 */
export interface FundFees {
  /** 管理费年费率（小数）。 */
  readonly management: number
  /** 托管费年费率（小数）。 */
  readonly custody: number
  /** 销售服务费年费率（小数）。 */
  readonly sales: number
  /** 申购费率；场内基金为 `null`。 */
  readonly subscription: number | null
  /** 赎回费率；场内基金为 `null`。 */
  readonly redemption: number | null
}

/** 某个报告期末的规模与份额。 */
export interface FundScalePoint {
  readonly period: string
  /** 期末资产净值（亿元）。 */
  readonly netAssets: number
  /** 期末份额。 */
  readonly shares: number
}

/** `funds.json` 的元素：基金档案。 */
export interface FundProfile {
  readonly code: string
  /** 挂牌场所；场外基金为 `null`。 */
  readonly market: Market
  readonly name: string
  readonly shortName: string
  readonly kind: 'etf' | 'lof' | 'open' | 'money'
  readonly kindLabel: string
  readonly company: string
  readonly inceptionDate: string
  readonly currency: string
  /** 风险等级（R1–R5），决定适当性匹配。 */
  readonly riskLevel: string
  /** 是否可在场内交易。决定有没有市价、折溢价与盘中流动性。 */
  readonly listed: boolean
  /** 跟踪指数代码；主动基金为 `null`。 */
  readonly trackIndex: string | null
  readonly trackIndexName: string | null
  /** 业绩比较基准的文字表述。 */
  readonly benchmark: string
  /** 年化跟踪误差；主动基金为 `null`。 */
  readonly trackingErrorAnnualized: number | null
  readonly fees: FundFees
  readonly nav: number
  /** 累计净值：还原历史分红后的净值，用于跨分红比较。 */
  readonly cumulativeNav: number | null
  readonly shares: number
  readonly netAssets: number
  readonly netAssetsUnit: string
  readonly managers: readonly FundManager[]
  /** 各区间的同类排名，形如 `12/132`；货币基金为 `null`。 */
  readonly peerRanking: Readonly<Record<string, string>> | null
  readonly scaleHistory: readonly FundScalePoint[]
  /** 本基金锚点的真实来源与观测日期。 */
  readonly dataSource: string
}

/** 基金某日的净值观测。场内基金额外带市价与折溢价。 */
export interface FundNavPoint {
  readonly date: string
  /** 单位净值；货币基金恒为 1。 */
  readonly nav: number
  readonly cumulativeNav?: number
  /** 当日净值涨跌幅（百分数）。 */
  readonly dailyReturn?: number
  /** 场内收盘价；仅 ETF 与 LOF。 */
  readonly marketPrice?: number
  /** 折溢价率（百分数）：正为溢价。仅 ETF 与 LOF。 */
  readonly premiumDiscount?: number
  /** 基金份额参考净值；仅 ETF。 */
  readonly iopv?: number
  /** 七日年化收益率（百分数）；仅货币基金。 */
  readonly yield7dAnnualized?: number
  /** 每万份收益；仅货币基金。 */
  readonly incomePerTenThousand?: number
}

/** `fund-nav/{code}.json` 的结构。 */
export interface FundNavFile {
  readonly fund: {
    readonly code: string
    readonly market: Market
    readonly name: string
    readonly kind: string
    readonly currency: string
  }
  readonly navs: readonly FundNavPoint[]
}

/** 基金的一笔重仓持股。 */
export interface FundHolding {
  readonly rank: number
  readonly symbol: string
  readonly name: string
  /** 占基金资产净值比例（百分数）。 */
  readonly weight: number
  /** 持仓市值（亿元）。 */
  readonly marketValue: number
  readonly marketValueUnit: string
}

/**
 * `fund-holdings.json` 的元素。持仓按报告期披露，`disclosedOn` 之前不可见；
 * 用披露日之后的持仓解释披露日之前的净值波动是前视偏差。
 */
export interface FundHoldingsFile {
  readonly code: string
  /** 持仓所属报告期。 */
  readonly period: string
  readonly disclosedOn: string
  /** 前十大重仓合计占净值比（百分数），衡量集中度。 */
  readonly topTenWeight: number
  /** 年化换手率（百分数），衡量交易频繁程度。 */
  readonly turnoverRateAnnual: number
  readonly holdings: readonly FundHolding[]
  /** 大类资产配置（百分数）。 */
  readonly assetAllocation: {
    readonly equity: number
    readonly bond: number
    readonly cash: number
    readonly other: number
  }
  /** 申万一级行业配置（百分数）。 */
  readonly industryAllocation: readonly { readonly industry: string; readonly weight: number }[]
}

/** `indexes.json` 的元素：基准指数。 */
export interface IndexSummary {
  readonly code: string
  readonly market: Market
  readonly name: string
  readonly currency: string
  /** 锚定日收盘点位。 */
  readonly close: number
  readonly asOf: string
  readonly dataSource: string
}

/** 每个 JSON 文件共有的信封字段。 */
export interface DatasetEnvelope {
  readonly $schema: string
  /** 数据集结构版本；结构变更时递增。 */
  readonly datasetVersion: number
  /** 恒为 `true`：本数据集为合成数据，不得用于任何真实投资决策。 */
  readonly synthetic: true
  /** 所有序列共同的终点交易日。 */
  readonly anchorDate: string
}
