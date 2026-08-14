# Agent Note: Price-Series Render Intent

Status: implemented

English | [中文](2026-08-15-price-series-render-intent.zh.md)

## Problem

The [tool render-intent union](2026-07-02-tool-render-intent-union.md) is a closed set — `generic`, `terminal`, `diff`, `search`, `read`, `web` — and a tool returning per-session price bars had no member that fits. `market_history` fell back to the generic card, so a professional investor reading a price series read a text table of numbers.

Text is not a substitute here. A shape over sixty sessions is what a chart carries and a table does not, and the whole point of the market-data seam is that prices are read as a series.

Two further problems sat underneath. The union's card kinds encode what the data IS, so naming a member after a drawing would be the first exception. And `ToolRow`, the shared chrome every card row composes, took its card material through a closed set of props (`terminal`, `diff`, `read`, `search`, `web`), so every new card kind meant editing a shared component — the same growth the workspace row had before [its decoration slot](2026-08-14-workspace-row-decoration-slot.md).

## Decision

### The card names the data, not the drawing

`PriceSeriesResultView` carries `card: 'price-series'` rather than `'chart'`. The tool states that its result is a series of session bars; a UI decides whether to draw candles, a line, or a table. Naming the drawing would put a rendering decision in a vocabulary whose whole purpose is that tools never import a UI type.

It is result-only, with no call view: the bars exist only after `execute`, so a pending call keeps its generic card — the arrangement `search` already uses for the same reason.

`adjustment` is required rather than optional. A chart drawn without saying which corporate-action basis its prices carry invites exactly the comparison the market-data seam refuses to allow, so the field that prevents it cannot be droppable.

The view sets no `content` copy, so a UI that does not know the card falls back to the raw result content — the bar table the tool's own text already carries. That fallback is what makes the member safe to add without every client shipping a chart.

### `ToolRow` gains a neutral card seat

`customCard?: ReactNode` takes already-rendered card material from a registrant that owns its own card kind. It ranks last in the card chain, so a call carrying a known card keeps that card and a registrant cannot override it. `ToolRow` and `toolRowModel` are exported from `dsh-client-ui-tool/client` so a registrant composes the chrome rather than forking it.

### The chart is a Chico package, not a shared primitive

`dsh-client-ui-chico-price-series` registers the keyed toolview for `market_history` and draws the candles. The card vocabulary is product-neutral and belongs in core; the investment-domain rendering is not, and [the Chico change map](../../../../products/chico/architecture/change-map.md) puts it in a Chico client package. A composition without Chico renders the generic card, which the contract already promises.

## Alternatives considered

**A general `chart` card carrying arbitrary series of points.** Rejected: OHLCV has semantics a generic point series cannot express — four prices per session, session-relative coloring, an adjustment basis. There is exactly one consumer today, and a general card with no consumer would be a speculative abstraction the packages policy forbids.

**Keeping the generic card and rendering ASCII candles in the result text.** Rejected: it puts UI formatting in the model-facing value, which the tool cookbook rules out, and it charges every model request for characters that serve only a human reader.

**Adding a `priceSeries` prop to `ToolRow` beside `web` and `search`.** Rejected: it grows a closed set that will need editing for the next card kind, and it puts an investment type in a shared component's signature. The neutral `customCard` seat solves the general problem once.

**Putting the chart in `dsh-client-ui-primitives` beside `WebBlock`.** Rejected: primitives are product-neutral and this is not. The precedent cuts the other way — `WebBlock` serves a capability every composition may enable, while a candle chart serves one product.

**Drawing a flat line for a series whose prices are all identical.** Rejected: it states a shape the data does not have. The model returns null and the row falls back to the generic card, which is honest about having nothing to plot.

## Consequences

The union has a member no default composition renders. That is intended and is the same arrangement the `web` card had before `tool-web` shipped a renderer, but it does mean an incapable UI silently shows the text fallback rather than reporting that a richer card exists.

Volume travels in the render intent and the chart discards it. The field is carried because the tool has it and a later volume lane should not need a contract change; today it is unused.

`ToolRow` now has an escape hatch a registrant can misuse to render anything at all. The ranking rule bounds the damage — a known card always wins — but nothing type-checks that a registrant's element belongs in a tool row.

## Testing

`packages/investment/tool-market-data/tests` covers the presentation-meta round trip and every fallback to the generic card: an errored call, absent metadata, a non-object, an array, malformed bars, and an unknown adjustment. `packages/client/ui-chico-price-series/tests` covers model derivation, unit-box geometry, the running-call and unknown-card fallbacks, the empty and flat series, doji hairline rendering, the assistive label, and keyed registration with fiber teardown proving removal.
