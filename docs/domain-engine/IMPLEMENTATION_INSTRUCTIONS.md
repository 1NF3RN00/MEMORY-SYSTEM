# Domain Engine — Implementation Instructions

**Audience:** Cursor agents and implementers building the Domain Engine and Package System.

**Authority:** This document locks product decisions from the architecture Q&A. If this doc conflicts with exploratory code, **this doc wins** until the user changes it.

---

## Mission

Build the **operational intelligence layer** above domain-agnostic middleware:

| Layer | Responsibility |
|-------|----------------|
| **Middleware** | retrieval, replay, diagnostics, relationships, rendering |
| **Domain Engine** | domains, facts, instructions, packages, execution context |
| **Downstream LLM** | consumes assembled context after middleware + domain layers |

Domains are **task-shaped** retrieval boundaries. Workspaces function as a memory system **without** any domains installed.

---

## Locked decisions (do not re-litigate)

### Tenancy — 1A

Implement full hierarchy:

```txt
Agency → Platform → Workspace → Domain → Facts / Instructions
```

- Add `Agency` and `Platform` Prisma models.
- Every `Workspace` belongs to exactly one `Platform`.
- Every `Platform` belongs to exactly one `Agency`.
- Migration: create a default agency + platform; attach existing workspaces.

### RBAC

| Role | Scope | Notes |
|------|-------|-------|
| **MiddlewareAdmin** | Global | Platform operator only (user’s role). Cross-workspace/agency/platform. Package registry catalog, hard delete, system config. |
| **AgencyAdmin** | Agency | Manage platforms under agency. No middleware infrastructure. |
| **PlatformAdmin** | Platform | Manage workspaces on platform. |
| **WorkspaceAdmin** | Workspace | Install/export/compare packages, CRUD domains/facts/instructions, archive. Maps to membership `owner` or `admin`. |
| **WorkspaceUser** | Workspace | API-only use cases; may have **no dashboard access**. Maps to membership `member`. Retrieve/ingest per API key permissions. |

- **No domain-level permissions** — all domain/package/fact/instruction auth is workspace-wide.
- Extend `WorkspaceMembership.role` or add parallel `operationalRole` field — prefer explicit `OperationalRole` enum stored on membership, mapped from existing roles during migration.

### Facts — 3C

Facts operate in **two phases**:

1. **Retrieval phase** — global + domain facts and retrieval rules influence scope (metadata filters, memory eligibility, relationship neighborhood constraints).
2. **Assembly phase** — facts and instructions are materialized into the context package; facts **replace** text in retrieved chunks when they conflict.

**Conflict resolution:** upward precedence (global beats domain beats instruction beats chunk). Replacement is **text substitution**, not prepend-only.

**Admin visibility (required):** every replacement emits structured trace data (see `FactOverrideRecord` in CONTRACTS.md) surfaced in retrieval traces and diagnostics UI.

### Domain invocation — 4B

- API accepts optional `domainKey` and `domainAction` on retrieve (and downstream context/compression when domain-scoped).
- Resolver: `(workspaceId, domainKey)` → `Domain` row.
- `(domainKey, domainAction)` → active `Instruction` for that action (e.g. `seo` + `audit`).
- **Omit** `domainKey` → workspace-wide retrieval (current behavior, unchanged defaults).
- Domains do **not** block whole-workspace search; they shape a **task** when requested.

### Packages — 5A

- **Postgres** for `PackageDefinition` (registry) and `InstalledPackage` (workspace instance).
- Each package manifest includes a `version` string (opaque label, e.g. `1.0.0` or `2026-06-03`); no semver framework required.
- **No seed packages** in repo or bootstrap.
- **Updates:** never automatic. Workspace Admin workflow: **export → compare → install** (manual).
- **Rollback:** reinstall prior exported manifest or pinned `InstalledPackage.snapshotVersion`.
- **Uninstall:** archive installed package (soft), not hard delete.

### Instructions — multiple per domain

- A domain has one `domainKey` (e.g. `seo`).
- Multiple instructions per domain, keyed by `actionKey` (e.g. `audit`, `report`).
- Task identity: `domainKey` + `domainAction` (maps to `actionKey`).
- Instructions are versioned append-only; domain points to active version per `actionKey`.

### Lifecycle — archive vs delete

| Operation | Who | Behavior |
|-----------|-----|----------|
| `archive*` | WorkspaceAdmin+ | Soft hide from execution; remain in DB |
| `delete*` (hard) | MiddlewareAdmin only | Permanent removal |
| Uninstall package | WorkspaceAdmin | Archive `InstalledPackage` |

