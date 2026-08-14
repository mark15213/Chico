# AGENTS.md — Chico product documents

This subtree owns product intent, repository architecture, capability requirements, experience design, code analysis, controls, and evaluations for Chico. It does not replace the Harness architecture references, package contracts, or Agent Notes.

## Fact ownership

- `foundations/` owns stable product intent, users, domain terms, principles, and the authority baseline.
- `architecture/` owns Chico's intended repository layout, product composition, entry points, dependency direction, and the map of likely additions and shared-package changes.
- `capabilities/<name>/` keeps one capability's PRD, experience design, specification, and evaluation plan together.
- `analysis/` contains evidence and hypotheses tied to an analyzed Git revision. Analysis is not normative and must link any accepted decision.
- `controls/` owns cross-capability investment, data, authority, audit, model-risk, and security requirements.
- `evaluations/` owns benchmark definitions, rubrics, datasets, and reports; templates are in `templates/`.

Codebase decisions still require an active Agent Note under `.agents/notes/`. Shipped framework behavior belongs in source JSDoc, package READMEs, `docs/architecture.md`, and the owning subsystem reference. Link those owners; do not copy their catalogs or contracts here.

## Writing rules

Write current product requirements directly. Keep delivery status, assignments, and schedules in the issue tracker rather than status tables in durable documents. Mark unresolved questions explicitly and never present a hypothesis as shipped behavior.

Every analysis names its date, analyzed Git revision, scope, evidence, uncertainties, and superseding document when one exists. Never include credentials, account identifiers, licensed datasets, customer data, or unpublished market data.

Use relative Markdown links. Keep one physical line per paragraph, one home per fact, and exactly one trailing newline. Start new capability and research documents from the local templates.

Do not design a shared runtime subsystem before a Chico capability exposes a concrete limitation. Record the current implementation in `analysis/`, the desired product behavior in the owning capability, and an accepted cross-package change in an Agent Note.
