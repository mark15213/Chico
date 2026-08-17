/**
 * Copy dictionaries for automations: the workbench entry, the page and its
 * detail column, the capsule at the top of a conversation, the deliveries in
 * it, the attach panel, and the block in a name's record.
 */

/** Simplified Chinese dictionary and key source of truth. */
export const zh = {
  'entry.label': '自动任务',
  'entry.running': '{count} 运行',
  'entry.idle': '未启用',

  'page.title': '自动任务',
  'page.lede': '盘中自动盯盘，命中后把结果推进这只标的的对话，你可以接着追问。',
  'page.new': '新建任务',
  'page.close': '返回对话',
  'page.empty': '还没有自动任务。',
  'page.emptyHint': '先加一条，例如自选涨超 3% 就提醒我。',
  'page.static': '这是静态界面：规则不会被执行，数据是示例。',

  'card.on': '运行中',
  'card.off': '已暂停',
  'card.enable': '启用',
  'card.disable': '暂停',
  'card.firedToday': '今日 {count} 次',
  'card.interpret': '自动解读',
  'card.open': '打开任务「{name}」',

  'condition.dayChange.up': '日内涨幅 ≥ {percent}%',
  'condition.dayChange.down': '日内跌幅 ≥ {percent}%',
  'condition.windowMove.up': '{minutes} 分钟内涨 ≥ {percent}%',
  'condition.windowMove.down': '{minutes} 分钟内跌 ≥ {percent}%',
  'condition.priceLevel.above': '价格上穿 {price}',
  'condition.priceLevel.below': '价格跌破 {price}',

  'scope.watchlist': '全部自选 · {count} 只',
  'scope.holding': '持仓 · {count} 只',
  'scope.names': '指定标的 · {count} 只',

  'throttle.daily': '每只每天一次',
  'throttle.cooldown': '每只间隔 {minutes} 分钟',
  'throttle.line': '{perName} · 全天上限 {cap} 条',

  'detail.none': '从中间选一条任务，这里显示它的条件、覆盖范围和触发记录。',
  'detail.condition': '触发条件',
  'detail.scope': '覆盖范围',
  'detail.throttle': '提醒频率',
  'detail.interpret': '命中后自动解读',
  'detail.interpretOn': '开：卡片之后追加一段模型解读',
  'detail.interpretOff': '关：只推卡片，想了解自己追问',
  'detail.covers': '覆盖标的',
  'detail.history': '触发记录',
  'detail.historyEmpty': '今天还没有触发。',
  'detail.preview': '推送到对话时长这样',
  'detail.close': '收起自动任务详情',

  'editor.title': '新建自动任务',
  'editor.name': '任务名称',
  'editor.namePlaceholder': '例如：自选涨超 3%',
  'editor.condition': '触发条件',
  'editor.kind.dayChange': '日内涨跌幅',
  'editor.kind.windowMove': '窗口变动',
  'editor.kind.priceLevel': '价位突破',
  'editor.direction.up': '上涨',
  'editor.direction.down': '下跌',
  'editor.direction.above': '上穿',
  'editor.direction.below': '跌破',
  'editor.threshold': '阈值 %',
  'editor.window': '窗口（分钟）',
  'editor.price': '价格',
  'editor.scope': '覆盖范围',
  'editor.scope.watchlist': '全部自选',
  'editor.scope.holding': '持仓',
  'editor.scope.names': '指定标的',
  'editor.scopeNamesHint': '价位突破只对单只标的成立，范围固定为指定标的。',
  'editor.throttle': '提醒频率',
  'editor.throttle.daily': '每只每天一次',
  'editor.throttle.cooldown': '每只间隔 30 分钟',
  'editor.cap': '全天上限',
  'editor.interpret': '命中后自动让模型解读一段',
  'editor.save': '创建任务',
  'editor.cancel': '取消',
  'editor.disabled': '静态界面，暂不能保存。',

  'strip.watching': '{count} 个任务在盯',
  'strip.firedToday': '今日 {count} 次',
  'strip.panel': '在盯「{name}」的自动任务',
  'strip.manage': '管理',

  'attach.open': '加任务',
  'attach.title': '为「{name}」加自动任务',
  'attach.description': '任务靠覆盖范围认标的。可以把这只股加进已有任务，也可以新建一条只盯它的。',
  'attach.join': '加入已有任务',
  'attach.joinEmpty': '暂时没有可加入的「指定标的」任务。覆盖全部自选或持仓的任务自己决定成员，不能手动加。',
  'attach.joinCovers': '已盯 {count} 只',
  'attach.create': '新建一条只盯「{name}」的',
  'attach.parameters': '参数',
  'attach.save': '确定',
  'attach.cancel': '取消',

  'push.attribution': '{name} 触发后推送',
  'push.ask': '接着问',
  'push.askDraft': '{name}这波是什么原因？',

  'record.title': '自动任务',
  'record.add': '加任务',
  'record.none': '还没有任务在盯这只股。',
  'record.quiet': '今日未触发',
  'record.hits': '今日 {count} 次 · {at}',

  'mark.watching': '{count} 个自动任务在盯这只标的',

  'card.ordinal': '今日第 {count} 次触发',
  'card.window': '{minutes} 分钟内 {move}',
  'card.volume': '量比 {ratio}',
  'card.reading': '解读',
}

