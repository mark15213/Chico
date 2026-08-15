# Chico workbench — feature design

This document proposes what the workbench does for the user and how it lands as an increment on the existing DSH web GUI. It states design intent for review, not shipped behavior.

Two neighbours own what it deliberately leaves out. [`one-pager.md`](one-pager.md) owns the product argument. The memory and personalization system — how the record accumulates, how structure is extracted from ordinary work, how judgments are scored — carries its own design; this document names only where a feature touches it.

One rule from that separation holds throughout: **every surface is useful on day one with an empty record, and better once the record fills.** No feature is gated on the user having taught the system anything.

## What the harness already gives us

Chico is not a new application shell. The DSH web GUI already ships the frame, and the increment is measured against it.

| Existing surface | What it already does | Owner |
|---|---|---|
| Three-column AppFrame | Sidebar, conversation, and a details column that opens and closes; declares `sidebar`, `conversation`, `details`, and `conversation.empty` | `client/ui-layout` |
| Workspace and session browser | Workspaces as durable groups of sessions, with grouping, manual and recency ordering, drag reorder, metadata and content search, rename, fork, archive | `client/ui-workspace` |
| Sidebar shell | Wordmark, new session, collapse rail, and the seats the browser and settings render into | `client/ui-sidebar` |
| Conversation | The active conversation and its input, a `conversation.view` tab ring, and a per-turn tail hole | `client/ui-conversation` |
| Produced files | The files a turn created or changed, listed at the turn tail and linked from the closing prose | `client/ui-deliverables` |
| Background jobs | This session's long-running work, listed in the conversation header | `client/ui-jobs` |
| Tool views | Tool call trees plus keyed per-tool views, driven by each tool's declared render intent | `client/ui-tool` |
| Settings | The settings surface and its section extension points | `client/ui-settings` |
| Slot system | Every feature contributes by registering into a declared slot and declaring its own children | `client/ui-slots` |

Two of these are worth more to Chico than they look. **Produced files plus tool render intents** mean a research run already has a place to land and a way to be presented. **The `conversation.view` ring** means an alternate view of the same session is an established pattern, not a new one — trajectory already occupies it.

## The integration decision

**One investment archive, and it is a directory rather than a registered workspace. Followed names are Chico's own objects inside it.**

A workspace is bound to a real directory: `create` rejects a non-directory path, and session membership is enforced by the session's canonical cwd equalling the workspace path rather than by convention ([evidence](analysis/harness/component-inventory.md#专项分析标的能否使用-workspace-实体)). Making each followed name a workspace therefore means a folder per name — a heavy, irreversible side effect for the lightest action in the product. Following a name is a glance; it must not put 200 directories on disk, and unfollowing would not remove them, because deleting a workspace registration deliberately never deletes its directory.

So Chico keeps **one** archive directory. Every Chico session runs with it as cwd, which buys the things the directory was wanted for: notes, models, and research output are real files, and the existing produced-files surface lists and links them unchanged.

**The archive is deliberately not registered as a Workspace.** The registry only adopts historical sessions during its one-time bootstrap; after that, `Later cwd-only sessions remain Ungrouped`. A directory that is never registered therefore produces no workspace row at all — which is exactly the requirement that the user must never see a workspace they did not create. No hiding mechanism, no session-origin change, and no durable format change is needed to get it.

**Names are Chico-owned records, and Chico's own surfaces own their navigation.** The watchlist is a view in the conversation ring, the name page is a Chico surface, and a session's association to a name is a Chico record rather than workspace membership. The sidebar keeps doing what it already does for ordinary sessions; it is not the navigation for names.

What this gives up is the reuse the earlier draft was chasing: grouping, ordering, drag reorder, search, rename, fork, and archive come free for workspaces and have to be built for names. That is the price of not putting a folder on disk for every glance, and it is worth paying. It also means the workspace row needs no extension point — an earlier `sidebar.workspaces.rowDecoration` slot was built for the per-name arrangement and reverted with it, because an extension point with no consumer is one the next reader has to wonder about.

## The increment

Categories are the ones in [`architecture/change-map.md`](architecture/change-map.md).

| Product need | Existing surface | Chico's increment | Category |
|---|---|---|---|
| Followed names, navigation and search | Nothing reusable | Chico's own name records, watchlist view, and name page over one archive directory | Plugin extension |
| The name dossier | Details column | A Chico panel: overview, financials, disclosure, ownership, my record | Plugin extension |
| Ask scoped to a name | Sessions belong to a workspace | Nothing | Direct reuse |
| Investment data in answers | Tool call views and render intents | New investment tools declaring chart and table render intents | Plugin extension |
| Research runs | Background jobs plus produced files | Investment research templates, and a run presented as a difference against its previous run | Plugin extension |
| Today | The `conversation.empty` hero | A Chico surface that opens on what moved and what is due, and starts a session from any item | Plugin extension |
| Watchlist table | The `conversation.view` ring | A Chico view in the ring, alongside chat and trajectory | Plugin extension |
| Data sources and entitlements | Settings section slots | A Chico settings section | Plugin extension |
| Product entry and branding | `apps/web`, `bundle/web-app` | `apps/chico-web`, `bundle/chico-web-app` | Product replacement |

