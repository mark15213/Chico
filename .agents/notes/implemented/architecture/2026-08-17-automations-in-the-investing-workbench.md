# Agent Note: Automations in the Investing Workbench

Status: implemented

English | [中文](2026-08-17-automations-in-the-investing-workbench.zh.md)

## Problem

The workbench answers what the reader asks. Nothing watches the market while they are not looking, and [the workbench design](../../../../products/chico/workbench-design.md) deferred monitors and alerts for needing host-side scheduling.

Two questions had no answer. **Where does standing work live** in a frame whose three columns are already occupied by the followed names, a conversation, and one name's record? And **how does what it produces reach the reader** — a professional watching for a 3% move wants the move explained, not a notification they then have to carry into a conversation by hand.

`dsh-schedule` answers neither. It is Session-scoped: its reminders live in the session log and fire only while that session is live, so a rule stops existing when the reader closes the tab. A rule about a name outlives every conversation about that name.

## Decision

### A rule, a firing, and a delivery are three objects

A **rule** belongs to no name: it carries a condition, a coverage, a throttle, and whether a hit is also read by the model. A **firing** belongs to one name at one instant and carries the observation the condition was decided on. A **delivery** puts one firing in one conversation.

One rule over twelve names fires per name and lands per name, so a single object holding all three would have to lie about one of them. The separation is what lets the followed-name row, a rule's own history, and the transcript each read the part they need.

### The workbench block holds standing work, above the names it acts on

`investing.workbench.section` is a list slot the investing frame declares above its followed names. An entry is a row that opens a page; the block draws no heading when the ledger is empty, so a composition without workbench features opens straight on the names.

The block sits above the list rather than beside it because what runs unattended is read before the list it runs over, and the lookup field stays with the names it searches. A second occupant — skills, strategies — is a registration, not a change to `ui-watchlist` or `ui-layout`.

### A page takes the centre column without displacing the conversation

`ctx.layout` gained `page`, `openPage`, and `closePage`, plus a root-scoped keyed `page` slot rendered in the centre column. Managing a set of rules is not a conversation and not a detail of one; a set needs the width.

The conversation stays **mounted and hidden** underneath rather than unmounted, so a half-typed draft and the reader's scroll position survive a trip through a page. The details column keys on `page ?? mode`, because the right column describes whatever the centre column is showing — the same invariant [frame modes](2026-08-15-frame-modes-and-name-workbench.md) established for the frame switch. Switching frames drops the open page: a page belongs to the frame that offered it.

### The strip is pinned and occupies its own height

`conversation.session.strip` is a list slot between the session header and the transcript. It is sticky, so it stays put while the transcript scrolls, and it paints the column's own background, so text passes behind it rather than through it.

It occupies its own height. A strip that overlapped the first turn would cover the thing the reader came for.

### Binding decides where a conversation surface appears

`ctx.investingFocus` publishes the open name read-only, because opening a name moves three columns and starts a conversation and those transitions stay with the workbench.

The selection says which name the **frame** is showing, which is not what **this conversation** is about. Both conversation surfaces therefore test `focus.sessions.includes(sessionId)` — a conversation is bound to its name at creation and never reassigned — which is the test the workbench chart already makes for the same reason.

### Coverage is the association, and a name reaches it from both ends

A rule finds its names through its coverage: every followed name, holdings, or named instruments. Holdings resolves through `NameStance.posture`, so a holdings rule follows the book with no second list to maintain; the record panel gained the posture editor that scope needs, over the `nameRecord.setStance` remote that already existed with no surface.

From a name, `investing.record.section` and the conversation strip open one panel that offers both directions: join a named-instrument rule, or create one that watches only this name. A watchlist or holdings rule is never joinable — its members are recomputed from its scope, so a name added by hand would contradict it.

### A delivery has one rendering

`DeliveredPush` is the only composition of a push: the attribution line, the observation card, the model's reading as prose, and the follow-up. A rule's history preview renders the same component, so a preview cannot promise a composition the conversation does not deliver.

The card states nothing the model wrote. The figures were observed and the reading was written, and running them together would present one as the other. The attribution line is what separates a delivery from an answer: a push nobody asked for, drawn exactly like an answer to a question they did ask, leaves the reader wondering what they said.

## Alternatives considered

**A third sidebar frame for automations, beside Sessions and Investing.** Rejected: it separates the rules from the names they watch, and the block is meant to hold standing work beside the book it acts on.