/** English dictionary; keys follow the Chinese source. */
export const en: Record<keyof typeof zh, string> = {
  'entry.label': 'Automations',
  'entry.running': '{count} running',
  'entry.idle': 'None running',

  'page.title': 'Automations',
  'page.lede': 'Watch the session unattended; a hit lands in that name’s conversation, where you can ask about it.',
  'page.new': 'New automation',
  'page.close': 'Back to the conversation',
  'page.empty': 'No automations yet.',
  'page.emptyHint': 'Add one — tell me when a followed name gains 3%.',
  'page.static': 'Static surface: no rule is evaluated and the data is an example.',

  'card.on': 'Running',
  'card.off': 'Paused',
  'card.enable': 'Enable',
  'card.disable': 'Pause',
  'card.firedToday': '{count} today',
  'card.interpret': 'Auto reading',
  'card.open': 'Open automation “{name}”',

  'condition.dayChange.up': 'Gains ≥ {percent}% on the day',
  'condition.dayChange.down': 'Falls ≥ {percent}% on the day',
  'condition.windowMove.up': 'Gains ≥ {percent}% within {minutes} min',
  'condition.windowMove.down': 'Falls ≥ {percent}% within {minutes} min',
  'condition.priceLevel.above': 'Crosses above {price}',
  'condition.priceLevel.below': 'Falls below {price}',

  'scope.watchlist': 'Every followed name · {count}',
  'scope.holding': 'Holdings · {count}',
  'scope.names': 'Named instruments · {count}',

  'throttle.daily': 'Once per name per day',
  'throttle.cooldown': '{minutes} min between hits per name',
  'throttle.line': '{perName} · {cap} a day at most',

  'detail.none': 'Pick an automation in the centre to see its condition, coverage, and hits.',
  'detail.condition': 'Condition',
  'detail.scope': 'Coverage',
  'detail.throttle': 'Frequency',
  'detail.interpret': 'Reading after a hit',
  'detail.interpretOn': 'On: the card is followed by a short model reading',
  'detail.interpretOff': 'Off: the card alone; ask if you want more',
  'detail.covers': 'Names covered',
  'detail.history': 'Hits',
  'detail.historyEmpty': 'Nothing has fired today.',
  'detail.preview': 'How a hit reads in the conversation',
  'detail.close': 'Collapse the automation detail',

  'editor.title': 'New automation',
  'editor.name': 'Name',
  'editor.namePlaceholder': 'e.g. followed names up 3%',
  'editor.condition': 'Condition',
  'editor.kind.dayChange': 'Change on the day',
  'editor.kind.windowMove': 'Change across a window',
  'editor.kind.priceLevel': 'Price level',
  'editor.direction.up': 'Up',
  'editor.direction.down': 'Down',
  'editor.direction.above': 'Above',
  'editor.direction.below': 'Below',
  'editor.threshold': 'Threshold %',
  'editor.window': 'Window (min)',
  'editor.price': 'Price',
  'editor.scope': 'Coverage',
  'editor.scope.watchlist': 'Every followed name',
  'editor.scope.holding': 'Holdings',
  'editor.scope.names': 'Named instruments',
  'editor.scopeNamesHint': 'A price level holds for one instrument, so the coverage is fixed to named instruments.',
  'editor.throttle': 'Frequency',
  'editor.throttle.daily': 'Once per name per day',
  'editor.throttle.cooldown': '30 min between hits per name',
  'editor.cap': 'Daily cap',
  'editor.interpret': 'Ask the model for a short reading after a hit',
  'editor.save': 'Create',
  'editor.cancel': 'Cancel',
  'editor.disabled': 'Static surface — saving is not wired yet.',

  'strip.watching': '{count} watching',
  'strip.firedToday': '{count} today',
  'strip.panel': 'Automations watching {name}',
  'strip.manage': 'Manage',

  'attach.open': 'Add',
  'attach.title': 'Add an automation for {name}',
  'attach.description': 'A rule finds its names through its coverage. Add this name to a rule that has one, or build a rule that watches only this name.',
  'attach.join': 'Join an existing automation',
  'attach.joinEmpty': 'No named-instrument automation to join. Rules covering the watchlist or holdings resolve their own members and cannot take a name by hand.',
  'attach.joinCovers': 'watches {count}',
  'attach.create': 'Create one that watches only {name}',
  'attach.parameters': 'Parameters',
  'attach.save': 'Add',
  'attach.cancel': 'Cancel',

  'push.attribution': 'Pushed by {name}',
  'push.ask': 'Ask about it',
  'push.askDraft': 'What is behind this move in {name}?',

  'record.title': 'Automations',
  'record.add': 'Add',
  'record.none': 'Nothing watches this name yet.',
  'record.quiet': 'Nothing today',
  'record.hits': '{count} today · {at}',

  'mark.watching': '{count} automations watch this name',

  'card.ordinal': 'Hit {count} today',
  'card.window': '{move} within {minutes} min',
  'card.volume': '{ratio}× volume',
  'card.reading': 'Reading',
}

/** Locale key union for this package's namespace. */
export type AutomationLocaleKey = keyof typeof zh

/** Locale namespace this package registers under. */
export const NS = 'automation'

// Declared here rather than in the plugin body so the pure summaries can
// resolve their own translate type without importing the registrations.
declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Automation copy. */
    'automation': AutomationLocaleKey
  }
}
