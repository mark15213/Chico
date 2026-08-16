# @deepseek-ai/dsh-client-ui-watchlist

English | [中文](README.zh.md)

The **investing frame**: what Chico adds to the harness frame. It registers one navigation frame in the sidebar (`sidebar.mode`, id `names`, labelled Investing), one detail column keyed to that frame (`details`), and that frame's own blank-conversation opening (`conversation.hero`). Switching to the frame swaps the left column to the followed names, the right column to what the conversation rests on and the open name's record, and the centre column's opening to the name being discussed; the conversation body itself stays [ui-conversation](../ui-conversation/README.md)'s.

The left column lists followed names **in follow order**, each with its price, its signed change, and a marker when one of its theses is still waiting to be settled. Sorting by anything the market decides would reshuffle the column under the reader between two glances. Above the list, one search field looks up listings by code or name; a match can be opened without being followed, so "let me look at this first" works. The open name expands to its own conversations — "what did I say about this one last week" is answered beside the name rather than in a global list sorted by time.

Opening a name moves all three columns: the details column is revealed, and the centre column navigates to that name's newest conversation, or opens its first. Collapsing the details column keeps the open name and conversation unchanged; selecting or re-selecting a name reveals the column again.

Conversations here belong to **no Workspace**. They run at the [followed-names](../../investment/followed-names/README.md) archive directory, through `sessions.startAt(cwd)`, so produced files land somewhere durable and no folder appears for a name someone merely glanced at. The Workspace flow is the right way in when the reader's unit of work is a project; under a name it would stand between them and their first word about a stock. This package's `conversation.hero` entry is what removes it: the Workspace opening holds the composer inert until a project is picked, and the investing opening names the instrument instead and leaves the composer live.

**A conversation is created for one name and bound at creation.** Nothing is shared and nothing is claimed later — an unbound conversation the reader is typing into cannot be adopted by whichever name they open next, which is how a conversation about one stock ends up filed under another. The reuse that keeps blank conversations from piling up is per name and reads that name's own list: opening a name returns to its newest conversation, and starting a new one while its newest is still blank returns to that blank rather than adding a second. A failed bind loses the association, not the conversation.

The right column has **two tabs**. Evidence leads, because a reader checking an answer is looking at the conversation: for every question in it, the external sources the answer drew on — a venue feed, a fetched page, a file in the archive — each naming the feed, the datasets, the event time, the acquisition instant, and the original text the tool returned. An answer that drew on nothing external says so, since that answer is the model's own. Record is what the market says about the open name and everything the user has said about it: the figures, a sixty-session chart, the stance, and the decision chain. Entries are written by hand — a thesis, a decision, or an event — and an open thesis carries the two controls that settle it. That settlement is the product's own surface: a general agent neither keeps a claim nor comes back to score it.

The details column's shared fixed header keeps the open name and collapse control reachable while either tab scrolls. Both tabs stay mounted and the inactive one is hidden rather than unmounted. Each holds work a switch must not discard: a half-written chain entry on one side, an opened original on the other.

## Evidence is derived, never recorded twice

Nothing writes an evidence log. The column derives from the session log the conversation already has, and the rule that anything model-visible is reconstructable from that log is what makes an after-the-fact attribution honest rather than a second story told beside the first. Market rows read the market-data tools' result metadata for the feed, its datasets, and both time facts; web and archive rows read the call's own arguments and result view. A tool outside those three families contributes no row: the column answers what an answer rested on, and a todo write is work the conversation did rather than something it learned.

A feed states when it was read, and a null there means the values were computed rather than acquired — never the current clock, because substituting it would present a generated number as a fetched one. A web or archive read is performed by the harness itself, so the call's own time is the acquisition instant.

## The workbench chart, and where it applies

The chart draws candles and MA5/10/20/60 over a price axis, with a switchable lower pane — volume, MACD (12/26/9), or KDJ (9/3/3) — and a crosshair whose readout names the open, high, low, close, the pane's own values, and every average at the session under the pointer. Parameters follow what mainland trading software ships with, because a workbench that re-tuned them would make every reading incomparable with the platforms its users already read. Arrow keys move the crosshair one session at a time, and the headline price is an `<output>`, so the value is announced rather than changed silently.

It is drawn at **measured pixel width**, never a stretched viewBox: candle proportions, label sizes, and stroke widths hold at every container width. Indicators are computed over the whole series and only then sliced to the visible window — computing them over the slice would restart each warm-up at the left edge, so the same session would show a different MA60 depending on how far the reader had zoomed. The price range is widened to contain the visible averages, because an MA60 running outside the box would leave the plot.

The chart appears in two places, and reaches the second through [ui-tool](../ui-tool/README.md)'s `tool.call.priceSeries` seat:

| Where | What draws |
|---|---|
| The Record tab | This chart whenever a name is open. |
| A `market_history` call in a conversation | This chart when the conversation is **bound to a name**; the shipped `PriceSeriesBlock` otherwise. |

Binding, not the active frame, is the test. A conversation is bound at creation and never reassigned, so the chart a conversation draws does not change when the reader switches frames — and mounting Chico does not change how a price series looks in a conversation about a codebase.

## Two columns, two plugin-owned observables

The rows and the open name are neither session-scoped nor root-scoped: they are one book and one selection, the same in every session. A slot `store` handle carries one scope and the two slots do not share one — the sidebar is root-scoped, the details column session-scoped — so the plugin owns both values and hands each column the same subscription. Following a name in one column moves the other, and a refresh requested while one is in flight joins it.

## Direction is carried twice

Price direction follows the local market convention the product serves — red for up, green for down — through theme tokens so both themes resolve. The sign is also in the text and the direction is on a `data-direction` attribute, so a row survives grayscale, colour vision deficiency, and a test that reads the DOM. Chain entries are told apart the same way: a shape in the marker column and the kind spelled out beside the date.

Figures use tabular numerals so a column of prices aligns, and the change is padded to a fixed width for the same reason.

## Model Experience

None, as this package renders browser columns over Host-owned projections and registers nothing model-facing.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **Nothing extracts entries from a conversation** — every chain entry is written by hand. Automatic extraction, and the receipt that would make it reversible, belong to the memory system's design.
- **The stance is read but not written here** — posture, position, and conviction are shown from the record; the panel has no editor for them yet, so they stay at their defaults until something else sets them.
- **An event carries no return attribution** — the design splits a move into market, sector, and name-specific parts. That needs data no seam supplies, so an event is prose. The evidence column attributes sources, which is a different question.
- **Evidence is per answer, not per claim** — the column says which sources an answer drew on, not which sentence rests on which source. Tying a sentence to a source needs the model to emit the citation.
- **Evidence stops at the loaded window** — an older turn that has not been loaded contributes nothing, and a source whose question fell outside it is filed under an unlabelled exchange rather than dropped.
- **One read per mount** — no column subscribes to quote changes, so an open workbench is as stale as its last read.
- **A conversation does not know its name** — the binding is one-way, so a conversation opened from the sessions frame shows nothing about which instrument it belongs to.
- **The chart neither zooms nor pans** — the window is one of five preset ranges. Wheel zoom and drag-to-pan need a viewport model the preset list does not have.
- **A conversation bound to a name the reader has not opened draws the shipped candles** — occupancy is decided against the open name's conversation list, so scrolling back through a bound conversation from the sessions frame, without opening its name first, shows the compact chart.
- **The lower pane offers three indicators and no overlays** — no Bollinger bands, no volume-weighted average, and no way to add one from configuration.
