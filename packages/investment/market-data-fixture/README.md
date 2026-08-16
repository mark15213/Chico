# @deepseek-ai/dsh-market-data-fixture

English | [中文](README.zh.md)

Deterministic market-data Service Provider: a fixed instrument table and a reproducible bar series that let keyless snapshots, demos, and tests exercise [`ctx.marketData`](../market-data/README.md) without a venue entitlement. It registers under the id `fixture`.

## Determinism

Every value derives from the instrument's symbol and the configured `anchorDate`, so two runs on two machines agree. The series is a closed-form mix of two sine terms rather than a pseudo-random generator, which means any single session can be computed without walking the series, and nothing here reads the clock — a provider whose output moved with wall time could not back a replayable snapshot.

`anchorDate` (default `2026-08-14`) is the trading date the series ends on. `quote` prices that session against the one before it, and `priceHistory` returns the requested count of sessions ending there, oldest first.

`available()` is always true: a fixture table has no credential and no network, so it has nothing to lose.

## What the table carries

Three instruments — `SZSE:300750`, `SSE:600519`, and `SZSE:300274` — each with a display name, currency, and anchor close. Anything else is refused with `MARKET_DATA_UNKNOWN_INSTRUMENT` rather than synthesized, so a test that meant to reach a real provider fails loudly instead of quietly reading invented prices.

Bars report `adjustment: 'none'`, which is accurate rather than conventional: the series is synthetic and carries no corporate actions, so its prices are as-traded by construction.

Every observation is attributed to the `fixture-table` dataset with a null `retrievedAt`. Nothing was acquired here — the values are computed — and recording the absence keeps the provider deterministic while making a synthetic close impossible to mistake for a venue's own.

## Model Experience

### Fixture market data

#### What the model sees

Nothing. This package registers no tools and injects no prompts; it contributes one provider to `ctx.marketData`, and a tool package built on that seam owns the model-facing surface.

#### Token effect

Zero direct tokens on every request.

#### KV Cache effect

Independent of live requests: the package never touches a request prefix, so it cannot invalidate provider cache reuse.

## Known Limitations and Deferred Work

- **Trading dates skip weekends but not holidays.** A series crossing a market holiday reports a session that did not trade. Modeling venue calendars needs a real calendar source, which belongs to a real provider rather than to a fixture.
- **Prices are plausible, not realistic.** The series has no gaps, no limit moves, and no volume spikes around events, so it cannot stand in for real data when testing behavior that depends on those.
- **The table is fixed in source.** Adding an instrument is a code change; there is no configuration path, because a configurable fixture would let two deployments disagree about what `fixture` means.
