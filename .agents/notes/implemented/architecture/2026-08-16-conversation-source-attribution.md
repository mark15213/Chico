# Agent Note: Where an Answer Came From

Status: implemented

English | [中文](2026-08-16-conversation-source-attribution.zh.md)

## Problem

Chico's right column held the open name's record. It could not answer the question a professional asks of any figure in an answer — where did this come from, and can I read the original — and two separate gaps stood in the way.

**An observation named its event time and nothing else.** `Quote.asOf` says when the venue priced the instrument. Which feed served the number, which of its datasets, and when it was read were all absent, so a price served by a synthetic table and one served by a venue feed were indistinguishable downstream. [Chico's data-source control](../../../../products/chico/controls/data-provenance.md) requires a stable source identity and an acquisition time, and explicitly forbids substituting the current time for a missing one.

**Nothing assembled attribution per answer.** The tool calls were all in the session log, and a reader wanting to check one had to expand the right row in the transcript and read the raw result — which is the transcript's job, not an account of what an answer rested on.

## Decision

### The seam carries provenance on the observation

`ObservationSource` — `providerId`, `datasets`, `retrievedAt` — is required on `Quote` and `PriceHistory`. The provider fills it, because the datasets and the read instant are facts only the provider has.

`retrievedAt` is `string | null` rather than optional. A null records that there was no acquisition; an omitted key hides the difference between "not acquired" and "not recorded", and the control document is explicit that a missing time is recorded rather than substituted. The fixture provider is the case that forced it: it computes values from an anchor date, so there is no fetch to date, and stamping the clock would both misreport a generated number as a fetched one and cost the provider the determinism keyless snapshots depend on.

### The tools state it in text and carry it as metadata

Both tools end their rendered output with one source line and project the same facts through `output.presentationMeta`. The two are not redundant: the text is what the model reads, and the metadata is what the session log keeps and what a UI reads back without parsing prose.

The metadata is a separate narrowing from the price-series one. `historyMetaFromResult` still yields bars and adjustment, `observationMetaFromResult` yields the source and the event time, and neither refuses the other's absence — so a log written before this change keeps its chart and simply has no provenance.

### The evidence column derives from the log, and shares the right column with the record

Nothing writes an evidence log. The column derives from the session log the conversation already has; the rule that anything model-visible is reconstructable from the log is what makes an after-the-fact attribution honest rather than a second story told beside the first.

Three tool families count as sources — market, web, and archive files. A tool outside them contributes no row, because the column answers what an answer rested on and a todo write is work the conversation did rather than something it learned.

Exchanges open on the reader's own messages, so a steering message lands in the exchange it steered. **An exchange with no sources keeps its row and says so**: an answer built without external data is the model's own, which is a finding rather than an absence to hide.

The column is two tabs with evidence first, not a replacement for the record. Both stay mounted and the inactive one is hidden, because each holds work a switch must not discard — a half-written chain entry on one side, an opened original on the other.

## Alternatives considered

**A `source` field on the shared `ToolResultView` union.** The architecturally tempting home, and rejected for now: every UI would learn a concept one column uses, and the field would have to appear on every card variant or be conspicuously asymmetric. `presentationMeta` already persists per-tool data for exactly this and cost nothing new.

**Importing the tool package's narrowing into the browser.** Rejected: `dsh-tool-market-data` is a host package that pulls cordis and schemastery in with it, and the value arrives over the wire regardless, so the client owes it a defensive narrowing of its own either way.

**A slot ring in the details column, with each tab a registration.** Rejected as an abstraction with no owner: both tabs come from one package today. When a second package wants a tab, the ring is the right answer and `conversation.view` is the template.

**A separate client package for the panel.** Rejected: `ui-watchlist` is the investing frame, the column is that frame's right column, and a new package would buy a boundary nothing crosses.

**Replacing the record panel outright.** Rejected: settling a thesis is the product's own surface, and the column has room for both.

## Consequences

A composition without a venue token now fails loudly *and* every answer it did serve names its feed, so synthetic closes are visible in the transcript rather than only in the configuration.

The tool output schemas gained a required field, so a model-visible surface changed; the prompt section names the source alongside the observation time.

The source table couples the column to seven tool names. That coupling already exists in `ui-tool`'s `classifyTool`, and the failure mode is mild: a new source tool is missing from the column until it is added, rather than being rendered wrongly.

`retrievedAt` on a web or archive row is the call's own time, because the harness performed that read itself. Only a feed's row can carry a stamp the harness did not make.

## Testing

`packages/investment/market-data-fixture/tests` and `market-data-tushare/tests` cover each provider's attribution: the fixture's null retrieval, Tushare's dataset list per operation (bars alone, bars with the roster for a quote, bars with the factors when restated) and the stamp on the read.

`packages/investment/tool-market-data/tests` covers the source line for both a fetched and a computed provider, the empty-dataset and multi-dataset wording, the event time a history takes from its last session, and every malformed-metadata branch narrowing to `undefined`.

`packages/client/ui-watchlist/tests/attribution.client.spec.tsx` covers the derivation — grouping, newest-first order, the three families, sub-calls, ignored tools, the sourceless exchange, the window-cut exchange, unreadable arguments, and a refusal — plus the column: the original opening on demand, the missing-retrieval copy, and the tab switch that leaves the other side's state alone.
