/** Copy dictionaries for the watchlist view tab. */

/** Simplified Chinese dictionary and key source of truth. */
export const zh = {
  'view.watchlist': '自选',
  'title': '自选',
  'count': '{count} 只',
  'refresh': '刷新',
  'loading': '正在读取自选…',
  'error': '暂时无法读取自选。',
  'retry': '重试',
  'empty': '自选还是空的。',
  'emptyHint': '填入交易场所和代码即可加入第一只标的。',
  'add.market': '交易场所',
  'add.symbol': '代码',
  'add.symbolPlaceholder': '如 300750',
  'add.submit': '加入自选',
  'add.pending': '正在加入…',
  'add.unknown': '该交易场所没有这个代码。',
  'add.failed': '加入失败，请重试。',
  'column.name': '名称',
  'column.last': '最新价',
  'column.change': '涨跌幅',
  'noQuote': '无报价',
  'noQuoteHint': '停牌或该提供方无法定价，记录仍在。',
  'session.closed': '已收盘',
  'asOf': '数据时间 {time}',
  'unfollow': '移出自选',
  'unfollowFailed': '移出失败，请重试。',
  'market.SSE': '上交所',
  'market.SZSE': '深交所',
  'market.BSE': '北交所',
  'market.HKEX': '港交所',
  'market.NASDAQ': 'NASDAQ',
  'market.NYSE': 'NYSE',
} satisfies Record<string, string>

/** Watchlist locale key union. */
export type WatchlistLocaleKey = keyof typeof zh

/** English dictionary checked against the Chinese key set. */
export const en = {
  'view.watchlist': 'Watchlist',
  'title': 'Watchlist',
  'count': '{count} names',
  'refresh': 'Refresh',
  'loading': 'Reading the watchlist…',
  'error': 'The watchlist is temporarily unavailable.',
  'retry': 'Retry',
  'empty': 'The watchlist is empty.',
  'emptyHint': 'Enter a venue and a code to follow the first name.',
  'add.market': 'Venue',
  'add.symbol': 'Code',
  'add.symbolPlaceholder': 'e.g. 300750',
  'add.submit': 'Follow',
  'add.pending': 'Following…',
  'add.unknown': 'That venue does not list this code.',
  'add.failed': 'Could not follow the name. Try again.',
  'column.name': 'Name',
  'column.last': 'Last',
  'column.change': 'Change',
  'noQuote': 'No quote',
  'noQuoteHint': 'Suspended, or the provider cannot price it. The record is intact.',
  'session.closed': 'Closed',
  'asOf': 'As of {time}',
  'unfollow': 'Unfollow',
  'unfollowFailed': 'Could not unfollow the name. Try again.',
  'market.SSE': 'SSE',
  'market.SZSE': 'SZSE',
  'market.BSE': 'BSE',
  'market.HKEX': 'HKEX',
  'market.NASDAQ': 'NASDAQ',
  'market.NYSE': 'NYSE',
} satisfies Record<WatchlistLocaleKey, string>

/** Dictionary namespace owned by this plugin. */
export const NS = 'watchlist'
