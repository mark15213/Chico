# @deepseek-ai/dsh-chico-web-app

English | [中文](README.zh.md)

The Chico investment-surface bundle: a patch layer over [`dsh-web-app`](../web-app/README.md) that turns the browser surface into an investment workbench. It boots as the `chico` profile — `dsh-base`, then `dsh-web-app`, then this layer — so it stacks on the browser surface rather than replacing it, and a fix there reaches Chico without a second edit.

## What the layer inserts

| Row | Package | Why |
|---|---|---|
| `followed-names` | `dsh-followed-names` | The durable followed list and its shared investment archive directory |
| `market-data` | `dsh-market-data` | The capability seam quotes and bars resolve through |
| `market-data-mock` | `dsh-market-data-mock` | The feed: a dataset compiled into the package, served with no credential and no network |
| `tool-market-data` | `dsh-tool-market-data` | `market_quote` and `market_history` |
| `name-record` | `dsh-name-record` | The stance, decision chain, and conversations bound to one instrument |
| `watchlist` | `dsh-watchlist` | The Host-side Remote projection joining followed names, records, and market data |
| `ui-watchlist` | `dsh-client-ui-watchlist` | The investing frame: followed names, name-specific conversation opening, record panel, and workbench chart |

`ui-watchlist` registers the `names` frame beside the ordinary `sessions` frame. It replaces the left and right column occupants together, while the centre keeps the shared conversation body and receives a name-specific opening. The price-series card itself remains part of the shared render-intent union, so `dsh-client-ui-tool` renders a completed history call even without Chico; the workbench row supplies the richer chart for conversations bound to an open name.

`market-data` pins no `provider`. Selection therefore resolves to the single usable one, and a deployment with a second feed adds its provider row and pins the id in a later patch layer instead of editing this one.

### The feed

> **Every price this composition shows is synthetic.** The [mock provider](../../investment/market-data-mock/README.md) answers from a dataset compiled into its package, with no credential and no network.

This is a composition for building and demonstrating the workbench. A live venue feed makes the surface unusable exactly when the venue API is slow, rate-limited, or unreachable — one failed request empties the watchlist and leaves a conversation without a quote — and none of that is the surface being built. The dataset's magnitudes, volatilities, and 52-week ranges are calibrated against real August-2026 observations, so a chart draws realistic shapes without depending on a venue being up.

Quotes carry `session: 'closed'` and bars carry `adjustment: none`: the dataset is end-of-day and carries no corporate actions, so both are accurate by construction rather than by convention.

**A deployment whose readers might act on the numbers replaces this row.** `@deepseek-ai/dsh-market-data-tushare` remains in the workspace and takes a `TUSHARE_TOKEN` credential reference; swapping the row is the whole change, because `market-data` pins no `provider` and selection resolves to the single usable one. Note that nothing in the current surface marks a price as synthetic at the point of display.

## What it deliberately does not do

The layer adds capability and never removes surface: it disables no row from the layer below, because that would be surface policy `dsh-web-app` already decided. It also carries no runtime glue — the plugin body is empty. A Chico-specific service belongs in its own package, where a composition that patches differently can still see it.

Without `ui-watchlist`, the market-data tools still work and `dsh-client-ui-tool` renders `market_history` through the shared `PriceSeriesBlock`. A client that does not understand the `price-series` intent still receives the tool's model-facing bar table. The Chico row adds the investing frame and its richer chart; it is a Consumer of the capability rather than a prerequisite for it.

## Model Experience

Indirectly, through the `dsh-tool-market-data` rows this layer inserts, which own the model-facing tools and prompt guidance.

#### KV Cache effect

None; the bundle itself neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **Synthetic prices are not marked where they appear.** The bundle documentation identifies the feed, but `Quote` and `PriceBar` carry no provenance field, so a rendered quote or chart looks the same as one backed by a venue.
- **The roster is fixed.** The feed serves six equities and four benchmark indices across Shanghai, Shenzhen, and Hong Kong. Every other instrument is refused rather than synthesized.
- **End-of-day only.** No row here can show an intraday price, and nothing in the surface currently marks a quote as a session close at the point of display.
- **The investment loop is manual and price-only.** The frame lists names and conversations and the record panel writes and settles decision-chain entries, but it does not extract entries from conversation, attribute moves, or show fundamentals, filings, ownership, or Today; see the [workbench design](../../../products/chico/workbench-design.md).
