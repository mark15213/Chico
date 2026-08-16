/**
 * 锚点表：生成器唯一的"事实输入"。
 *
 * 每个标的的量级参数（收盘价、股本、营收利润、基金规模、费率、经理）都取自
 * 2026-08 前后可公开检索到的真实数值，来源与观测日期记录在 `source` 字段里。
 * 生成器只用它们校准分布，输出的每一条 K 线、每一份财报、每一条持仓都是合成的。
 *
 * 替换真实数据源时，改这里的锚点重跑 `node generate.mjs` 即可，不必动生成逻辑。
 */

/** 序列终点：所有价格与净值序列都收敛到这一交易日。 */
export const ANCHOR_DATE = '2026-08-14'

/** 生成的日线根数（seam 的 maxHistorySessions 默认上限）。 */
export const SESSIONS = 500

/**
 * A 股休市日（近似）。2024–2026 法定节假日，按"连续休市区间"给出。
 * 港股假期与之部分重合，差异部分见 HKEX_HOLIDAYS。
 */
export const CN_HOLIDAYS = [
  ['2024-01-01', '2024-01-01'], ['2024-02-09', '2024-02-17'], ['2024-04-04', '2024-04-06'],
  ['2024-05-01', '2024-05-05'], ['2024-06-08', '2024-06-10'], ['2024-09-15', '2024-09-17'],
  ['2024-10-01', '2024-10-07'],
  ['2025-01-01', '2025-01-01'], ['2025-01-28', '2025-02-04'], ['2025-04-04', '2025-04-06'],
  ['2025-05-01', '2025-05-05'], ['2025-05-31', '2025-06-02'], ['2025-10-01', '2025-10-08'],
  ['2026-01-01', '2026-01-03'], ['2026-02-15', '2026-02-23'], ['2026-04-04', '2026-04-06'],
  ['2026-05-01', '2026-05-05'], ['2026-06-19', '2026-06-21'], ['2026-09-25', '2026-09-27'],
  ['2026-10-01', '2026-10-07'],
]

/** 港股特有休市日（近似）：耶稣受难日、复活节、佛诞、圣诞节等。 */
export const HKEX_HOLIDAYS = [
  ['2024-03-29', '2024-04-01'], ['2024-05-15', '2024-05-15'], ['2024-07-01', '2024-07-01'],
  ['2024-12-25', '2024-12-26'],
  ['2025-04-18', '2025-04-21'], ['2025-05-05', '2025-05-05'], ['2025-07-01', '2025-07-01'],
  ['2025-12-25', '2025-12-26'],
  ['2026-04-03', '2026-04-06'], ['2026-05-25', '2026-05-25'], ['2026-07-01', '2026-07-01'],
  ['2026-12-25', '2026-12-28'],
]

/**
 * 基准指数。个股的 Beta、超额收益、基金的业绩基准都对这些序列计算。
 * `close` 是 ANCHOR_DATE 的锚定点位。
 */
export const INDEXES = [
  {
    code: '000300', market: 'SSE', name: '沪深300', currency: 'CNY', close: 4580.0, vol: 0.17, return2Y: 0.33,
    source: '4543.18 @2026-08-03（东方财富大盘复盘），外推至锚定日',
  },
  {
    code: '000001', market: 'SSE', name: '上证指数', currency: 'CNY', close: 3851.0, vol: 0.15, return2Y: 0.33,
    source: '3822.28 @2026-08-04（东方财富大盘复盘），外推至锚定日',
  },
  {
    code: '399006', market: 'SZSE', name: '创业板指', currency: 'CNY', close: 3512.0, vol: 0.26, return2Y: 1.20,
    source: '3488.97 @2026-08-04（东方财富大盘复盘），外推至锚定日',
  },
  {
    code: 'HSI', market: 'HKEX', name: '恒生指数', currency: 'HKD', close: 27480.0, vol: 0.21, return2Y: 0.59,
    source: '2026 年区间量级估计，未取得当日点位',
  },
]

