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

**A followed name is a workspace.**

The harness workspace is already a durable object that groups sessions, carries its own ordering and search, and survives across sessions. That is exactly the relationship a name needs: conversations about 宁德时代 belong to 宁德时代, and the user never has to remember which chat something was in. Notes, models, and research output are files in it, which the produced-files surface already lists and links.

This has been checked against the code, and the answer splits in two ([evidence](analysis/harness/component-inventory.md#专项分析标的能否使用-workspace-实体)).

**The entity layer needs no change.** A workspace is bound to a real directory — `create` rejects a non-directory path, and session membership is enforced by the session's canonical cwd equalling the workspace path rather than being a convention. So the relationship works provided Chico materializes a directory per followed name and starts that name's sessions with it as cwd. That matches the product intent rather than fighting it: notes, models, and research output belong in the name's directory, which makes the existing produced-files surface work unchanged. Conversations belonging to no name land in Ungrouped, which is where open-ended chat should be anyway.

**Adding a name also needs no change.** The sidebar's picker hole takes an occupant that reports one chosen path per open, so a Chico component that searches by ticker or name, materializes the directory, and reports its path satisfies the existing contract.

**The sidebar row did need one shared modification, and it has shipped.** The browser declared exactly one child slot — the picker hole — and no row-level extension point, so last price, change, and status could not be added by registration. Rather than take over the whole browser and forfeit grouping, ordering, drag reorder, search, rename, fork, and archive, the browser now declares `sidebar.workspaces.rowDecoration`, a trailing region carrying the row's workspace id and title ([decision](../../.agents/notes/implemented/architecture/2026-08-14-workspace-row-decoration-slot.md)).

**What remains open is the mapping the decoration needs.** A decorator receives a workspace and must resolve it to an instrument, and nothing yet says which directory corresponds to which listing. That is the same question as where name directories live, below; until it is answered, a row cannot be decorated with a price.

## The increment

Categories are the ones in [`architecture/change-map.md`](architecture/change-map.md).

| Product need | Existing surface | Chico's increment | Category |
|---|---|---|---|
| Followed names, navigation and search | Workspace browser | Market columns and status on the row; names materialized rather than picked | Plugin extension, possibly shared modification |
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

Presentation follows the existing theme system rather than introducing a second visual language. Figures use aligned tabular numerals, state is encoded in form as well as color so it survives grayscale and color vision deficiency, and price direction follows local convention, red for up and green for down.

## Funds are a first-class object

A fund is not a stock with a different price series. Its dossier replaces financials and valuation with holdings history, style exposure over time, and attribution of excess return between factor exposure and selection. The subject of analysis is the manager: whether stated style is held, whether disclosed holdings match the mandate, and whether the excess is repeatable.

This is an MVP concern rather than a later one, because a fund investor with no fund support has no reason to open the product at all.

## Open questions

- **Where do name directories live, how does a directory map back to a listing, and which user boundary owns that tree under a remote deployment?** This is the one blocking question: the row-decoration slot exists, but a decorator cannot resolve a workspace to an instrument until the mapping is decided, so the followed-names surface cannot be built on top of it yet.
- Does unfollowing a name delete its workspace registration, given the directory itself is never removed?
- Does the dossier share the details column with the tool inspector, or does one of them move?
- Does release one target a professional working alone, or a small team sharing a book? Sharing changes the name browser, notes, and permissions, and is cheaper to decide now than to retrofit.
- Which market data licenses cover the disclosure and ownership content, and which permit derived computation and export?
