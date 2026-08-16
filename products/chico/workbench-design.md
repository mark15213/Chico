# Chico workbench — feature design

This document proposes what the workbench does for the user and how it lands as an increment on the existing DSH web GUI. It states design intent for review, not shipped behavior.

Two neighbours own what it deliberately leaves out. [`one-pager.md`](one-pager.md) owns the product argument. The memory and personalization system — how the record accumulates, how structure is extracted from ordinary work, how judgments are scored — carries its own design; this document names only where a feature touches it.

One rule from that separation holds throughout: **every surface is useful on day one with an empty record, and better once the record fills.** No feature is gated on the user having taught the system anything.

## What the harness already gives us

Chico is not a new application shell. The DSH web GUI already ships the frame, and the increment is measured against it.

| Existing surface | What it already does | Owner |
|---|---|---|
| Three-column AppFrame | Sidebar, conversation, and a details column that opens and closes; one layout mode selects the sidebar and keyed details occupants together | `client/ui-layout` |
| Workspace and session browser | Workspaces as durable groups of sessions, with grouping, manual and recency ordering, drag reorder, metadata and content search, rename, fork, archive | `client/ui-workspace` |
| Sidebar shell | Wordmark, new session, collapse rail, and a `sidebar.mode` list whose entries each own the main sidebar region | `client/ui-sidebar` |
| Conversation | The active conversation and its input, a frame-keyed `conversation.hero`, a `conversation.view` tab ring, and a per-turn tail hole | `client/ui-conversation` |
| Produced files | The files a turn created or changed, listed at the turn tail and linked from the closing prose | `client/ui-deliverables` |
| Background jobs | This session's long-running work, listed in the conversation header | `client/ui-jobs` |
| Tool views | Tool call trees plus keyed per-tool views, driven by each tool's declared render intent | `client/ui-tool` |
| Settings | The settings surface and its section extension points | `client/ui-settings` |
| Slot system | Every feature contributes by registering into a declared slot and declaring its own children | `client/ui-slots` |

Two of these are worth more to Chico than they look. **Produced files plus tool render intents** mean a research run already has a place to land and a way to be presented. **Layout modes plus a frame-keyed conversation opening** let Chico change the unit of navigation without copying the conversation body or displacing the ordinary session browser and tool inspector.

## The integration decision

**One investment archive, and it is a directory rather than a registered workspace. Followed names are Chico's own objects inside it.**

A workspace is bound to a real directory: `create` rejects a non-directory path, and session membership is enforced by the session's canonical cwd equalling the workspace path rather than by convention ([evidence](analysis/harness/component-inventory.md#专项分析标的能否使用-workspace-实体)). Making each followed name a workspace therefore means a folder per name — a heavy, irreversible side effect for the lightest action in the product. Following a name is a glance; it must not put 200 directories on disk, and unfollowing would not remove them, because deleting a workspace registration deliberately never deletes its directory.

So Chico keeps **one** archive directory. Every conversation created under a name runs with it as cwd, which buys the things the directory was wanted for: notes, models, and research output are real files, and the existing produced-files surface lists and links them unchanged. Ordinary sessions keep the Workspace flow.

**The archive is deliberately not registered as a Workspace.** The registry only adopts historical sessions during its one-time bootstrap; after that, `Later cwd-only sessions remain Ungrouped`. A directory that is never registered therefore produces no workspace row at all — which is exactly the requirement that the user must never see a workspace they did not create. No hiding mechanism, no session-origin change, and no durable format change is needed to get it.

**Names are Chico-owned records, and the investing frame owns their navigation.** The sidebar switches between the ordinary session frame and the names frame. The names frame lists followed instruments and their conversations, the centre keeps the shared conversation body, and the keyed details column shows the open name's record. A session's association to a name remains a Chico record rather than Workspace membership.

Workspace grouping, ordering, drag reorder, search, rename, fork, and archive therefore do not apply to names automatically; Chico implements only the name operations its product requires. That is the price of keeping a glance from creating a directory and of making the name, rather than a project, the unit that owns the conversation.

## The increment

Categories are the ones in [`architecture/change-map.md`](architecture/change-map.md).

| Product need | Existing surface | Chico's increment | Category |
|---|---|---|---|
| Followed names, navigation and search | `sidebar.mode` frame list | Chico's names frame over durable records and one archive directory | Plugin extension |
| The name dossier | Mode-keyed details column | A Chico panel: overview, financials, disclosure, ownership, my record | Plugin extension |
| Ask scoped to a name | Shared conversation body, frame-keyed hero, and `sessions.startAt(cwd)` | A name-specific opening plus binding at session creation | Plugin extension |
| Investment data in answers | Tool call views and render intents | New investment tools declaring chart and table render intents | Plugin extension |
| Research runs | Background jobs plus produced files | Investment research templates, and a run presented as a difference against its previous run | Plugin extension |
| Today | The `conversation.empty` hero | A Chico surface that opens on what moved and what is due, and starts a session from any item | Plugin extension |
| Watchlist table | `sidebar.mode` frame region | The followed-name list as the investing frame's left column | Plugin extension |
| Data sources and entitlements | Settings section slots | A Chico settings section | Plugin extension |
| Product entry and branding | Profile and bundle layering | A `chico` profile selecting `bundle/chico-web-app`; a dedicated launcher may hide the profile mechanism | Configuration reuse |

The design leaves `core/`, `api/`, and the agent loop unchanged. Its shared additions are product-neutral layout modes, keyed details and conversation openings, and starting a session at a directory without a Workspace; the [frame decision](../../.agents/notes/implemented/architecture/2026-08-15-frame-modes-and-name-workbench.md) and [conversation-opening decision](../../.agents/notes/implemented/architecture/2026-08-15-frame-owned-conversation-opening.md) own those framework contracts.

## MVP

The working surfaces are cut to what a professional will open daily, and no further.

**1. Names.** The investing frame puts followed names and their conversations on the left, the active conversation in the centre, and the dossier in the details column. This is the core object; without it nothing about the product is different.

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

The **sidebar** switches between two frames. Sessions keeps the ordinary Workspace and session browser; Investing lists followed names in stable follow order, carrying last price, change, and a status marker. The open name expands to its own conversations.

The **centre column** keeps the shared conversation body. Opening a name navigates it to that name's newest conversation or starts one in the archive, and the frame-specific opening replaces the Workspace prerequisite with the instrument being discussed. Today occupies the no-session surface rather than becoming another view of one conversation.

The **details column** is keyed by frame. Sessions shows the tool inspector; Investing shows the open name's dossier. The two do not compete for one seat because switching frames changes the left and right occupants together, while opening a name reveals the dossier beside its conversation.

Presentation follows the existing theme system rather than introducing a second visual language. Figures use aligned tabular numerals, state is encoded in form as well as color so it survives grayscale and color vision deficiency, and price direction follows local convention, red for up and green for down.

## Funds are a first-class object

A fund is not a stock with a different price series. Its dossier replaces financials and valuation with holdings history, style exposure over time, and attribution of excess return between factor exposure and selection. The subject of analysis is the manager: whether stated style is held, whether disclosed holdings match the mandate, and whether the excess is repeatable.

This is an MVP concern rather than a later one, because a fund investor with no fund support has no reason to open the product at all.

## Open questions

- Which user or tenant owns the archive directory under a remote deployment, and which configuration layer chooses its path?
- Does release one target a professional working alone, or a small team sharing a book? Sharing changes the name browser, notes, and permissions, and is cheaper to decide now than to retrofit.
- Which market data licenses cover the disclosure and ownership content, and which permit derived computation and export?