/**
 * 个股。`close` 是锚定日收盘价，`return2Y` 是这 500 个交易日的累计收益率——
 * 两者一起把序列的起点和终点都钉死，`vol` 只决定中间的路径形状。
 * `low52`/`high52` 是近 250 个交易日的极值目标，生成器会把路径校准到这个区间。
 * `betaTarget` 是相对 `benchmark` 的目标 Beta，通过相关系数实现而非事后填值。
 * 财务量级（`fin`）以人民币亿元为单位，港股同样以人民币报表、港币计价。
 */
export const STOCKS = [
  {
    market: 'SSE', symbol: '600519', name: '贵州茅台', enName: 'Kweichow Moutai', currency: 'CNY',
    board: '主板', limitPct: 10, listedOn: '2001-08-27',
    industry: { l1: '食品饮料', l2: '白酒Ⅱ', l3: '白酒Ⅲ' }, tags: ['白酒', '消费龙头', '高股息', '沪股通'],
    totalShares: 12.5620e8, floatShares: 12.5620e8, connect: '沪股通',
    close: 1341.99, low52: 1151.01, high52: 1568.0, vol: 0.24, return2Y: -0.08,
    turnoverBase: 0.0022, betaTarget: 0.92, benchmark: '000300',
    fin: { rev2025: 1902.0, np2025: 951.0, equity: 2612.0, dps: 38.52, revGrowth: 0.072, npMargin: 0.50, gross: 0.918, np2026H1: 445.0 },
    consensus: { coverage: 23, targetMean: 1722.27, targetHigh: 1980.0, targetLow: 1450.0, buy: 23, hold: 0, sell: 0 },
    source: '收盘价 1341.99 / 前收 1355.29 / 52 周 1151.01–1568.00 @2026-08-16（investing.com）；2026H1 归母净利 445 亿（新浪财经）；覆盖 23 家、目标价均值 1722.27（investing.com）',
  },
  {
    market: 'SZSE', symbol: '300750', name: '宁德时代', enName: 'CATL', currency: 'CNY',
    board: '创业板', limitPct: 20, listedOn: '2018-06-11',
    industry: { l1: '电力设备', l2: '电池', l3: '锂电池' }, tags: ['动力电池', '储能', '深股通', 'A+H'],
    totalShares: 45.60e8, floatShares: 39.82e8, connect: '深股通',
    close: 395.30, low52: 212.4, high52: 432.6, vol: 0.38, return2Y: 1.15,
    turnoverBase: 0.0068, betaTarget: 1.28, benchmark: '399006',
    fin: { rev2025: 3806.0, np2025: 653.0, equity: 2985.0, dps: 5.60, revGrowth: 0.094, npMargin: 0.172, gross: 0.256 },
    consensus: { coverage: 41, targetMean: 488.0, targetHigh: 560.0, targetLow: 380.0, buy: 36, hold: 5, sell: 0 },
    source: '现价 395.30 @2026-08-16（TradingView）；2025 前三季营收 2830.72 亿 (+9.28%)、归母 490.34 亿 (+36.20%)（同花顺 F10）；目标价 488 元对应 2026 年 25×PE（同花顺）',
  },
  {
    market: 'SSE', symbol: '600036', name: '招商银行', enName: 'China Merchants Bank', currency: 'CNY',
    board: '主板', limitPct: 10, listedOn: '2002-04-09',
    industry: { l1: '银行', l2: '股份制银行Ⅱ', l3: '股份制银行Ⅲ' }, tags: ['银行', '高股息', '零售之王', '沪股通', 'A+H'],
    totalShares: 252.20e8, floatShares: 206.29e8, connect: '沪股通',
    close: 38.97, low52: 31.02, high52: 42.88, vol: 0.20, return2Y: 0.16,
    turnoverBase: 0.0031, betaTarget: 0.78, benchmark: '000300',
    fin: { rev2025: 3412.0, np2025: 1500.0, equity: 11043.0, dps: 2.011, revGrowth: 0.031, npMargin: 0.44, gross: null },
    bank: { nim: 0.0185, npl: 0.0092, provisionCoverage: 3.90, cet1: 0.1421, costIncome: 0.322, aum: 180000.0 },
    consensus: { coverage: 32, targetMean: 46.20, targetHigh: 53.0, targetLow: 39.5, buy: 27, hold: 5, sell: 0 },
    source: '收盘 38.97 @2026-08-06、38.63 @2026-07-20（雪球/东方财富）；PE 6.56 / PB 0.89 / 股息率TTM 5.16%（东方财富估值）；零售 AUM 突破 18 万亿 @2026-08-11（新浪财经）',
  },
  {
    market: 'SSE', symbol: '688981', name: '中芯国际', enName: 'SMIC', currency: 'CNY',
    board: '科创板', limitPct: 20, listedOn: '2020-07-16',
    industry: { l1: '电子', l2: '半导体', l3: '集成电路制造' }, tags: ['晶圆代工', '国产替代', '科创50', 'A+H'],
    totalShares: 79.78e8, floatShares: 20.12e8, connect: '沪股通',
    close: 102.53, low52: 86.22, high52: 176.34, vol: 0.45, return2Y: 1.05,
    turnoverBase: 0.0125, betaTarget: 1.42, benchmark: '000300',
    fin: { rev2025: 641.0, np2025: 44.8, equity: 1501.0, dps: 0, revGrowth: 0.186, npMargin: 0.070, gross: 0.232 },
    consensus: { coverage: 26, targetMean: 128.5, targetHigh: 168.0, targetLow: 92.0, buy: 15, hold: 9, sell: 2 },
    source: 'A 股收盘 102.53、总市值 8180 亿、一年低/高 86.22/176.34（搜狐证券/富途）；Q2 毛利率 20.1%→25.3%、单季营收首破 30 亿美元（雪球）',
  },
  {
    market: 'SZSE', symbol: '002594', name: '比亚迪', enName: 'BYD', currency: 'CNY',
    board: '主板', limitPct: 10, listedOn: '2011-06-30',
    industry: { l1: '汽车', l2: '乘用车', l3: '综合乘用车' }, tags: ['新能源车', '出海', '深股通', 'A+H'],
    totalShares: 91.20e8, floatShares: 55.42e8, connect: '深股通',
    close: 90.12, low52: 77.60, high52: 116.59, vol: 0.35, return2Y: -0.30,
    turnoverBase: 0.0074, betaTarget: 1.15, benchmark: '000300',
    fin: { rev2025: 8620.0, np2025: 402.0, equity: 2288.0, dps: 1.35, revGrowth: 0.108, npMargin: 0.047, gross: 0.191 },
    consensus: { coverage: 38, targetMean: 112.4, targetHigh: 140.0, targetLow: 84.0, buy: 30, hold: 7, sell: 1 },
    source: '收盘 90.12 / 前收 91.15 / 日内 89.93–91.66 / 52 周 77.60–116.59 @2026-08-11（investing.com）',
  },
  {
    market: 'HKEX', symbol: '00700', name: '腾讯控股', enName: 'Tencent Holdings', currency: 'HKD',
    board: '主板', limitPct: null, listedOn: '2004-06-16',
    industry: { l1: '传媒', l2: '互联网服务', l3: '综合互联网' }, tags: ['港股通', '互联网', '游戏', 'AI'],
    totalShares: 91.50e8, floatShares: 91.50e8, connect: '港股通',
    close: 460.20, low52: 372.0, high52: 548.5, vol: 0.28, return2Y: 0.24,
    turnoverBase: 0.0018, betaTarget: 1.05, benchmark: 'HSI',
    reportCurrency: 'CNY',
    fin: { rev2025: 7180.0, np2025: 2265.0, equity: 10120.0, dps: 4.50, revGrowth: 0.093, npMargin: 0.315, gross: 0.532 },
    consensus: { coverage: 47, targetMean: 585.0, targetHigh: 700.0, targetLow: 470.0, buy: 44, hold: 3, sell: 0 },
    source: '股价 460.20 港元（新浪财经）；2026 年 8 月初南向资金净买入 68.3 亿港元（新浪财经）。报表币种为人民币，计价币种为港币',
  },
]

