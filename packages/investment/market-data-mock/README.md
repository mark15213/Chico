# @deepseek-ai/dsh-market-data-mock

English | [中文](README.zh.md)

Mock market-data Service Provider: ten instruments with 500 daily sessions each, compiled into the package and served over [`ctx.marketData`](../market-data/README.md) with no credential and no network. It registers under the id `mock`.

> **Every price this package serves is synthetic.** Nothing here is a venue record. Mount it to build, demonstrate, and test an investment surface; never in a deployment whose readers might act on the numbers.

## Why a composition would mount it

A live venue feed makes a workbench unusable exactly when the venue API is slow, rate-limited, or unreachable — and none of that is the surface being built. One failed request empties a watchlist and leaves a conversation without a quote, which is a property of the network rather than of the product. This provider removes that variable: it answers from memory, so the surface can be exercised, screenshotted, and replayed the same way every time.

The dataset's magnitudes, volatilities, and 52-week ranges are calibrated against real observations from August 2026, so the shapes a chart draws are realistic even though the prices are not real. [`mock-data/README.md`](../../../mock-data/README.md) records every anchor's source and the invariants the series satisfy.

## What it carries

Six equities — `SSE:600519`, `SZSE:300750`, `SSE:600036`, `SSE:688981`, `SZSE:002594`, `HKEX:00700` — and four benchmark indices addressed as instruments: `SSE:000300`, `SSE:000001`, `SZSE:399006`, `HKEX:HSI`. Anything else is refused with `MARKET_DATA_UNKNOWN_INSTRUMENT` rather than synthesized, so a request that meant to reach a real feed fails loudly instead of quietly reading invented prices.

Bars report `adjustment: 'none'`, which is accurate rather than conventional: the compiled series carry no corporate actions, so their prices are as-traded by construction. Quotes report `session: 'closed'` — the dataset is end-of-day, whatever the wall clock says.

Every observation is attributed to the `chico-mock-data` dataset with a null `retrievedAt`. The provider reads generated values compiled into the package rather than acquiring them from an external source, so it records that absence instead of inventing a retrieval time.

`disabled: true` takes the provider out of selection, so a composition that mounted it by accident fails with `MARKET_DATA_PROVIDER_UNAVAILABLE` instead of presenting invented closes as a venue's own.

## The compiled dataset

`src/dataset.ts` is generated and committed. Regenerate it after changing the source dataset:

```sh
node mock-data/generate.mjs                                   # rebuild mock-data/data
node packages/investment/market-data-mock/scripts/build-dataset.mjs   # recompile this package's module
```

The provider ships the compiled module rather than reading `mock-data/` at runtime, because a published package cannot reach a directory that exists only in this checkout. Columns rather than an array of bar objects: the same 500 sessions cost about a third as much source text, and the provider rebuilds bar objects on read.

## Model Experience

### Mock market data

#### What the model sees

Nothing. This package registers no tools and injects no prompts; it contributes one provider to `ctx.marketData`, and a tool package built on that seam owns the model-facing surface.

#### Token effect

Zero direct tokens on every request.

#### KV Cache effect

Independent of live requests: the package never touches a request prefix, so it cannot invalidate provider cache reuse.

## Known Limitations and Deferred Work

- **The dataset ends on a fixed anchor date and never advances.** Prices are as of 2026-08-14 forever, so a surface that compares them against the wall clock reports a series that is stale by however long the checkout has existed.
- **Off-exchange funds are absent.** The source dataset carries two, but `Market` is a closed union with no member for a fund that trades on no venue, so they have no address on this seam.
- **Lookup matches by prefix and substring only.** No pinyin, no fuzzy matching, and no ranking — the table is small enough that a ranking would be an invention rather than a measurement.
- **The window is the trailing one.** A request for a date range that ends before the anchor cannot be expressed; the seam has no such request.
