# @deepseek-ai/dsh-chico-web-app

English | [中文](README.zh.md)

The Chico investment-surface bundle: a patch layer over [`dsh-web-app`](../web-app/README.md) that turns the browser surface into an investment workbench. It boots as the `chico` profile — `dsh-base`, then `dsh-web-app`, then this layer — so it stacks on the browser surface rather than replacing it, and a fix there reaches Chico without a second edit.

## What the layer inserts

| Row | Package | Why |
|---|---|---|
| `market-data` | `dsh-market-data` | The capability seam quotes and bars resolve through |
| `market-data-tushare` | `dsh-market-data-tushare` | The venue feed: end-of-day data for the mainland venues |
| `tool-market-data` | `dsh-tool-market-data` | `market_quote` and `market_history` |

The browser roster needs no row. The price-series card is part of the shared render-intent union, so `dsh-client-ui-tool` already renders a completed history call as a candle chart — every composition that has the web surface gets the chart with the tools.

`market-data` pins no `provider`. Selection therefore resolves to the single usable one, and a deployment with a second feed adds its provider row and pins the id in a later patch layer instead of editing this one.

### Configuring the feed

The composition needs a Tushare account token, held as the credential reference `TUSHARE_TOKEN` and never as a value in a shipped file. Any layer the base bundle's credentials seam reads supplies it: the environment, `$DSH_HOME/.env`, the project `.env`, or the managed store. Without one the provider reports itself unusable and the seam refuses every read with `MARKET_DATA_PROVIDER_UNAVAILABLE` — a loud failure rather than an empty column, because a composition that cannot price anything is a configuration error and not missing data.

**Every price this composition shows is a session close.** Tushare serves end-of-day data, so quotes carry `session: 'closed'` and an `asOf` of the venue's own closing instant. The row ships `adjustment: none`, which is as-traded: restatement reads a second Tushare interface behind a higher point threshold, so an account that has it sets `backward` on this row and gets history on today's basis.

`dsh-market-data-fixture` is deliberately **not** in this composition. It backs package tests and keyless replay; a workbench that mounted it would present invented closes as the venue's own.

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