/**
 * 基金。`kind` 决定生成哪些序列与字段：
 * `etf`/`lof` 有场内价格与折溢价，`open`（场外主动）只有净值，`money` 只有七日年化。
 */
export const FUNDS = [
  {
    code: '510050', market: 'SSE', kind: 'etf', name: '华夏上证50ETF', shortName: '上证50ETF',
    company: '华夏基金管理有限公司', inceptionDate: '2004-12-30', currency: 'CNY',
    managers: [{ name: '徐猛', since: '2016-11-22', annualizedReturn: 0.0812, aum: 2860.0, funds: 14 }],
    trackIndex: '000016', trackIndexName: '上证50', benchmark: '上证50指数收益率',
    fees: { management: 0.0050, custody: 0.0010, sales: 0, subscription: null, redemption: null },
    nav: 3.1640, cumNav: 5.2214, shares: 230.27e8, vol: 0.16, return2Y: 0.30, trackingError: 0.0015,
    riskLevel: 'R4 中高风险', peerCount: 132,
    source: '净值 3.0319 @2026-08-15 之前观测（新浪财经，2026-05-15）、份额 230.27 亿份 @2026-03-31、经理徐猛、成立 2004-12-30（华夏基金）；净值外推至锚定日',
  },
  {
    code: '588000', market: 'SSE', kind: 'etf', name: '华夏上证科创板50成份ETF', shortName: '科创50ETF华夏',
    company: '华夏基金管理有限公司', inceptionDate: '2020-09-28', currency: 'CNY',
    managers: [{ name: '荣膺', since: '2020-09-28', annualizedReturn: 0.1105, aum: 1520.0, funds: 9 }],
    trackIndex: '000688', trackIndexName: '上证科创板50成份指数', benchmark: '上证科创板50成份指数收益率',
    fees: { management: 0.0050, custody: 0.0010, sales: 0, subscription: null, redemption: null },
    nav: 1.8412, cumNav: 1.8412, shares: 491.20e8, vol: 0.34, return2Y: 0.95, trackingError: 0.0022,
    riskLevel: 'R4 中高风险', peerCount: 132, marketPrice: 1.8250,
    source: '场内价 1.82 @2026-08-14、单位净值 1.8338 @2026-08-13、规模约 893–905 亿、近 24 交易日净流入 302.39 亿（界面新闻/新浪财经/东方财富）',
  },
  {
    code: '161725', market: 'SZSE', kind: 'lof', name: '招商中证白酒指数(LOF)A', shortName: '招商中证白酒A',
    company: '招商基金管理有限公司', inceptionDate: '2015-05-27', currency: 'CNY',
    managers: [{ name: '侯昊', since: '2015-05-27', annualizedReturn: 0.0762, aum: 412.0, funds: 11 }],
    trackIndex: '399997', trackIndexName: '中证白酒指数', benchmark: '中证白酒指数收益率×95% + 银行活期存款利率×5%',
    fees: { management: 0.0100, custody: 0.0020, sales: 0, subscription: 0.010, redemption: 0.005 },
    nav: 0.5596, cumNav: 2.2757, shares: 411.0e8, vol: 0.27, return2Y: -0.28, trackingError: 0.0038,
    riskLevel: 'R4 中高风险', peerCount: 132, marketPrice: 0.5571,
    source: '净值 0.5742 / 累计 2.2903 @2026-06-02、规模 258.37 亿 @2026-03-31、经理侯昊、成立 2015-05-27（天天基金）；净值外推至锚定日',
  },
  {
    code: '005827', market: null, kind: 'open', name: '易方达蓝筹精选混合', shortName: '易方达蓝筹精选',
    company: '易方达基金管理有限公司', inceptionDate: '2018-09-05', currency: 'CNY',
    managers: [
      { name: '张坤', since: '2018-09-05', annualizedReturn: 0.0921, aum: 618.0, funds: 4 },
      { name: '杨思亮', since: '2026-05-23', annualizedReturn: 0.1043, aum: 96.0, funds: 3 },
    ],
    trackIndex: null, trackIndexName: null,
    benchmark: '沪深300指数收益率×45% + 恒生指数收益率×35% + 中债总指数收益率×20%',
    fees: { management: 0.0120, custody: 0.0020, sales: 0, subscription: 0.015, redemption: 0.005 },
    nav: 1.5218, cumNav: 1.7618, shares: 134.15e8, vol: 0.19, return2Y: 0.12, trackingError: null,
    riskLevel: 'R3 中风险', peerCount: 2841,
    source: '单位净值 1.4931、规模 204.16 亿 @2026-07-24；2026-03-31 规模 267.93 亿；张坤 2018-09-05 起、杨思亮 2026-05-23 起任职（天天基金/易方达）；净值外推至锚定日',
  },
  {
    code: '000198', market: null, kind: 'money', name: '天弘余额宝货币市场基金', shortName: '天弘余额宝',
    company: '天弘基金管理有限公司', inceptionDate: '2013-05-29', currency: 'CNY',
    managers: [{ name: '王登峰', since: '2019-04-24', annualizedReturn: 0.0198, aum: 8940.0, funds: 6 }],
    trackIndex: null, trackIndexName: null, benchmark: '活期存款利率（税后）',
    fees: { management: 0.0020, custody: 0.0005, sales: 0.0020, subscription: 0, redemption: 0 },
    nav: 1.0, cumNav: null, shares: 7014.0e8, yield7d: 0.00872, vol: 0.0006, return2Y: 0.0182,
    riskLevel: 'R1 低风险', peerCount: 386,
    source: '七日年化 0.8720% @2026-06-30、0.8510% @2026-06-04、规模 7081.52 亿 @2026-03-31、成立 2013-05-29（天天基金）',
  },
]

