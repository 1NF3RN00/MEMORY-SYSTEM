# Observation System — Implementation Reference

This folder is the **authoritative build guide** for the Observation Provider layer and its integration with the existing Domain Engine (Phases 1–11 complete).

Use these documents when implementing observation providers, Apify collectors, domain `observationFilters`, structured workflow LLM analysis, and the Observation Explorer dashboard.

## Source documents (read-only context)

| Document | Path |
|----------|------|
| Observation architecture phases | [../IMPLEMENT_OBSERVATION_ARCHITECTURE.md](../IMPLEMENT_OBSERVATION_ARCHITECTURE.md) |
| Provider philosophy + category catalog | [../OBSERVATION-PROVIDERS-AND-WORKFLOWS.md.md](../OBSERVATION-PROVIDERS-AND-WORKFLOWS.md.md) |
| Apify actor reference (sanitized) | [./APIFY_ACTORS.md](./APIFY_ACTORS.md) |
| Domain / package / workflow contracts | [../DOMAINS_PACKAGES_WORKFLOWS.md](../DOMAINS_PACKAGES_WORKFLOWS.md) |
| Domain engine (already built) | [../domain-engine/README.md](../domain-engine/README.md) |

## Documents in this folder

| Document | Purpose |
|----------|---------|
| [IMPLEMENTATION_INSTRUCTIONS.md](./IMPLEMENTATION_INSTRUCTIONS.md) | **Start here.** Locked decisions, phase order, exact file-level steps, exit criteria |
| [CONTRACTS.md](./CONTRACTS.md) | TypeScript + Prisma shapes for observations, registry, domains, workflows |
| [API_SURFACE.md](./API_SURFACE.md) | HTTP routes, request/response shapes, event types |
| [METRIC_CATALOG.md](./METRIC_CATALOG.md) | Authoritative provider → category → metric registry |
| [LLM_ANALYSIS_CONTRACT.md](./LLM_ANALYSIS_CONTRACT.md) | Structured workflow LLM analysis — inputs, outputs, per-workflow analysis tasks |
| [PACKAGE_MANIFESTS.md](./PACKAGE_MANIFESTS.md) | Installable domain packages (not hardcoded in middleware) |
| [APIFY_ACTORS.md](./APIFY_ACTORS.md) | Actor IDs, inputs, normalization targets |

## Build status

| Phase | Description | Status |
|-------|-------------|--------|
| 0 | Documentation (this folder) | **Done** |
| 1 | Contracts + types in `shared-types` | **Done** |
| 2 | `@memory-middleware/observation-registry` | **Done** |
| 3 | Observation storage via existing ingestion | **Done** |
| 4 | `@memory-middleware/observation-providers` (website, pagespeed) | **Done** |
| 5 | Apify providers (facebook, instagram, tiktok, google maps, google search, facebook ads) | **Done** |
| 6 | Domain `observationFilters` + Prisma migration | **Done** |
| 7 | Observation retrieval + workflow context layer | **Done** |
| 8 | Structured workflow LLM analysis | **Done** |
| 9 | Package manifests + workflow bundling | **Done** |
| 10 | Observation Explorer dashboard | **Done** |
| 11 | Historian events + replay | Pending |
| 12 | End-to-end verification | Pending |

Update this table when a phase completes.

## Hard rules (never violate)

1. **Observations are memories** — no separate observation table. Store via `memories.metadata.observation`.
2. **Providers are dumb** — collect, normalize, store, tag. No domain/workflow/LLM imports.
3. **Domains retrieve** — via `observationFilters`. Domains never own observations.
4. **Workflows consume domains** — never call providers directly.
5. **Packages bundle capability** — domains, facts, instructions, workflows as installable manifests. No hardcoded SEO/Competitor/Social in middleware core.
6. **LLM receives only normalized inputs** — see [LLM_ANALYSIS_CONTRACT.md](./LLM_ANALYSIS_CONTRACT.md). No raw chunks, no Apify payloads, no free-form prompts.
7. **Retrieval-first** — existing `POST /retrieve` and domain engine must not regress when observation features are off.
8. **Facts win** — global facts → domain facts → instructions → objects → observations → vector context → previous runs.

## Prerequisites (already complete)

- Domain Engine Phases 1–11 (`docs/domain-engine/README.md`)
- `POST /ingest`, `POST /retrieve`, workflow registry + execution
- Dashboard Operational Intelligence managers

## How to execute

1. Read [IMPLEMENTATION_INSTRUCTIONS.md](./IMPLEMENTATION_INSTRUCTIONS.md) fully.
2. Execute phases **sequentially** unless a step explicitly says "parallel OK".
3. After each phase, run its exit criteria commands before proceeding.
4. Update the build status table in this README.
