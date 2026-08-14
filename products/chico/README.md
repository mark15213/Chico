# Chico product documents

English | [中文](README.zh.md)

This subtree is the product knowledge base for Chico, a professional investment workbench built from DeepSeek Harness. It separates Chico's product and repository design from the Harness platform documentation.

## Scope

These documents define Chico's product intent, target code organization, capabilities, and evidence. Current Harness behavior remains owned by source contracts, package READMEs, [`docs/architecture.md`](../../docs/architecture.md), and subsystem references; decisions that affect the codebase remain in [Agent Notes](../../.agents/notes/README.md).

The current design phase covers repository structure and product composition: where Chico documentation lives, where new code belongs, which DSH components Chico can reuse, and which existing areas may need to change. Detailed runtime redesign is deferred until a product capability exposes a concrete requirement.

## Document map

| Area | Owner |
|---|---|
| [`foundations/`](foundations/vision.md) | Product vision, professional users, principles, domain terms, and the authority baseline. |
| [`architecture/`](architecture/repository-structure.md) | Target repository layout, composition and startup model, dependency direction, and change map. |
| [`capabilities/`](capabilities/index.md) | One vertical document set for each user-visible investment capability. |
| [`analysis/`](analysis/harness/architecture-baseline.md) | Revision-bound evidence about the current Harness and experiments that test optimization hypotheses. |
| [`controls/`](controls/data-provenance.md) | Cross-capability data, market-time, authority, audit, model-risk, and security requirements. |
| [`evaluations/`](evaluations/index.md) | Benchmark scenarios, datasets, rubrics, and result reports. |
| [`templates/`](templates/prd-template.md) | Reusable PRD, experience, specification, evaluation, analysis, and experiment structures. |

## Working flow

1. Record observed implementation facts and open hypotheses under `analysis/`, tied to an exact Git revision.
2. State repository-wide Chico design in `architecture/` and user-visible behavior in the owning capability.
3. Record an accepted framework or process decision in a proposed Agent Note before implementation, including alternatives and acceptance criteria.
4. After implementation, update the owning source contracts and Harness documentation, move the Agent Note to `implemented/`, and retain product evaluation evidence here.

## Code relationship

| Product concern | Expected code home |
|---|---|
| Chico executable and default launch behavior | `apps/chico/` |
| Chico browser entry and built frontend | `apps/chico-web/` |
| Investment-domain services, tools, policies, and providers | `packages/investment/*` |
| Chico composition layers | `packages/bundle/chico-base/` and `packages/bundle/chico-web-app/` |
| Chico-specific browser contributions | `packages/client/ui-chico-*` |
| Reusable Harness capabilities | Existing package groups; change them only when the requirement is product-neutral. |

## Starting points

- Review the target layout in [`architecture/repository-structure.md`](architecture/repository-structure.md).
- Review how the existing DSH composition can become a Chico product entry in [`architecture/composition-and-startup.md`](architecture/composition-and-startup.md).
- Classify existing components with [`analysis/harness/component-inventory.md`](analysis/harness/component-inventory.md) before deciding to reuse, extend, replace, or modify them.
