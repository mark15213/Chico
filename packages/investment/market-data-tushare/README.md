# @deepseek-ai/dsh-market-data-tushare

English | [中文](README.zh.md)

Market-data Service Provider over the [Tushare Pro](https://tushare.pro) API: end-of-day bars, quotes, and instrument lookup for the mainland venues, registered on [`ctx.marketData`](../market-data/README.md) under the id `tushare`.

## What it serves

Shanghai (`SSE`), Shenzhen (`SZSE`), and Beijing (`BSE`), addressed by Tushare's own `ts_code` — `600519.SH`, `300750.SZ`, `430047.BJ`. A request for any other venue is refused with `MARKET_DATA_VENUE_UNSUPPORTED` before a call is spent; Tushare reaches Hong Kong and the US through separate interfaces at higher entitlements, and answering from the mainland interfaces would be wrong rather than incomplete.

**Every quote is a session close.** Tushare's `daily` interface is end-of-day, so `session` is always `closed` and `asOf` is the venue's own closing instant on the session's trading date — 07:00Z, which is 15:00 in Shanghai. A surface that needs an intraday tick needs a different provider.

Prices arrive in the venue's units and are converted once, here: `daily` reports volume in lots, so it is multiplied by 100 to reach the shares the seam's `volume` promises. `previousClose` and `changePercent` come from the venue's own `pre_close` and `pct_chg` rather than being recomputed, so they agree with what the venue published.

## Configuration

| Key | Default | What it decides |
|---|---|---|
| `tokenEnv` | `TUSHARE_TOKEN` | Credential reference holding the account token |
| `baseURL` | `https://api.tushare.pro` | The endpoint |
| `adjustment` | `none` | Corporate-action basis for returned bars |
| `rosterTtlMinutes` | `720` | How long the listing roster is held |
| `timeoutMs` | `15000` | Wall-clock budget for one call |

The token resolves through [`ctx.credentials`](../../credentials/credentials/README.md) per operation rather than being captured at startup, so a token stored after the process is running reaches the next request without a restart. `available()` is that same lookup: while no token resolves the provider reports itself unusable, which is what keeps it from being auto-selected in a composition that has another feed.

### Adjustment

`none` is as-traded and needs only the bar interface. The two restating values also read Tushare's `adj_factor`, which sits behind a **higher point threshold** than the bars, so an account below it must leave this at `none` — asking for restatement it cannot reach fails the whole call rather than silently returning as-traded prices under a restated label.

The two directions are named for what they move, not for the Chinese convention:

| Value | Restates onto | Conventional name |
|---|---|---|
| `backward` | today's basis | 前复权 |
| `forward` | the first bar's basis | 后复权 |

Volume is left as traded in both, because the adjustment the seam records describes the prices.

## Lookup and the roster

Tushare has no search endpoint, so `search` matches locally over the full listing roster (`stock_basic`, currently-listed names only). A code matches from its start and a name matches anywhere in it; results come back in the venue's listing order, because Tushare returns no relevance signal and inventing a ranking would present a guess as a measurement.

The roster is one call that every search and every quote reads, so it is fetched once and held for `rosterTtlMinutes`. Concurrent readers share one fetch: a watchlist prices every row at once and each of those quotes needs a display name, so without that sharing the first glance would download the roster once per followed name. That shared fetch deliberately does not honour any one caller's cancellation — aborting it would cancel it for every reader waiting on the same promise — and the per-call time budget bounds it instead.

## What each answer is attributed to

Every observation names the Tushare interfaces it was read from and the instant the reads finished. A quote lists `daily` and `stock_basic`, because the price comes from the bars and the display name from the roster; as-traded history lists `daily` alone, and restated history lists `daily` and `adj_factor`.

`retrievedAt` dates the price read rather than the roster, which may have been held for up to `rosterTtlMinutes`. The price is the fact a reader acts on, and dating the answer by the older of the two would understate how fresh the number is.

## Failure

Tushare reports refusals in the body rather than the status line: a revoked token and an interface the account has too few points for both arrive as HTTP 200 with a non-zero `code`. Those, transport failures, timeouts, and an undecodable body all become `MARKET_DATA_PROVIDER_UNAVAILABLE`, because all of them would fail every instrument identically — which is what makes a consumer raise for the whole call instead of degrading one row. A code the venue has no sessions for is `MARKET_DATA_UNKNOWN_INSTRUMENT`, and a venue this provider does not reach is `MARKET_DATA_VENUE_UNSUPPORTED`; both are about one request, so a list degrades that entry alone.

## Model Experience

### Tushare market data

#### What the model sees

Nothing. This package registers no tools and injects no prompts; it contributes one provider to `ctx.marketData`, and [`dsh-tool-market-data`](../tool-market-data/README.md) owns the model-facing surface built on that seam.

#### Token effect

Zero direct tokens on every request.

#### KV Cache effect

Independent of live requests: the package never touches a request prefix, so it cannot invalidate provider cache reuse.

## Known Limitations and Deferred Work

- **Mainland venues only.** Hong Kong and the US listings Tushare carries through `hk_daily` and `us_daily` are unimplemented, so those venues are refused rather than served.
- **No intraday data.** Only `daily` is read. Tushare's minute interfaces sit at a higher point threshold and would need a second seam operation, since the current one is a session bar.
- **Quotes are one instrument per call.** `daily` accepts several `ts_code` values at once, but the seam's `quote` addresses one instrument, so a watchlist of *n* names spends *n* calls per refresh. Batching needs a seam operation that takes a set.
- **The window is a heuristic, not a calendar.** Sessions are requested as calendar days at 1.75 days per session plus a 14-day floor. An unusually long closure can return fewer sessions than asked for, which the seam permits but which a caller cannot distinguish from a short listing history. A real fix reads `trade_cal`.
- **No pinyin search.** `stock_basic` carries a `cnspell` column that would let `GZMT` find 贵州茅台, but requesting a column the token is not entitled to fails the call, so the field set stays conservative.
- **Funds are unreachable.** Open-end funds have no venue and a net asset value rather than a traded price, so they do not fit `Market` or `Quote`. Serving them is a seam decision, not a provider one.
