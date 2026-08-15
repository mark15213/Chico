# @deepseek-ai/dsh-client-ui-watchlist

English | [中文](README.zh.md)

**Watchlist** tab for the Web conversation view ring. The browser plugin registers one localized `conversation.view` contribution with id `watchlist` at order 20, beside the chat and trajectory tabs; the conversation body owns the ring chrome and renders one tab at a time. Mounting the tab calls `ctx.remote.watchlist.list()` through [`api-remotes`](../../api/remotes/README.md), which serves the [watchlist projection](../../investment/watchlist/README.md).

Each row is a followed name, its `MARKET:SYMBOL` identity, its last price with the venue's currency, and the signed change. A row whose quote is absent keeps its place and reads **No quote** — the record is intact, and a suspended name is exactly the one a user needs to see. The one form on the tab follows a name by venue and code; the display name comes back from the venue rather than from anything typed here.

The tab is useful with an empty record: an empty watchlist states how to fill it instead of rendering a blank panel. Loading, failure, and retry stay local to the mounted component, and a failed read never exposes transport detail.

## The ring holds a tab whose data is not session-scoped

The `conversation.view` slot is session-scoped, and the watchlist is one book that is the same in every session. The tab lives here anyway because that is where a professional switches between reading a conversation and reading positions; the component takes nothing from the session snapshot, so every session shows the same rows.

## Direction is carried twice

Price direction follows the local market convention the product serves — red for up, green for down — through theme tokens so both themes resolve. The sign is also in the text and the direction is on a `data-direction` attribute, so a row survives grayscale, color vision deficiency, and a test that reads the DOM.

Figures use tabular numerals so a column of prices aligns, and the change is padded to a fixed width for the same reason.

## Model Experience

None, as this package renders a browser tab over a Host-owned projection and registers nothing model-facing.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **One read per mount or explicit refresh** — the tab does not subscribe to quote changes or refetch on reconnect, so an open watchlist is as stale as its last read.
- **Prices are shown to two decimals** — that is what the venues served today price in; a venue with finer ticks makes decimal places a per-venue fact this component does not yet carry.
- **A name is followed by code, not by search** — there is no symbol lookup, so a user must already know the venue and the code. A search over listings is the missing half of this form.
- **No row opens anything** — a row is a figure, not a way into the name. The dossier the [workbench design](../../../products/chico/workbench-design.md) puts in the details column is the next surface, and until it exists the tab reads rather than navigates.