**Automations as a collapsible group inside the followed-name list.** Rejected: it competes with the names for the column and does not extend to a second occupant.

**The management surface in the details column, or in a full-screen modal.** Rejected: the details column already carries Evidence and Record, and a set of rules needs the width; a modal makes managing something that belongs to the workbench an act of leaving it.

**Delivering every firing into one digest conversation, or one conversation per rule.** Rejected: the name is the unit of work, and a delivery the reader continues from must arrive where that name's context already is.

**Asking the model to read every firing.** Rejected: a market-wide move fires the whole book at once, and both the cost and the noise are unbounded. The card is deterministic and costs no tokens; the reading is a per-rule choice, default off.

**A zero-height, click-through floating layer for the strip.** Rejected: it charged no height, and so drew over the first turn.

**Reading `ctx.investingFocus` directly in the conversation surfaces.** Rejected: the selection is frame state, so the strip appeared over every conversation the reader opened, including ones about a codebase.

**Creating a rule per name when attaching from a name.** Rejected: one condition over ten names becomes ten rules.

**Storing rules in the session log, as `dsh-schedule` stores reminders.** Rejected: a rule outlives every session and has to be evaluated while none is live, so its home is a registry beside the followed names rather than any conversation's log.

**A price level with a coverage the reader picks.** Rejected: a level holds for one instrument and not for a set, so the editor fixes the coverage instead of accepting a rule that cannot mean anything.

## Consequences

Three shared packages gained vocabulary and none of them knows what an automation is: `ui-layout` (the page), `ui-conversation` (the pinned strip and the transcript foot), and `ui-watchlist` (the workbench block, the row mark, the record block, and the published selection).

A page now owns both the centre and the right column. That is what keeps a rule's detail from sitting beside a name's record, and it means a frame offering pages must expect its details occupant to be replaced while one is open.

**No rule is evaluated and none is stored.** The engine and the durable registry are host-side and are not built; the rules and firings are a fixture compiled into `dsh-client-ui-automation`. Every component takes its data as props, so wiring replaces one module. The management surface says so in place, rather than presenting a rule that is not running as one that is.

**A delivery is not yet in the session log.** It rides `conversation.chat.foot` because the session event that would carry it does not exist, so a delivery is not reconstructable from the log and the model-visible ⟺ logged rule is not yet satisfied for one. When that event lands, deliveries move into the timeline and interleave by time.

The throttle is two fields on the rule rather than a constant, because a threshold crossed back and forth is one event to a reader and many to a comparison, and how often a rule may speak is a decision the person who wrote it makes.

`ctx.investingFocus` is read-only, so a second workbench feature can be about the open name without being able to move it.

## Testing

`packages/client/ui-automation/tests` covers the condition, coverage, and throttle summaries with their closed-union refusal; which rules watch a name and which firings belong to it; the card as an observation carrying no written text; the page's list, its paused row, its selection, and the editor fixing a price level's coverage; the detail column's facts, coverage, history, and the preview being the delivered component; the strip's fired and quiet states, its panel, and its attach entry; the attach panel offering only editable coverages and never one the name is already in; the deliveries with their attribution, single reading, and composer seeding; the record block; and the registrations with fiber disposal proving removal.

Both conversation surfaces pin the binding test directly: a conversation that is not one of the open name's bound conversations renders neither the strip nor a delivery.

`packages/client/ui-layout/tests` covers the page in the store — opening, closing, the details panel closing with each transition, and a frame switch dropping the page — plus the service forwarding with its unwired fail-loud, and the frame rendering the page over a mounted-and-hidden conversation, keying details on the page, and handing the sidebar the open page.

`packages/client/ui-watchlist/tests` covers the workbench block appearing only when occupied, surviving on the collapsed rail, the row mark receiving each row's own name, and the lookup staying below the followed-name heading.

`packages/bundle/chico-web-app/tests` asserts the shipped patch inserts the automation row after the workbench that declares its seats.

## Deferred

- **The engine and the registry** — condition evaluation, the trading-session gate over `Quote.session`, per-name and per-rule throttling, and durable rules beside the followed names.
- **The delivery session event** — until it exists a push is not in the log, and a conversation that is not open cannot receive one.
- **Writes** — enabling, pausing, creating, and attaching are surfaces without a backing operation.
- **Conditions beyond three** — the union is closed and a fourth condition is a new member, not an optional field on an existing one.