### Relationships — 8

Domains define **relationship neighborhood constraints** (types, max depth, allowed target metadata) as part of `retrievalRules`, applied during relationship augmentation.

### Observability — 11

- All domain engine mutations emit `EventLog` entries with structured payloads.
- `ReplaySnapshot` and retrieval operation `result` JSON include serialized `DomainExecutionContext` + `factOverrides[]` for deterministic replay.

---

## What NOT to build

- Hardcoded SEO, Competitor, Inbox, or Strategy domains in middleware or API defaults.
- Automatic package updates.
- Domain-scoped RBAC.
- Seed packages on workspace bootstrap.
- Agency/Platform UI in Phase 7 unless time permits — API/schema first.

---

## Phase order (execute sequentially)

### Phase 0 — Documentation ✅

This folder. Update `README.md` build status when phases complete.

### Phase 1 — Contracts + Prisma ✅

**Goal:** Types and persistence exist; no runtime integration yet.

**Completed:** `domain-engine-contracts.ts`, Prisma models, migration `20250603000000_domain_engine_phase1`, tenancy defaults, provisioning/seed updates.

1. Add `packages/shared-types/src/domain-engine-contracts.ts` per [CONTRACTS.md](./CONTRACTS.md).
2. Export from `packages/shared-types/src/index.ts`.
3. Extend `apps/api/prisma/schema.prisma` with models in CONTRACTS.md.
4. Create migration; backfill default agency/platform for existing workspaces.
5. Extend `Workspace.config` only if needed for transitional flags — prefer normalized tables.

**Exit criteria:** `npm run db:migrate` succeeds; types compile; no route changes required yet.

### Phase 2 — `@memory-middleware/domain-engine` package ✅

**Goal:** Pure engines + context resolver (no Fastify).

**Completed:** `packages/domain-engine/*`, `apps/api/src/lib/domain-engine/*` (Prisma store), unit tests for fact precedence.

Create `packages/domain-engine/` with:

| Module | Functions |
|--------|-----------|
| `global-facts.ts` | `addGlobalFact`, `updateGlobalFact`, `archiveGlobalFact`, `deleteGlobalFact` |
| `domains.ts` | `createDomain`, `updateDomain`, `archiveDomain`, `deleteDomain` |
| `domain-facts.ts` | `addFact`, `updateFact`, `archiveFact`, `deleteFact` |
| `instructions.ts` | `createInstruction`, `updateInstruction`, `versionInstruction`, `archiveInstruction` |
| `packages.ts` | `installPackage`, `exportPackage`, `clonePackage`, `updatePackage` |
| `execution-context.ts` | `resolveDomainExecutionContext(workspaceId, domainKey?, domainAction?)` |
| `fact-precedence.ts` | `applyFactOverridesToMemories(memories, context)` → `{ memories, overrides }` |

Engines accept a `DomainEngineStore` interface (implemented by API Prisma layer in `apps/api/src/lib/domain-engine-store.ts`).

Emit domain events via injected `EventEmitter` (mirror ingestion/retrieval patterns).

**Exit criteria:** Unit tests for precedence resolver and context assembly; engines callable from store.

### Phase 3 — Retrieval integration ✅

**Goal:** Domains shape retrieval when `domainKey` is present.

**Completed:** `resolveDomainRetrievalScope`, vector SQL domain filters, pipeline `executionContext`, `/retrieve` wiring, trace persistence.

1. Extend `RetrievalQuery` with optional `domainKey`, `domainAction`.
2. In `apps/api/src/routes/retrieval.ts`:
   - Resolve `DomainExecutionContext` when `domainKey` set.
   - Merge `metadataFilters` into scope filtering (memory metadata tags/keys).
   - Pass `retrievalRules` + relationship constraints to pipeline.
3. In `packages/retrieval/src/pipeline.ts`:
   - Accept optional `executionContext` on `RunRetrievalInput`.
   - Apply metadata filters before vector search.
   - Pass relationship neighborhood constraints to augmentation step.
4. Persist `executionContext` on `RetrievalOperation.result`.

**Exit criteria:** Retrieve with `domainKey` filters memories; without `domainKey` behavior unchanged.

### Phase 4 — Context-delivery + fact overrides ✅

**Goal:** Facts replace conflicting chunk text; admins see overrides.

**Completed:** `prepareContextPackageForDelivery`, context render `fact_precedence` stage, instruction sections in hierarchy, `domainMetadata` on `ContextPackage`, retrieval + render trace wiring, diagnostics fact override panel.

