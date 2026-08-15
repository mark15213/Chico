# @deepseek-ai/dsh-client-ui-watchlist

English | [中文](README.zh.md)

The **investing frame**: what Chico adds to the harness frame. It registers one navigation frame in the sidebar (`sidebar.mode`, id `names`, labelled Investing), one detail panel keyed to that frame (`details`), and that frame's own blank-conversation opening (`conversation.hero`). Switching to the frame swaps the left column to the followed names, the right column to the open name's record, and the centre column's opening to the name being discussed; the conversation body itself stays [ui-conversation](../ui-conversation/README.md)'s.

The left column lists followed names **in follow order**, each with its price, its signed change, and a marker when one of its theses is still waiting to be settled. Sorting by anything the market decides would reshuffle the column under the reader between two glances. Above the list, one search field looks up listings by code or name; a match can be opened without being followed, so "let me look at this first" works. The open name expands to its own conversations — "what did I say about this one last week" is answered beside the name rather than in a global list sorted by time.

Opening a name moves all three columns: the record panel is revealed, and the centre column navigates to that name's newest conversation, or opens its first.

Conversations here belong to **no Workspace**. They run at the [followed-names](../../investment/followed-names/README.md) archive directory, through `sessions.startAt(cwd)`, so produced files land somewhere durable and no folder appears for a name someone merely glanced at. The Workspace flow is the right way in when the reader's unit of work is a project; under a name it would stand between them and their first word about a stock. This package's `conversation.hero` entry is what removes it: the Workspace opening holds the composer inert until a project is picked, and the investing opening names the instrument instead and leaves the composer live.

**A conversation is created for one name and bound at creation.** Nothing is shared and nothing is claimed later — an unbound conversation the reader is typing into cannot be adopted by whichever name they open next, which is how a conversation about one stock ends up filed under another. The reuse that keeps blank conversations from piling up is per name and reads that name's own list: opening a name returns to its newest conversation, and starting a new one while its newest is still blank returns to that blank rather than adding a second. A failed bind loses the association, not the conversation.

The right column is what the market says about the open name and everything the user has said about it: the figures, a sixty-session chart, the stance, and the decision chain. Entries are written by hand — a thesis, a decision, or an event — and an open thesis carries the two controls that settle it. That settlement is the product's own surface: a general agent neither keeps a claim nor comes back to score it.

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
- **An event carries no attribution** — the design splits a move into market, sector, and name-specific parts. That needs data no seam supplies, so an event is prose.
- **One read per mount** — no column subscribes to quote changes, so an open workbench is as stale as its last read.
- **A conversation does not know its name** — the binding is one-way, so a conversation opened from the sessions frame shows nothing about which instrument it belongs to.
