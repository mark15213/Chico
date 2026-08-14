# Agent Note: Workspace Row Decoration Slot

Status: implemented

English | [中文](2026-08-14-workspace-row-decoration-slot.zh.md)

## Problem

The sidebar workspace browser owns every workspace row: the folder glyph, the title, the hover action buttons, and the drag wiring. It declared exactly one child slot, `sidebar.workspaces.directoryFlow`, so a plugin could supply the picking interaction but could not contribute anything to a row.

A product that gives workspaces a domain meaning needs per-row content the browser cannot know about. The Chico investment workbench treats a followed name as a workspace and needs last price, change, and a status marker on the row; the browser has no business resolving market data, and the [Chico component inventory](../../../../products/chico/analysis/harness/component-inventory.md) recorded the gap.

Without an extension point the only route is for the product to register its own component into `sidebar.workspaces` and replace the browser wholesale, which forfeits grouping, manual and recency ordering, drag reorder, metadata and content search, rename, fork, and archive — every one of which would then be reimplemented and drift.

## Decision

The WorkspaceBrowser entry declares a second child slot, `sidebar.workspaces.rowDecoration` (`list` kind, `root` scope). Its owner share carries the row identity a decorator needs and nothing else:

| Field | Meaning |
|---|---|
| `workspaceId` | The row's Workspace. |
| `title` | The row's display title, already resolved for presentation. |

`ProjectRowItem` renders the list between the row title and the trailing action buttons, and only when the row has a `workspaceId`. The ungrouped bucket has no backing Workspace, so it renders no decoration and a registrant never receives a row without an id.

The decoration is presentation only. The row's own click still toggles the group, and the decoration yields its lane on hover exactly as the session row's time label does, so a decorated row gains no width and loses no affordance. An empty hole renders nothing and leaves row geometry unchanged, which is what keeps the slot free for compositions that do not fill it.

The slot is product-neutral: the owner share names a workspace and a title, carries no investment vocabulary, and any composition wanting row status, a badge, or a count can occupy it.

## Alternatives considered

**A Chico-specific browser registered into `sidebar.workspaces`.** Rejected: it duplicates grouping, ordering, drag reorder, search, rename, fork, and archive, and every later fix to those has to be made twice. Replacing a shell region is the right move when the region's behavior is wrong for the product, not when only its row content is incomplete.

**Widening the owner share to the whole `GroupNode`.** Rejected: the node carries expansion, session membership, drop-target state, and the browser's own presentation decisions. Handing all of it to a registrant would freeze the browser's internal tree shape into a cross-package contract for the sake of two fields.

**A `single`-kind slot instead of `list`.** Rejected: nothing about row decoration is exclusive, and a single seat would make two decorating plugins conflict at registration rather than compose.

**Making the decoration interactive (its own click target).** Deferred rather than rejected: the row's click semantics are the browser's, and a second click target inside it needs its own decision about precedence and keyboard order. Presentation-only content needs neither, so the slot ships without it and can widen later without breaking occupants.

## Consequences

`WorkspaceBrowserProps` renders two child slots instead of one, and `SessionTree` threads one more callback from the browser root to the row. The cost is one prop on an internal component; the alternative was a forked browser.

Because the declaration lives on the WorkspaceBrowser entry, its teardown collapses the child slot with it, so an occupant registered against a browser that unloads dies on the same lifecycle axis as the directory-flow occupant.

The ungrouped bucket is permanently undecoratable. That follows from the owner share requiring a `workspaceId`, and it is the correct restriction: a decorator resolving data per workspace has nothing to resolve for a bucket that is not one.

## Testing

`tests/apply.client.spec.ts` asserts the declaration exists with `list` kind, that a registrant can contribute against it, and that disposing the browser fiber collapses the declaration. `tests/rows.client.spec.tsx` asserts the decoration renders with the row identity for a real workspace row and is never requested for the ungrouped bucket.
