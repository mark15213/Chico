# @deepseek-ai/dsh-chico-web-app

English | [中文](README.zh.md)

The Chico investment-surface bundle: a patch layer over [`dsh-web-app`](../web-app/README.md) that turns the browser surface into an investment workbench. It boots as the `chico` profile — `dsh-base`, then `dsh-web-app`, then this layer — so it stacks on the browser surface rather than replacing it, and a fix there reaches Chico without a second edit.

## What the layer inserts

| Row | Package | Why |
|---|---|---|
| `market-data` | `dsh-market-data` | The capability seam quotes and bars resolve through |
| `market-data-fixture` | `dsh-market-data-fixture` | The only provider in this composition |
| `tool-market-data` | `dsh-tool-market-data` | `market_quote` and `market_history` |

The browser roster needs no row. The price-series card is part of the shared render-intent union, so `dsh-client-ui-tool` already renders a completed history call as a candle chart — every composition that has the web surface gets the chart with the tools.

`market-data` pins no `provider`. Selection therefore resolves to the single usable one, and a deployment with a licensed feed adds its provider row and pins the id in a later patch layer instead of editing this one.

**Every price this composition shows is fixture data.** The deterministic provider exists so the surface boots and demonstrates without a venue entitlement; a deployment that must not present synthetic prices as real disables that row in the same layer that adds a feed.

## What it deliberately does not do

The layer adds capability and never removes surface: it disables no row from the layer below, because that would be surface policy `dsh-web-app` already decided. It also carries no runtime glue — the plugin body is empty. A Chico-specific service belongs in its own package, where a composition that patches differently can still see it.

Without the browser roster entry the history tool still works and renders its bar table through the generic card, which is what the price-series render intent promises an incapable UI. The row is an improvement, not a requirement.

## Model Experience

Indirectly, through the `dsh-tool-market-data` rows this layer inserts, which own the model-facing tools and prompt guidance.

#### KV Cache effect

None; the bundle itself neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **No licensed provider ships with it.** The composition is demonstrable but not usable for real decisions until a feed row is added; nothing in the surface currently marks fixture prices as synthetic at the point of display.
- **No investment-specific surface beyond the chart.** Followed names, the dossier panel, and Today are designed but unbuilt; see [the Chico workbench design](../../../products/chico/workbench-design.md).