Nothing above requires changing `core/`, `api/`, or the agent loop. The one open shared-modification risk is the workspace question, and it is the first thing to settle.

## MVP

The working surfaces are cut to what a professional will open daily, and no further.

**1. Names.** Followed names in the sidebar, a watchlist view in the ring, and the dossier in the details column. This is the core object; without it nothing about the product is different.

**2. Investment tools with real render intents.** Quotes and price behavior, financial statements, filings and announcements, ownership and flow. A chart or a statement rendered as a card the user can read, not as prose describing numbers. Without this the agent cannot do the work at all.

**3. Today.** What moved in the followed names with attribution, and what is due in the next few sessions. It works at zero structure — a user who has recorded nothing still gets their names' moves explained and their calendar assembled — and it gets better when the memory system starts contributing.

Research runs ride on jobs and produced files rather than adding a surface, and the run-difference view is the only genuinely new piece.

Attribution cannot be deferred even though it looks advanced. Without at least the split into market, sector, and name-specific movement, Today degrades into a news feed and the dossier shows raw profit and loss, which is what every other product already does.

## Deferred, with the reason

| Module | Why not in MVP |
|---|---|
| Monitors and alerts | Needs host-side scheduling and the memory system's hook; both are separate designs |
| Screening | High build cost, and its differentiator — screening on the user's own data — needs a record that does not exist yet |
| Portfolio and the rebalancing sandbox | Needs position data and a factor model; valuable, but not what makes someone open the app on day one |
| Themes | A second object type; wait until the name object has proven itself against real use |
| Calendar as a module | Its value arrives as data inside Today; a standalone calendar can wait |
| Review and reports | Needs resolved judgments, so it follows the memory system |
| Strategy and execution | Runs on the authority ladder in [`risk-and-authority-model.md`](foundations/risk-and-authority-model.md); out of scope here |

## The day this has to fit

Features earn their place against a working day, not a competitor's menu.

| Window | What the user is doing | MVP coverage |
|---|---|---|
| Pre-open | Absorbing overnight events, checking what is due, deciding what to act on | Today |
| Intraday | Watching for moves that matter, explaining them, checking a fact fast | Watchlist view, ask |
| Post-close | Digesting filings, updating views, recording what happened | Dossier, research runs |
| Earnings season | Updating models against actual prints, in volume and under time pressure | Dossier, research runs |
| Periodic | Deep research on a new name, rebalancing, reporting | Research runs; the rest is deferred |

Pre-open and post-close are where a workbench is won. Intraday, a professional already has a broker terminal open and will not switch, which is why no real-time surface is in the MVP.

## Layout

Chico keeps the three-column frame rather than replacing it.

The **sidebar** lists followed names in place of plain workspace rows, carrying last price, change, and a status marker. The **center column** holds the conversation, with the watchlist as another tab in the same ring that trajectory already uses, and Today occupying the empty-session surface. The **details column** holds the dossier for the name in focus.

The details column is currently occupied by the tool inspector from `client/ui-conversation`. Whether the dossier competes for that seat, and how focus moves between a tool detail and a name detail, is the first concrete question the implementation has to answer, and it belongs in analysis before it becomes a decision.

Until it is answered, the shipped dossier opens inside the watchlist tab and replaces the list, which leaves the column question open at the cost of not being able to read a name beside the rest of the book.

Presentation follows the existing theme system rather than introducing a second visual language. Figures use aligned tabular numerals, state is encoded in form as well as color so it survives grayscale and color vision deficiency, and price direction follows local convention, red for up and green for down.

## Funds are a first-class object

A fund is not a stock with a different price series. Its dossier replaces financials and valuation with holdings history, style exposure over time, and attribution of excess return between factor exposure and selection. The subject of analysis is the manager: whether stated style is held, whether disclosed holdings match the mandate, and whether the excess is repeatable.

This is an MVP concern rather than a later one, because a fund investor with no fund support has no reason to open the product at all.

## Open questions

- Where does the archive directory live by default, and which user boundary owns it under a remote deployment? A configuration value rather than a design decision, but it needs an answer before the first release.
- Does a followed name keep its recorded material after unfollowing, or is unfollowing a delete? The archive is one directory either way, so this is a product choice about the name record rather than about files.
- Does the dossier share the details column with the tool inspector, or does one of them move?
- Does release one target a professional working alone, or a small team sharing a book? Sharing changes the name browser, notes, and permissions, and is cheaper to decide now than to retrofit.
- Which market data licenses cover the disclosure and ownership content, and which permit derived computation and export?
