# investment/ — investment domain family

English | [中文](README.zh.md)

This family provides the investment-domain capabilities the Chico workbench is built from: provider-neutral market access and the model-facing tools that consume it. Product intent for these capabilities lives under [`products/chico/`](../../products/chico/README.md); this family owns the shipped contracts.

| Package | Role | ctx key |
|---|---|---|
| [`market-data/`](market-data/README.md) | Defines market-data provider registration, selection, and shared errors | `ctx.marketData` |
| [`market-data-fixture/`](market-data-fixture/README.md) | Provides a deterministic instrument table and bar series for keyless tests and demos | registers on `ctx.marketData` |

Every package here stays provider-neutral and product-neutral in its own contract: venue-specific behavior belongs to a provider package, and workbench presentation belongs to a client plugin. A capability that turns out to be useful outside investing belongs in its own family rather than here.
