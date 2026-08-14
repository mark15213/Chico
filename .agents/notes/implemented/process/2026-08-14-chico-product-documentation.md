# Agent Note: Chico product documentation tier

Status: implemented

English | [中文](2026-08-14-chico-product-documentation.zh.md)

## Problem

The repository documentation describes the shared Harness, while Chico needs a separate home for product intent, repository architecture, capability documents, revision-bound code analysis, controls, experiments, and evaluation evidence. Putting those subjects in Harness architecture pages would mix product design with current platform behavior and make exploratory analysis look authoritative.

Chico intentionally reuses and may change shared packages. Product documents therefore cannot replace repository Agent Notes or package contracts: maintainers still need a durable record of accepted alternatives, and consumers still need the exact behavior owned by source, package READMEs, and subsystem references.

## Decision

[`products/chico/`](../../../../products/chico/README.md) is the Chico product-documentation tier. Its stable paired README maps the corpus, and its subtree `AGENTS.md` assigns one owner for product foundations, target repository architecture, vertical capability documents, code analysis, controls, evaluations, and reusable templates. High-churn working documents remain Chinese-first and unpaired unless they enter the repository's bilingual scope or gain a complete pair deliberately.

Chico repository structure and composition belong in `architecture/`. Revision-bound implementation evidence and unaccepted hypotheses belong in `analysis/`. A shared runtime design document is added only after a product capability establishes a concrete requirement; product documentation does not pre-design shared subsystems.

Each user-visible capability keeps its PRD, experience design, specification, and evaluation plan together under `capabilities/<name>/`. Cross-capability product facts live in `foundations/` or `controls/`. Delivery status, ownership, and schedules remain in the issue tracker rather than durable status inventories.

Accepted framework and process choices remain active Agent Notes. Shipped provider-neutral behavior remains in source JSDoc, package READMEs, [`docs/architecture.md`](../../../../docs/architecture.md), and the owning subsystem reference. Product documents link those owners instead of copying event catalogs, public types, or implementation contracts.

## Ownership rules

| Subject | Owner |
|---|---|
| Chico product intent, users, domain terms, and controls | [`products/chico/`](../../../../products/chico/README.md) |
| Intended code locations, composition, entry points, and dependency direction | [`architecture/`](../../../../products/chico/architecture/repository-structure.md) |
| Code observations, measurements, and unaccepted hypotheses | [`analysis/`](../../../../products/chico/analysis/harness/architecture-baseline.md) |
| Accepted alternatives and codebase decisions | [Active Agent Notes](../../README.md) |
| Current Harness behavior and public contracts | Source, package READMEs, and [`docs/`](../../../../docs/architecture.md) |

## Alternatives considered

**Put the Chico corpus under `docs/`.** Rejected because `docs/` owns the shared Harness architecture, subsystem references, contributor procedures, and published user guides. Product research would widen those subjects, create frequent bilingual maintenance, and blur current platform behavior with product design.

**Use Agent Notes for every PRD, specification, and analysis.** Rejected because Agent Notes own accepted or proposed codebase decisions and their rejected alternatives. User research, product outcomes, normative product behavior, measurements, and exploratory hypotheses have different lifecycles and evidence requirements.

**Keep Chico in a separate repository.** Rejected because Chico intentionally reuses and changes the shared Harness and needs atomic links between product architecture, Agent Notes, source contracts, tests, and evaluations. A repository split would make component extraction and coordinated changes harder to review and verify.

**Organize all PRDs, designs, and specifications in separate type directories.** Rejected because one capability would then be scattered across several trees. Vertical capability directories keep its user problem, interaction, behavior, and evaluation evidence reviewable together, while shared facts retain one cross-capability home.

## Consequences

The repository gains a Chico documentation tier that is not an npm workspace or public Harness documentation section. Contributors must decide whether a fact is product intent, target repository architecture, revision-bound analysis, a codebase decision, or a shipped platform contract before writing it, and links connect those homes.

The separation adds navigation and maintenance rules, but prevents product research from destabilizing Harness references or being mistaken for implemented behavior. Chico code changes still carry the repository's ordinary Agent Note, documentation, test, snapshot, and evaluation obligations.
