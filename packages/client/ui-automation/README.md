# @deepseek-ai/dsh-client-ui-automation

English | [中文](README.zh.md)

**Automations in the investing workbench**: the rules that watch the market unattended, where they are managed, and what they say when one is true. It registers the workbench block's first occupant in [ui-watchlist](../ui-watchlist/README.md)'s `investing.workbench.section`, a management page on [ui-layout](../ui-layout/README.md)'s `page` seat with its detail column, and three surfaces about one name — the strip above its conversation, the deliveries inside it, the block in its record, and the mark on its followed row. The behavior is specified by the [automations Agent Note](../../../.agents/notes/implemented/architecture/2026-08-17-automations-in-the-investing-workbench.md).

**No rule is evaluated and none is stored.** The rules and their firings are a fixture compiled into this package (`src/client/fixture.ts`): the engine that decides conditions and the durable registry that holds rules are host-side and are not built. Every component takes its data as props, so wiring replaces that one module and nothing else here. The management page says so in place, because a rule that is not running must not be presented as one that is.

## A rule, a firing, and a delivery

A **rule** belongs to no name: a condition, a coverage, a throttle, and whether a hit is also read by the model. A **firing** belongs to one name at one instant and carries the observation the condition was decided on. A **delivery** puts one firing in one conversation.

One rule over twelve names fires per name and lands per name, so a single object holding all three would have to lie about one of them. The separation is what lets a followed-name row, a rule's own history, and the transcript each read the part they need.

A condition is a closed union — change on the day, change across a trailing window, and a price level — so a fourth condition is a new member rather than an optional field on an existing one. A price level holds for one instrument and not for a set, so choosing it fixes the coverage instead of accepting a rule that cannot mean anything.

The throttle is two fields on the rule rather than a constant: how long before the same name may fire again, and how many deliveries the rule may make in a day. A threshold crossed back and forth is one event to a reader and many to a comparison, and how often a rule may speak is the decision of whoever wrote it.

## Coverage is the association, from both ends

A rule finds its names through its coverage: every followed name, holdings, or named instruments. Holdings resolves through the name record's `posture`, so a holdings rule follows the book with no second list to maintain.

From a name, the record block and the conversation strip open one panel offering both directions: join a named-instrument rule, or create one that watches only this name. A watchlist or holdings rule is never joinable — its members are recomputed from its scope, so a name added by hand would contradict it. Offering only creation would turn one condition over ten names into ten rules.

## Binding decides where a conversation surface appears

`ctx.investingFocus` says which name the investing **frame** is showing, which is not what **this conversation** is about. The strip and the deliveries therefore test whether this session is one of the open name's bound conversations; a conversation is bound to its name at creation and never reassigned. Reading the selection directly put the strip over every conversation the reader opened, including ones about a codebase. This is the test [the workbench chart](../ui-watchlist/README.md) already makes for the same reason.

## A delivery has one rendering

`DeliveredPush` is the only composition of a push: the attribution line, the observation card, the model's reading as prose, and the follow-up that seeds the composer. A rule's history preview renders the same component, so a preview cannot promise a composition the conversation does not deliver.

The card states nothing the model wrote. The figures were observed and the reading was written, and running them together would present one as the other. The attribution line separates a delivery from an answer: a push nobody asked for, drawn exactly like an answer to a question they did ask, leaves the reader wondering what they said.

The strip stays visible whenever a rule watches the name, dimmed until something has fired. What is running is worth knowing before it speaks, and a control that appears only after a hit cannot answer "is anything watching this?".

## Model Experience

None, as this package renders browser surfaces over rules it does not own and touches no prompt, message, schema, stream, or tool result.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **Nothing runs** — no condition is evaluated, no rule is stored, and no firing is produced. The engine, its trading-session gate, its throttling, and the durable registry beside the followed names are all absent, so every figure on these surfaces comes from the compiled fixture.
- **A delivery is not in the session log** — it rides `conversation.chat.foot` because the session event that would carry it does not exist. A delivery is therefore not reconstructable from the log, the model cannot read one that arrived before the turn it is answering, and a conversation that is not open receives nothing. When that event lands, deliveries move into the timeline and interleave by time.
- **Every write is a surface without an operation** — enabling, pausing, creating, and attaching render and validate, and then do nothing.
- **A rule's coverage is resolved for it** — the fixture carries the names each rule currently covers. Nothing here resolves a watchlist or a posture scope, so the counts these surfaces show are not derived from the registry they name.
