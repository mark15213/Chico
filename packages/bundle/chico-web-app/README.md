# @deepseek-ai/dsh-chico-web-app

English | [中文](README.zh.md)

The Chico investment-surface bundle: a patch layer over [`dsh-web-app`](../web-app/README.md) that turns the browser surface into an investment workbench. It boots as the `chico` profile — `dsh-base`, then `dsh-web-app`, then this layer — so it stacks on the browser surface rather than replacing it, and a fix there reaches Chico without a second edit.

## What the layer inserts

| Row | Package | Why |
|---|---|---|
| `market-data` | `dsh-market-data` | The capability seam quotes and bars resolve through |
| `market-data-mock` | `dsh-market-data-mock` | The feed: a dataset compiled into the package, served with no credential and no network |
| `tool-market-data` | `dsh-tool-market-data` | `market_quote` and `market_history` |

The browser roster needs no row. The price-series card is part of the shared render-intent union, so `dsh-client-ui-tool` already renders a completed history call as a candle chart — every composition that has the web surface gets the chart with the tools.

`market-data` pins no `provider`. Selection therefore resolves to the single usable one, and a deployment with a second feed adds its provider row and pins the id in a later patch layer instead of editing this one.

### The feed

> **Every price this composition shows is synthetic.** The [mock provider](../../investment/market-data-mock/README.md) answers from a dataset compiled into its package, with no credential and no network.

This is a composition for building and demonstrating the workbench. A live venue feed makes the surface unusable exactly when the venue API is slow, rate-limited, or unreachable — one failed request empties the watchlist and leaves a conversation without a quote — and none of that is the surface being built. The dataset's magnitudes, volatilities, and 52-week ranges are calibrated against real August-2026 observations, so a chart draws realistic shapes without depending on a venue being up.

Quotes carry `session: 'closed'` and bars carry `adjustment: none`: the dataset is end-of-day and carries no corporate actions, so both are accurate by construction rather than by convention.

**A deployment whose readers might act on the numbers replaces this row.** `@deepseek-ai/dsh-market-data-tushare` remains in the workspace and takes a `TUSHARE_TOKEN` credential reference; swapping the row is the whole change, because `market-data` pins no `provider` and selection resolves to the single usable one. Note that nothing in the current surface marks a price as synthetic at the point of display.

## What it deliberately does not do

The layer adds capability and never removes surface: it disables no row from the layer below, because that would be surface policy `dsh-web-app` already decided. It also carries no runtime glue — the plugin body is empty. A Chico-specific service belongs in its own package, where a composition that patches differently can still see it.

Without the browser roster entry the history tool still works and renders its bar table through the generic card, which is what the price-series render intent promises an incapable UI. The row is an improvement, not a requirement.

## Model Experience

Indirectly, through the `dsh-tool-market-data` rows this layer inserts, which own the model-facing tools and prompt guidance.

#### KV Cache effect

None; the bundle itself neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **Mainland venues only.** The shipped feed serves Shanghai, Shenzhen, and Beijing. A followed name listed in Hong Kong or the US is refused per instrument, so its row appears without a price rather than failing the page.
- **End-of-day only.** No row here can show an intraday price, and nothing in the surface currently marks a quote as a session close at the point of display.
- **No investment-specific surface beyond the chart.** Followed names, the dossier panel, and Today are designed but unbuilt; see [the Chico workbench design](../../../products/chico/workbench-design.md).
