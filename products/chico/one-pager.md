# Chico — product one-pager

This document states product intent for review. It does not describe shipped behavior. Detailed requirements live in [`foundations/`](foundations/vision.md), [`capabilities/`](capabilities/index.md), and [`controls/`](controls/data-provenance.md).

## Positioning

Chico is a desktop investment workbench for professional stock and fund investors. It is an open agent: anything can be asked of it, and it does the ordinary work of the job. Underneath, it keeps a permanent, attributable record of the judgments that pass through it — the agent's and the user's own — and scores them against realized outcomes. What it sells is not analysis. It is knowing which analysis to act on.

It serves investors who answer for the outcome: private fund managers, professional individual traders, investment advisors, and buy-side researchers who follow tens to hundreds of names, hold a written view on each, and are accountable for what the book does ([roles](foundations/professional-users.md)).

## The premise

Generation is no longer scarce. Each model release drops the cost of producing a comparison, a valuation model, a filing summary, or a screen by another order of magnitude. Any product whose value rests on generating more or better is racing the next model release and will lose.

Coding agents escaped this because they inherited a verifier: the compiler and the test suite say which output is good. Investing has none. Feedback arrives months late, carries heavy noise, and confounds process with luck — right for the wrong reason and wrong for the right reason are both common. Alpha is also anti-inductive: an answer available to everyone is worth zero, so a shared model producing shared answers produces beta.

The scarce good therefore moves from generation to selection — not "give me an analysis" but "of these analyses, which one deserves capital." Whoever builds the verifier for investment judgment defines this category.

## The thesis

**A general agent has context. It does not have a book.**

Its memory unit is a conversation. A professional investor's memory unit is a name and an assumption. To a general agent a ticker is a string in a prompt, and it meets the company again from zero every session. To the investor it is an object that has existed for three years, carrying ten years of price behavior, every quarter measured against expectation, every management commitment and whether it was met, six round trips with the reason for each, and three live assumptions with the condition that would prove each wrong.

That is a data structure, not a context length, and a larger model does not produce it.

## Open on top, accumulating underneath

A book is what the product accumulates, not a procedure the user follows. The surface stays an open agent: a greeting gets a greeting, a question about convertible bonds gets an answer, a request to write a script or clean up a spreadsheet gets done, and none of it is routed through an investment workflow. Most of a professional's day is not thesis work, and a tool that handles only thesis work is a tool they keep in a second window.

Structure is extracted from that ordinary work rather than entered into it. When something judgment-bearing passes through — a view stated, a reason given for a trade, a condition that would change the user's mind — the system proposes keeping it, and the user accepts in one action, edits it, or ignores it at no cost. Requiring a person to fill in structure was a workaround for software that could not read prose; building this product on that requirement would leave its main capability unused.

Nothing is gated on the user having done any of it. Every view is worth opening with an empty record and better with a full one.

The memory and personalization system that does this work — extraction, the record, and scoring — carries its own design. The three pieces below state what it has to produce; [`workbench-design.md`](workbench-design.md) states what the user sees.

## What Chico builds

Three pieces of infrastructure. Calibration is not a fourth feature; it is what these three produce once they have been running.

### The name dossier

Every followed name is a permanent object rather than a session. It holds the assumption tree behind the current position, the version history of the user's view — entry logic, revision, reversal — each quarter's print against both the user's model and sell-side consensus, what management promised on each call and whether it was delivered, every trade with its stated reason, and standing checks on the variables the thesis depends on. When a thesis rests on penetration reaching 30% by 2026, each monthly industry print marks that assumption met or missed without being asked.

### The attribution engine

Four layers of attribution, where the first three are what make the fourth possible:

| Layer | Question | Requires |
|---|---|---|
| Return | Of this month's +3.2%, how much is beta, sector, and style, and how much is selection | factor model over the position time series |
| Move | This name is down 6% today — market, sector, or the company, and on which event | event study and sector decomposition |
| Expectation | The print missed my model on which line — revenue beat, gross margin missed on which cost item | the user's model held as structured line items rather than a spreadsheet |
| Decision | Did the thesis work, or was it luck | the three above, plus what was written at entry |

This is why scoring judgments is hard and why scoring them on P&L alone is noise: a claim cannot be graded until the outcome is decomposed onto the variable the user actually bet on.

Price behavior is an input to this engine, not a separate feature. The professional question is not whether a pattern resembles a reversal; it is where this volume sits in the trailing 60-day distribution, how cost basis is distributed at this level, and above all when this combination of price behavior, volume, valuation percentile, and sector conditions last occurred and what followed over the next 20 sessions. That is retrieval and decomposition, not image recognition. Recognition is commoditized by the next model release; retrieval requires full-market history and an index over it. Market-specific instruments belong to the same engine: price limits, block-trade disclosure, northbound flow, margin balance, lockup expiry, and shareholder counts.

Portfolio-level attribution is the same infrastructure read forward. Before a trade the question is not whether a name is attractive but what it contributes at the margin — correlation with existing positions, the sector and style exposure it doubles, and the size that can actually be exited. After the trade, the same factors explain the result.

### The insight ledger