/**
 * 基金重仓股画像。生成器据此产出前十大重仓、行业配置与资产配置；
 * 权重是占基金资产净值比，指数基金贴近其跟踪指数的成分权重。
 */
export const FUND_HOLDINGS = {
  '510050': [
    ['600519', '贵州茅台', 0.1382], ['300750', '宁德时代', 0.0621], ['601318', '中国平安', 0.0574],
    ['600036', '招商银行', 0.0512], ['601899', '紫金矿业', 0.0388], ['600900', '长江电力', 0.0341],
    ['688981', '中芯国际', 0.0287], ['601398', '工商银行', 0.0265], ['600030', '中信证券', 0.0248],
    ['601012', '隆基绿能', 0.0192],
  ],
  '588000': [
    ['688981', '中芯国际', 0.1024], ['688111', '金山办公', 0.0682], ['688041', '海光信息', 0.0651],
    ['688012', '中微公司', 0.0473], ['688036', '传音控股', 0.0338], ['688008', '澜起科技', 0.0316],
    ['688187', '时代电气', 0.0294], ['688271', '联影医疗', 0.0271], ['688126', '沪硅产业', 0.0233],
    ['688396', '华润微', 0.0208],
  ],
  '161725': [
    ['600519', '贵州茅台', 0.1521], ['000858', '五粮液', 0.1387], ['000568', '泸州老窖', 0.1042],
    ['600809', '山西汾酒', 0.0968], ['002304', '洋河股份', 0.0714], ['603369', '今世缘', 0.0521],
    ['000596', '古井贡酒', 0.0498], ['600779', '水井坊', 0.0312], ['603198', '迎驾贡酒', 0.0287],
    ['000799', '酒鬼酒', 0.0193],
  ],
  '005827': [
    ['600519', '贵州茅台', 0.0942], ['00700', '腾讯控股', 0.0918], ['000858', '五粮液', 0.0871],
    ['000568', '泸州老窖', 0.0803], ['600036', '招商银行', 0.0742], ['00388', '香港交易所', 0.0651],
    ['002304', '洋河股份', 0.0578], ['03690', '美团-W', 0.0512], ['600809', '山西汾酒', 0.0464],
    ['600887', '伊利股份', 0.0398],
  ],
}
