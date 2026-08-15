# Agent Note: A Frame Owns Its Conversation Opening

Status: implemented

English | [中文](2026-08-15-frame-owned-conversation-opening.zh.md)

## Problem

The investing frame started a conversation with no Workspace, and two things went wrong for the reader.

**The composer asked for a Workspace anyway.** A blank session is the hero phase, and the hero holds the composer inert while its Workspace chip has no title. A session created with a `cwd` and deliberately no Workspace has no chip title, so the reader reached a disabled textarea reading *Choose a workspace to start* — under a stock, having asked for nothing of the kind. The [previous note](2026-08-15-frame-modes-and-name-workbench.md) claimed the Workspace was out of the way because `startSession` was no longer called; the hero's own prerequisite was the part that mattered and it was still there.

**A conversation about one name was filed under another.** `startAt(cwd)` reused a blank session already at that directory, and every name shares the archive directory. Opening 宁德时代 created one; opening 贵州茅台 next handed back the same one and re-armed the pending binding. The reader typed a question about the first name into a conversation that then bound to the second. Binding *when a conversation stops being blank* was the mechanism: it leaves a window in which a conversation belongs to nobody, and whichever name is opened during that window claims it.

## Decision

### The blank-conversation opening belongs to the frame

`conversation.hero` is a new child slot of the conversation shell, keyed by the frame the layout is showing. An entry replaces the Workspace opening for its own frame and takes the prerequisite with it: the Workspace opening is what waits for a pick, and a frame whose unit of work is not a project has nothing to pick first, so its composer is live from the first render. The Workspace picker is not constructed beside a framed opening — the slot renders as the expression is evaluated, so dropping the node would still have mounted the picker.

The default frame registers no entry, so a composition that adds no frame gets exactly what it had. `ui-watchlist` registers one under `names`: the instrument's name, and a line asking what the reader wants to know about it.

The frame reaches the centre column the same way it reaches the other two — `ConvOwnerProps` gained `mode`, which AppFrame already passes to the sidebar and the details column. All three columns now read one value, which is what the mode was for.

### A conversation is created for one name and bound at creation

Binding moved to creation, and the *bind when it stops being blank* rule is deleted along with the controller state that tracked it. There is no window in which the conversation belongs to nobody, so nothing can claim it.

`startAt(cwd)` reuses nothing. The Workspace path reuses a blank session because a Workspace owns its sessions and the blank one it finds is its own; several frames can share a directory, so the same rule there hands one conversation to two owners. Reuse belongs to whoever groups the conversations: the workbench reads the name's own list, opens its newest conversation, and starts a new one only when that newest is not already blank.

## Alternatives considered

**Copying the conversation package for the investing frame.** The user asked for this directly, and it does not work: a child slot has exactly one declaring entry, so a copied shell may not render `conversation.session`, `conversation.composer.bar`, or any of the seats that make a conversation. A copy with new key names would receive no contributions — no tools, no model selection, no permissions, no queue — because every contributor registers into the shipped names. The opening is the part that actually differed, so that is the part the frame now owns.

**Making the composer live for any session with a `cwd`.** Rejected: it silently changes the harness's own frame, where the Workspace prompt is the correct one — a session whose Workspace was deleted from the sidebar should still say so.

**Keeping the bind-when-non-blank rule and giving each name its own blank session.** Rejected as a half fix: it removes today's collision but keeps a window in which a conversation belongs to nobody, and a second surface that starts conversations would reopen the same bug.

**Moving the Workspace hero out of `ui-conversation` entirely, into `ui-workspace`.** The better long-term shape — this package would stop knowing what a Workspace is — and out of scope here: it moves the picker, the agent-preset chip, and both directory-flow holes, none of which the investing frame needs.

## Consequences

`ui-conversation` still owns the Workspace opening as its default. The seam is what a frame overrides, not a migration, so the follow-up above stays available.

`ui-watchlist` now depends on `ui-conversation` for types only — the SlotMap merge that declares `conversation.hero`. No value crosses, so the client bundle stays pure.

The open name carries the display name the clicked surface drew. The record holds no name and the opening has to write one, and a round trip for a heading would leave the column blank on every click.

A name opened and left alone keeps one blank conversation bound to it. That is the price of binding at creation, and it is the right one: returning to the name returns to that conversation instead of opening a second empty one.

## Testing

`packages/client/ui-conversation/tests` covers both sides of the seam: a frame with a registered opening renders it with a live, non-readonly composer and no Workspace picker; a frame without one keeps the Workspace opening and its read-only posture.

`packages/client/ui-watchlist/tests` covers the opening (the name, the code when the surface had none, the no-name state, and that it follows the selection) and the conversation lifecycle: newest-first navigation, creation at the archive bound before anything is said, two names never sharing one conversation, the further conversation, the return to a name's own blank one, and the failed bind that keeps the conversation.

`packages/client/runtime/tests` covers `startAt` creating one per call and never handing back a blank session at that directory.
