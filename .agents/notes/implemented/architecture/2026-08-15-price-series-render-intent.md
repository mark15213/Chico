# Agent Note: Price-Series Render Intent

Status: implemented

English | [中文](2026-08-15-price-series-render-intent.zh.md)

## Problem

The [tool render-intent union](2026-07-02-tool-render-intent-union.md) is a closed set — `generic`, `terminal`, `diff`, `search`, `read`, `web` — and a tool returning per-session price bars had no member that fits. `market_history` fell back to the generic card, so a professional investor reading a price series read a text table of numbers.

Text is not a substitute here. A shape over sixty sessions is what a chart carries and a table does not, and the whole point of the market-data seam is that prices are read as a series.

A further problem sat underneath: the union's card kinds encode what the data IS, so naming a member after a drawing would be the first exception.

## Decision

### The card names the data, not the drawing

`PriceSeriesResultView` carries `card: 'price-series'` rather than `'chart'`. The tool states that its result is a series of session bars; a UI decides whether to draw candles, a line, or a table. Naming the drawing would put a rendering decision in a vocabulary whose whole purpose is that tools never import a UI type.

It is result-only, with no call view: the bars exist only after `execute`, so a pending call keeps its generic card — the arrangement `search` already uses for the same reason.

`adjustment` is required rather than optional. A chart drawn without saying which corporate-action basis its prices carry invites exactly the comparison the market-data seam refuses to allow, so the field that prevents it cannot be droppable.

The view sets no `content` copy, so a UI that does not know the card falls back to the raw result content — the bar table the tool's own text already carries. That fallback is what makes the member safe to add without every client shipping a chart.

### The renderer lives with the other core card kinds

`dsh-client-ui-tool` owns `priceSeriesModel`, the chart, and the keyed `market_history` toolview, exactly as it owns the `web`, `search`, `read`, `diff`, and `terminal` renderers.

The first attempt put the chart in a Chico client package on the reasoning that investment rendering is product-specific. The build rejected it: **client bundle purity forbids cross-plugin value imports**, so a product package cannot import `ToolRow` and must collaborate through cordis services instead. The failure exposed the better rule — a card kind that lives in the shared render-intent union has its renderer in the shared client package, because the union is what makes it shared in the first place. Keying a toolview on a specific tool name is the same thing `web-row` already does with `web_search` and `web_fetch`.

The consequence is that the chart ships with the browser surface rather than with the Chico bundle: any composition carrying `dsh-client-ui-tool` renders a price-series card when one arrives, and a composition without the market-data tools simply never sees one.

### The chart opens without a click

Every other card row starts collapsed so a run of tool calls stays scannable, and the price-series row shipped that way first. A real run showed the default is wrong for this card: the row read `History SZSE:300750` like any other, the model restated the series in prose underneath it, and the chart went unseen — the one thing the seam exists to deliver was the one thing not shown.

The rule that separates the two is what the card is to the reader. A read or a grep card is the work behind an answer and gets skimmed past; a price series is the answer. `ToolRow` therefore takes `startExpanded`, which the row sets, rather than `ui-tool` naming price series in shared chrome.

The flag is honored on the transition to true, not at mount alone. A row mounts while its call is still running and carries no card yet, so a mount-only decision would leave every live chart shut and open only on reload. A collapse the reader chooses afterwards stands, because the flag flips once.

## Alternatives considered

**A general `chart` card carrying arbitrary series of points.** Rejected: OHLCV has semantics a generic point series cannot express — four prices per session, session-relative coloring, an adjustment basis. There is exactly one consumer today, and a general card with no consumer would be a speculative abstraction the packages policy forbids.

**Keeping the generic card and rendering ASCII candles in the result text.** Rejected: it puts UI formatting in the model-facing value, which the tool cookbook rules out, and it charges every model request for characters that serve only a human reader.

**A neutral `customCard?: ReactNode` seat on `ToolRow`, filled by a product package.** Built first, then reverted: client bundle purity forbids the cross-plugin value import a product package would need to compose the row, and the seat only existed to serve that arrangement. A general escape hatch also weakens the invariant that a row's card material is derived from a known render intent.

**Putting the chart in `dsh-client-ui-primitives` beside `WebBlock`.** Rejected as unnecessary rather than wrong: the chart has one call site, and `ui-tool` already hosts `GenericToolCard`. It moves to primitives when a second surface needs it.

**Opening every card kind by default instead of one.** Rejected: a turn that reads four files and greps twice would become six open cards, which is the reason the collapsed default exists. The flag is per row so each card kind states what it is to the reader.

**A `ToolRow` branch that opens when `priceSeries` is present.** Rejected: it puts one card kind's editorial judgement in chrome shared by every row, and the next card that wants it would add a second branch. One boolean the row sets keeps the decision with the row that owns the card.

**Rendering the chart in the assistant message rather than on a tool row.** Deferred, not rejected: it would put the series where the reader already looks and drop the row question entirely, but it needs a way for a tool result to contribute to message content, which no render intent has today. Worth revisiting when a second tool wants the same placement.

**Drawing a flat line for a series whose prices are all identical.** Rejected: it states a shape the data does not have. The model returns null and the row falls back to the generic card, which is honest about having nothing to plot.

## Consequences

The union has a member no default composition renders. That is intended and is the same arrangement the `web` card had before `tool-web` shipped a renderer, but it does mean an incapable UI silently shows the text fallback rather than reporting that a richer card exists.

Volume travels in the render intent and the chart discards it. The field is carried because the tool has it and a later volume lane should not need a contract change; today it is unused.

A turn that charts several names shows several open charts at once, since each row decides for itself. That is the intended reading order for a comparison and the cost of the flag being per row; a turn that charts many names will want a different surface than a transcript.

`dsh-client-ui-tool` now knows one investment tool name. That is the same coupling `web-row` already carries for the web tools, and it is what keying a toolview costs; the alternative the purity gate rules out would have cost a duplicated row chrome instead.

## Testing

`packages/investment/tool-market-data/tests` covers the presentation-meta round trip and every fallback to the generic card: an errored call, absent metadata, a non-object, an array, malformed bars, and an unknown adjustment. `packages/client/ui-tool/tests/price-series.client.spec.tsx` covers model derivation, unit-box geometry, the running-call and unknown-card fallbacks, the empty and flat series, doji hairline rendering, the assistive label, keyed registration with fiber teardown proving removal, and the three expansion states: open at mount, open on settling after mount, and staying shut once the reader collapses it.
