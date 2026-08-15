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
  'emptyHint': '在上面搜索代码或名称，加入第一只标的。',
  'lookup.label': '搜索标的',
  'lookup.placeholder': '代码或名称，如 300750、宁德',
  'lookup.searching': '正在搜索…',
  'lookup.empty': '没有匹配的标的。',
  'lookup.failed': '搜索失败，请重试。',
  'lookup.add': '加入自选',
  'lookup.adding': '正在加入…',
  'lookup.addFailed': '加入失败，请重试。',
  'lookup.alreadyFollowed': '已在自选',
  'noQuote': '无报价',
  'noQuoteHint': '停牌或该提供方无法定价，记录仍在。',
  'session.closed': '已收盘',
  'unfollow': '移出自选',
  'unfollowFailed': '移出失败，请重试。',
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
  'emptyHint': 'Search above by code or name to follow the first one.',
  'lookup.label': 'Search instruments',
  'lookup.placeholder': 'Code or name, e.g. 300750',
  'lookup.searching': 'Searching…',
  'lookup.empty': 'Nothing matched.',
  'lookup.failed': 'The search failed. Try again.',
  'lookup.add': 'Follow',
  'lookup.adding': 'Following…',
  'lookup.addFailed': 'Could not follow the name. Try again.',
  'lookup.alreadyFollowed': 'On the watchlist',
  'noQuote': 'No quote',
  'noQuoteHint': 'Suspended, or the provider cannot price it. The record is intact.',
  'session.closed': 'Closed',
  'unfollow': 'Unfollow',
  'unfollowFailed': 'Could not unfollow the name. Try again.',
} satisfies Record<WatchlistLocaleKey, string>

/** Dictionary namespace owned by this plugin. */
export const NS = 'watchlist'
