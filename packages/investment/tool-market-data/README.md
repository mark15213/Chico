# @deepseek-ai/dsh-tool-market-data

English | [中文](README.zh.md)

Model-facing `market_quote` and `market_history` tools over [`ctx.marketData`](../market-data/README.md). This package owns schemas, argument validation, prompt guidance, bounds, and presentation — never concrete providers.

## Shape

- **`market_quote`** — `market` (venue enum) and `symbol`. Returns name, currency, last, previous close, change percent, volume, the observation instant, and the venue session state.
- **`market_history`** — the same instrument arguments plus optional `sessions` (default 60). Returns the corporate-action adjustment and the session bars, oldest first.

Instrument arguments are flat rather than a nested object: a model produces `market` and `symbol` more reliably as two named strings, and `market` is an enum mirroring the seam's closed `Market` union so an unknown venue is rejected by schema validation rather than by the provider.

A successful `market_history` result declares the shared `price-series` render intent with the bars and adjustment in replayable result metadata. `dsh-client-ui-tool` renders that intent as an expanded candle chart; a client that does not understand the intent still receives the model-facing bar table, while an errored call or malformed replay metadata falls back to the generic result card.

Enablement controls registration. An enabled tool stays visible when no provider is usable and fails at execution time with the seam's structured error, so a composition never advertises a capability that silently returns nothing.

## Model Experience

### `market_quote` and `market_history`

#### What the model sees

The generated [`market_quote` and `market_history` schemas](../../../docs/tool-catalog.md#deepseek-aidsh-tool-market-data), plus one standing prompt section. Session bounds and timeout budgets are deployment settings, not model arguments. Quote results always state the as-of instant and whether the venue was open, because a price the model cannot date is a price it cannot reason about; a positive change carries an explicit `+` so the sign is never ambiguous; and history results lead with the session count and the adjustment before the rows.

##### Market-data guidance

```markdown
Use market_quote for one instrument's latest price and market_history for its recent daily sessions. Both report the observation time and, for history, the corporate-action adjustment; state those when the answer depends on them, and never compare prices across different adjustments.
```

#### Token effect

One fixed prompt paragraph plus two tool schemas whenever the package is loaded. Per-call result size is bounded by `sessions`: one bar is one line, so the default 60 sessions is roughly 60 lines.

#### KV Cache effect

The prompt section is static for the lifetime of the package mount, so it stays in the reusable prompt prefix and does not change across turns.

## Known Limitations and Deferred Work

- **One instrument per call.** A watchlist refresh issues one call per name. A batch operation needs its own partial-failure semantics and belongs to the seam first.
- **No fundamentals, filings, or corporate actions.** Those are separate capabilities; this package covers prices only.
