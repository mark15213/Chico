# @deepseek-ai/dsh-client-ui-watchlist

English | [中文](README.zh.md)

**Watchlist** tab for the Web conversation view ring. The browser plugin registers one localized `conversation.view` contribution with id `watchlist` at order 20, beside the chat and trajectory tabs; the conversation body owns the ring chrome and renders one tab at a time. Mounting the tab calls `ctx.remote.watchlist.list()` through [`api-remotes`](../../api/remotes/README.md), which serves the [watchlist projection](../../investment/watchlist/README.md).

Each row is a followed name, its `MARKET:SYMBOL` identity, its last price with the venue's currency, and the signed change. A row whose quote is absent keeps its place and reads **No quote** — the record is intact, and a suspended name is exactly the one a user needs to see.

Above the rows is one search field. Typing looks up listings by code or name, and each match carries either a follow control or the note that it is already on the list; the display name comes back from the venue rather than from anything typed here. The picker renders under the field rather than over the rows, so a match can be compared against what is already followed without dismissing anything.

Clicking a row's name opens that name inside the same tab: the figures, a candle chart of the last sixty sessions, and when the record started, with a way back to the list. The page replaces the list rather than opening beside it, because the details column still belongs to the tool inspector — [the open question](../../../products/chico/workbench-design.md) about who owns that column stays open until the dossier has content worth the argument.

The tab is useful with an empty record: an empty watchlist states how to fill it instead of rendering a blank panel. Loading, failure, and retry stay local to the mounted component, and a failed read never exposes transport detail.

## Two surfaces, one feed

The package registers twice: the tab, and a pinned list above the sidebar's session browser (`sidebar.pinned`). Both render the same rows, so following a name in the tab moves the sidebar with it.

The rows are not a slot `store` handle. A handle carries one scope, and these two slots do not share one — the view ring is session-scoped, the sidebar is root-scoped — while the rows are neither: they are one book, the same in every session. So the plugin owns a plain observable and hands both registrations the same subscription. A refresh requested while one is in flight joins it, because both surfaces refresh on mount.

The sidebar half rides `ctx.slots.inject`, so a composition without `ui-sidebar` gets the tab and nothing else.

The pinned list is a display, not navigation: its rows do not open anything. The sidebar is root-scoped, and neither surface that could receive a name — the view ring, the details column — is reachable from there. It is capped at eight names and says how many it left out, because the pinned region takes its own height and must not squeeze the session browser.

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
- **Lookup shows a flat list with no grouping or ranking of its own** — matches arrive in the provider's order, so a query that names many listings offers no way to narrow by venue or by kind.
- **The name page carries figures and a chart, and nothing recorded** — notes, insights, financials, and filings are all absent, so the page states what the market says about a name and nothing the user has said about it.
- **The page replaces the list rather than sitting beside it** — a reader cannot compare a name against the rest of the watchlist without going back, which is the cost of leaving the details column to the tool inspector.
