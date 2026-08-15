# Agent Note: Frame Modes and the Name Workbench

Status: implemented

English | [中文](2026-08-15-frame-modes-and-name-workbench.zh.md)

## Problem

The watchlist shipped as a tab in the conversation view ring, beside chat and trajectory. That position says "this is another view of the current session", and the watchlist is not: it is the same book in every session, and it should exist with no session open at all.

Position decided subordination. A tab is a child of the conversation, so the list could only ever be an accessory to it — while the work runs the other way round. **A professional starts from a name, and the conversation is about that name.**

The product design asks for a three-column workbench: followed names on the left, that name's conversation in the middle, that name's decision chain on the right. The harness already has three columns. What it did not have was any way for their occupants to change together.

## Decision

### The frame is a mode, and the layout owns it

`ctx.layout` gained `mode` (default `sessions`) and `setMode`. Both the sidebar and the details column read it, so the two columns never describe different things. Switching frames closes the details panel on the way: its occupant changes with the mode, and leaving it open would swap a panel's contents under a reader who was looking at something else.

The mode lives in the layout store rather than in either column because it is a fact about the frame. A switch owned by the sidebar that only moved the sidebar would be the same mistake the tab was.

### The sidebar's region becomes a list of frames

`sidebar.workspaces` (single) became `sidebar.mode` (list). Each entry owns the whole region between the switch and the foot, and carries the switch entry that selects it. `ui-workspace` registers the session browser as `sessions`; the workbench registers the names column as `names`.

The shell draws one switch entry per registration and renders only the active one. A single registered frame draws no switch — with nothing to choose, a switch is chrome that explains nothing. The rail draws no switch either: 56px has room for one icon per control and not for a row of labels.

### The details column becomes keyed by frame

`details` (single) became `keyed`, keyed by the mode. `ui-conversation` registers the tool inspector under `sessions`; the workbench registers the record panel under `names`.

This is what finally answers the open question the workbench design left: *does the dossier share the details column with the tool inspector, or does one of them move?* Neither. They are not in the same frame, so they never compete for the seat. A question that looked like a conflict was a missing distinction.

### Opening a name opens the column it lands in

The first build set the selection and stopped. A details panel starts closed and its column renders at zero width, so clicking a name moved a column nobody could see — indistinguishable, from the reader's seat, from a dead control. The names frame now asks the layout to reveal the record column as it opens a name: a selection that does not surface its own result is not navigation.

The session gate went with it. The details column was gated on a live non-blank session, which is right for the harness's own detail — a call inside one conversation — and wrong for a name, which outlives every session and exists before the first one opens. The gate now applies to the default frame alone.

### The workbench owns two columns and two observables

The rows and the open name are neither session-scoped nor root-scoped: they are one book and one selection, the same in every session. A slot `store` handle carries one scope and these two slots do not share one, so the plugin owns both values and hands each column the same subscription. Opening a name in the left column moves the right one; following a name moves the list under both.

### A name can be opened before it is followed

Search results open directly. The record does not depend on the follow flag — that is the [name record's](../../../../docs/subsystems/name-record.md) own decision — so "let me look at this first" works, and following stays a separate, deliberate act.

## Alternatives considered

**Keeping the watchlist as a view-ring tab and adding the record beside it.** Rejected: it preserves the subordination that made the position wrong. The tab was removed rather than supplemented.

**Taking over the `details` single slot outright.** Rejected: it deletes tool inspection for every user of the Chico bundle, to give one frame a column it only needs while that frame is active.

**A `mode` owned by `ui-sidebar` alone.** Rejected: the details column has to swap with it. A switch that moved one column would leave the two columns describing different things — which is exactly the failure the tab position had.

**Rendering the record inside the centre column, under the conversation.** Rejected: the record is read *against* the conversation, not after it. Two columns is the point.

**Sorting the names column by change, or by anything else the market decides.** Rejected: the column would reshuffle under the reader between two glances. Follow order is the order the user built the list in, and it is stable by construction.

## Consequences

Four shared packages changed: `ui-layout` (mode state and service), `ui-sidebar` (the frame list replacing the region slot), `ui-workspace` (its browser registers as a frame), and `ui-conversation` (its inspector keys to `sessions`). None of them knows about investing; each knows only that the frame has more than one occupant.

The centre column is not scoped to the open name yet. The host records which conversations belong to a name, and nothing reads it back: opening a name moves two columns out of three. That is the largest gap between this and the design.

The sidebar's pinned-list slot was removed. It was built two commits earlier for a narrower version of this idea, and the frame list absorbs its whole role — an extension point with no consumer is one the next reader has to wonder about.

Nothing extracts chain entries from a conversation, so in practice the user writes all of them. The receipt the design shows — "recorded to the chain, undo" — belongs with the extraction that would produce it.

## Testing

`packages/client/ui-layout/tests` covers the mode in the store, including that switching closes the details panel and that re-selecting the current frame leaves it alone, and the service forwarding plus its unwired fail-loud.

`packages/client/ui-watchlist/tests` covers the pure derivations, the names frame (rows, the unverified marker and its absence, opening a name, the empty state, the rail's silence, the unpriceable row) and its lookup (trimmed query with limit, no request for an empty field, opening an unfollowed match without following it, following on request, the already-followed marker); the record panel (the no-name state, the figures and chart, both reads, the empty-chain explanation, an entry's date and provenance, the calibration figure, the session link, settling only an open thesis, the verdict the settlement sends, a hand-written entry of the picked kind, the refused empty entry, the record surviving unreadable figures, the failed read); both observables; and the two registrations with fiber teardown proving removal.

`packages/bundle/chico-web-app/tests` asserts the shipped patch inserts the record and the workbench row.
