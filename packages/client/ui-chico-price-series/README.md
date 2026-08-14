# @deepseek-ai/dsh-client-ui-chico-price-series

English | [中文](README.zh.md)

Chico toolview plugin: the keyed `tool.call.toolview` registrant for `market_history`. It composes the shared [ToolRow](../ui-tool/README.md) chrome and supplies a candle chart as the row's `customCard`, so a price series renders through the same collapsed-by-default interaction every other card row has.

`priceSeriesModel` is the one place that turns the `card: 'price-series'` render intent off the snapshot's `resultView` into what the chart draws; both the chart geometry and the header summary derive from it once.

## The generic-card fallbacks

The chart is result-only, so a running call shows the summary line alone — the market-data tools keep a generic pending card. A settled call also takes the generic path when its result view is a generic card (a failed call), when its `card` tag is one this UI version does not know (the value arrives over the wire from a newer host and cannot be trusted to be a compiled variant), when the series is empty, or when every price in it is identical. The last case is deliberate: a flat series has no range, and drawing a line at an arbitrary height would state a shape the data does not have.

A composition that does not load this package keeps the generic card and the bar table the tool's own result text carries, which is exactly what the `price-series` render intent promises an incapable UI.

## Presentation

The unit box counts upward from the series low while SVG counts downward, so the component inverts once at the draw site and does no other arithmetic — every value arrives already derived. A session with no body height (open equal to close) draws a hairline instead of a zero-height rectangle so it stays visible.

Colors follow the local market convention the product serves, red for a rising session and green for a falling one, drawn from theme tokens so both themes resolve. The adjustment is always shown beside the range, because a chart that does not say which corporate-action basis its prices carry invites exactly the comparison the market-data seam exists to prevent.

## Model Experience

None, as this package renders a completed tool call in the browser; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **No hover readout or crosshair.** The chart states the series summary and the range; reading one session's values means reading the tool's result text. Per-bar interaction needs a pointer model the row's expand gesture does not currently share.
- **Volume is carried but not drawn.** The render intent includes per-session volume and the model discards it; a volume lane needs its own vertical budget inside the row.
- **One series per card.** Comparing two instruments on one axis needs a render intent that carries several series, not a client-side merge.