Most AI products assume the agent produces and the person consumes. In investing that direction is inverted: the person produces the alpha, and the system preserves, tests, amplifies, and executes it. What a model generates is a function of public information and is worth zero at the margin. What is worth something is the price softening heard from three distributors, the yield figure from an engineer the user knows, whether the user believes this management team. Today that material sits in chat logs, draft posts, and spreadsheet comments.

The ledger takes it from wherever it was already said — a sentence in conversation, a voice note, a clipping — attaches it to the right name and assumption, and proposes the one thing that makes it scorable later: what would prove it wrong. That proposal is drafted from what the user already said and can be accepted, corrected, or left alone. The ledger then returns on its own when data bears on it. Agent judgments enter the same structure under the same scoring, and neither is privileged.

### What the three produce together

> This name is down 7% today: 2.1% market, 1.8% sector, 3.1% company-specific, matching this morning's utilization data. Your second entry assumption in March 2024 was the capacity ramp, and that data point is the falsifier you set for it. It has now missed two quarters. When a thesis of yours fails on data before price reflects it, you have historically cut 40 days late.

Every clause comes from one of the three pieces, and none of it comes from a better model. The last clause is the product: it is the workbench grading the user, on the user's own record, in the only place where that grade changes a decision.

## Why a user switches

Scheduled tasks, report generation, and data lookups are table stakes; every general agent and every vertical workbench will have them. They are requirements, not differentiation. The comparison that decides the category is whether the tool has a book.

| | General agent or chat-first workbench | Chico |
|---|---|---|
| Memory unit | A conversation | A name and an assumption, held for years |
| Presence | Summoned when asked | Resident, and present at the moment of decision |
| What it records | What was asked and answered | What was believed, why, and what would prove it wrong |
| Attribution | Narrative after the fact | Return, move, expectation, and decision, decomposed |
| Human insight | Discarded with the session | A first-class object, scored beside the agent's |
| Off-thesis work | A general agent does it and forgets; a vertical workbench declines it | Done, and whatever bore on a position is kept |
| Basis for trust | Fluent output | Measured hit rate, by pattern, on this user's own book |
| Trading authority | Cannot responsibly be granted | Earned level by level against measured attribution |
| A stronger model | Replaces the product | Raises the record's value: more answers make choosing among them worth more |

The last row is the defensible one. The asset is the set of pairs — reasoning at the moment of decision, then the realized outcome — on this user's real book. It is not on the internet and cannot be bought, scraped, or distilled; it accumulates only with time in the product. A competitor can copy the features in a week and still cannot recover what the user was thinking at entry last year, because that record had to be captured while the decision was being made.

## Design principles

**Professional.** Calibrated, not fluent. Reporting a poor hit rate on a class of call is professional; a well-written report is not. Point-in-time correctness, provenance, stated uncertainty, and reproducibility are requirements rather than settings ([principles](foundations/product-principles.md)).

**Personal.** An economic necessity, not a preference. A shared answer carries no alpha, so the objective is not the best average answer but where this user diverges from consensus and whether the divergence is supported.

**Grows with the user.** The record runs in both directions. It scores Chico, and it scores the user: which assumptions they over-trust, how late they cut, which categories of their own insight actually hit. That is the honest reason to stay and the real switching cost, because leaving resets the track record to zero.

**Proactive.** Proactive delivery is only possible because falsifiers were captured at entry. Without a recorded prior, pushing alerts is something anyone can do; with one, the workbench opens on the assumptions in this book that moved against the user overnight, ranked by position impact.

## Control

Analysis never implies execution authority. Reading, analyzing, advising, preparing, and executing are separate grants, each scoped, time-bounded, and revocable ([authority model](foundations/risk-and-authority-model.md)).

Authority is earned rather than granted: paper, then shadow, then a capped live allocation, then wider, each step gated on measured attribution rather than on a demonstration. This is the only credible path to automated execution, and a product with no track-record instrument has no path at all.

Every model call, tool run, data version, and approval is logged and replayable ([auditability](controls/auditability.md)). Missing data, conflicting sources, denied permissions, stale quotes, and partial tool failures surface as visible states and are never absorbed into a summary.

## Delivery

Chico is assembled on DeepSeek Harness, where every capability is a plugin, so data sources, attribution models, and strategy runners ship as composable units rather than monolithic releases ([composition](architecture/composition-and-startup.md)).

The name dossier ships first because nothing else stands without it: the attribution engine needs an entry record to attribute to, and the insight ledger needs somewhere to attach. Automation and execution follow in that order rather than by preference — automation schedules what the dossier and the engine produce, and execution trades only rules that automation has already run unattended with measured results.

## What success looks like

**Extraction and acceptance.** Precision and recall of assumptions and falsifiers the system proposes from ordinary work, and the share the user accepts or corrects rather than ignores. Everything downstream rests on this, and it is an engineering number rather than a behavior-change number.

**Attribution coverage.** Share of position-level profit and loss decomposed to factor, event, and thesis rather than left unexplained.

**Calibration depth.** Count of scored, resolved judgments per user, tracked separately for the agent and the user, and whether the user's own hit rate improves.

**Earned authority.** Share of strategies promoted past each authority level, and time held live.