1. After ranking/assembly, run `applyFactOverridesToMemories` before context render.
2. Attach `factOverrides` to `ContextPackage` / trace views.
3. Extend diagnostics contracts for override panel.
4. Instructions injected as non-memory sections in delivery hierarchy (below facts in precedence for text conflicts; instructions don’t replace facts).

**Exit criteria:** Integration test showing chunk text replaced; trace contains `FactOverrideRecord`.

### Phase 5 — Package engine ✅

**Goal:** Install/export/clone/update/rollback via API.

**Completed:** Package routes (`/packages/*`, `/platform/packages`), live manifest export, compare diff, rollback with snapshot history, fixed update path (no duplicate installs).

1. `PackageDefinition` CRUD — MiddlewareAdmin for catalog.
2. Workspace routes — WorkspaceAdmin for install/export/clone/update.
3. `installPackage`: single transaction creating domains, facts, instructions, rules.
4. `exportPackage`: JSON manifest from workspace-owned entities originally from package (track `sourcePackageId` on entities).
5. `clonePackage`: duplicate installed instance or export blob to another workspace (PlatformAdmin+).
6. Rollback endpoint: reinstall `InstalledPackage` pinned snapshot.

**Exit criteria:** Round-trip export → modify → compare → install on second workspace.

### Phase 6 — RBAC ✅

**Goal:** Enforce matrix in [RBAC.md](./RBAC.md).

**Completed:** `operationalRole` on `AuthContext`, `enforceOperationalPermission`, domain/global-fact/instruction/package routes, session-only writes, security events on denial.

1. Extend `AuthContext` with `operationalRole` resolution.
2. Add `enforceOperationalPermission()` middleware helper.
3. Apply to all `/domains/*`, `/facts/*`, `/packages/*`, `/instructions/*` routes.
4. MiddlewareAdmin bypass for global routes only.

**Exit criteria:** WorkspaceUser cannot install packages; MiddlewareAdmin can hard delete.

### Phase 7 — Dashboard

**Goal:** Five managers in dashboard.

| Page | Path | Minimum features |
|------|------|------------------|
| Domain Manager | `/domains` | list, create, archive, edit rules/filters |
| Global Fact Manager | `/global-facts` | CRUD + archive |
| Domain Fact Manager | `/domains/:id/facts` | CRUD scoped to domain |
| Instruction Manager | `/domains/:id/instructions` | per actionKey, version history |
| Package Manager | `/packages` | installed list, export, install upload, compare diff view |

Add nav group **Operational Intelligence** in `apps/dashboard/src/lib/navigation.ts`.

Workspace without domains shows empty states — no errors.

**Exit criteria:** Admin can manage full lifecycle from UI; traces show fact overrides.

---

## Integration map (where to touch code)

```txt
packages/shared-types/src/domain-engine-contracts.ts   ← Phase 1
apps/api/prisma/schema.prisma                          ← Phase 1
packages/domain-engine/**                              ← Phase 2
apps/api/src/lib/domain-engine-store.ts                ← Phase 2
apps/api/src/routes/domains.ts                         ← Phase 2/5/6
packages/retrieval/src/pipeline.ts                     ← Phase 3
apps/api/src/routes/retrieval.ts                       ← Phase 3
packages/context-delivery/src/pipeline.ts              ← Phase 4
apps/api/src/lib/historian-store.ts                    ← Phase 4 (replay payload)
apps/api/src/middleware/auth.ts                        ← Phase 6
apps/dashboard/src/pages/*Manager*.tsx                 ← Phase 7
```

---

## Default workspace behavior

When no domains exist:

- `/retrieve` without `domainKey` works exactly as today.
- No package prompts in dashboard.
- Global facts optional (empty list).

When `domainKey` provided but domain not found → `404` with clear error.

When `domainKey` + `domainAction` provided but instruction missing → `404` with available actions list.

---

## Agent workflow rules

1. **One phase per session** unless user asks to continue — finish exit criteria before next phase.
2. Update `README.md` build status when a phase completes.
3. Run `npm run build:packages` and relevant tests after each phase.
4. Do not skip event emission — wire `DOMAIN_ENGINE_EVENT_TYPES` from CONTRACTS.md.
5. Never import domain-engine from `@memory-middleware/retrieval` in a way that creates circular deps — retrieval accepts plain `DomainExecutionContext` type from shared-types only.

---

## Open items (ask user before implementing)

- `AgencyAdmin` vs `PlatformAdmin` dashboard surfaces (API-only in V1 unless requested).
- Exact JSON schema for package export manifest (draft in CONTRACTS.md — confirm before Phase 5).
