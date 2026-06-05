# Observation System — Implementation Instructions

**Audience:** Cursor agents and implementers.

**Authority:** This document wins over exploratory code. Locked decisions below are not re-litigated unless the user changes them.

**Start state:** Domain Engine Phases 1–11 complete (`docs/domain-engine/README.md`). Observation layer does not exist.

**End state:** Full observation pipeline — providers → memories → domain filters → workflow context → structured LLM analysis → dashboard → historian replay.

---

## Locked decisions

### Storage — observations are memories

- No `observations` table.
- One observation = one `Memory` with `memoryType: "observation"`, `metadata.isObservation: true`, `metadata.observation: ObservationMetadata`.
- Chunk content = JSON string `{ metric, value, source, timestamp }`.

### Layer separation

| Layer | May import | Must not import |
|-------|------------|-----------------|
| `observation-providers` | `observation-registry`, `observation-ingestion`, `ingestion` | `domain-engine`, workflow modules |
| `observation-registry` | `shared-types` only | providers, domain-engine |
| `domain-engine` workflow analysis | `shared-types`, model abstraction | `observation-providers`, Apify |
| Domain / workflow routes | all via ports | — |

### LLM analysis

- Structured only. See [LLM_ANALYSIS_CONTRACT.md](./LLM_ANALYSIS_CONTRACT.md).
- temperature = 0, JSON schema response format.
- Input = `WorkflowAnalysisInput` only. No retrieved chunk text.
- Output validated with Zod before persisting.

### Packages

- No hardcoded domains/workflows in API defaults or middleware bootstrap.
- Manifests live in `packages/package-manifests/`.
- `installPackage` creates workflows from manifest `workflows[]`.

### Regression

- `POST /retrieve` without `domainKey` behaves identically to today.
- `observationFilters: []` on all domains by default.
- Workflows without `analysisSpecKey` keep current deterministic markdown output.

---

## Phase 1 — Contracts + types ✅

**Goal:** Types compile. No runtime behavior change.

### Steps

1. Create `packages/shared-types/src/observation-contracts.ts` per [CONTRACTS.md](./CONTRACTS.md).
2. Create `packages/shared-types/src/workflow-analysis-contracts.ts` per [LLM_ANALYSIS_CONTRACT.md](./LLM_ANALYSIS_CONTRACT.md).
3. Edit `packages/shared-types/src/canonical-memory-object.ts`:
   - Add `"observation"` to `MemoryType`.
   - Add `observation?: ObservationMetadata` and `isObservation?: boolean` to `CanonicalMemoryMetadata`.
4. Edit `packages/shared-types/src/domain-engine-contracts.ts`:
   - Add `ObservationFilter` import and `observationFilters: ObservationFilter[]` to `Domain`.
   - Add `observations: NormalizedObservation[]` to `WorkflowExecutionContext`.
   - Add `"observations"` to `WorkflowContextLayer` and `WORKFLOW_CONTEXT_LAYER_ORDER` (between `objects` and `retrievedContext`).
   - Add `workflows?: PackageWorkflowRef[]` to `PackageManifest`.
   - Add `analysisSpecKey?: string` to `Workflow` metadata field (or extend `Workflow` interface if metadata is typed).
5. Export all new types from `packages/shared-types/src/index.ts`.
6. Update [CONTRACTS.md](./CONTRACTS.md) if shapes drift during implementation.

### Exit criteria

```bash
npm run build -w @memory-middleware/shared-types
```

Types compile. Grep confirms zero runtime imports of new packages yet.

---

## Phase 2 — Observation registry package ✅

**Goal:** Validate and normalize observations. No storage.

### Steps

1. Create package `packages/observation-registry/`:
   ```
   package.json          # name: @memory-middleware/observation-registry
   tsconfig.json
   src/
     index.ts
     registry.ts
     metric-catalog.ts   # seed from METRIC_CATALOG.md
     validate.ts
     normalize.ts
   ```

2. Implement `registry.ts`:
   - In-memory maps for providers and metrics.
   - `registerProvider`, `registerMetric`, `listProviders`, `listMetrics`.
   - Bootstrap function `bootstrapDefaultRegistry()` called at API startup — registers all rows from [METRIC_CATALOG.md](./METRIC_CATALOG.md).

3. Implement `validate.ts`:
   - Reject unknown `provider`, `category`, `metric` triples.
   - Enforce `valueType` (number/string/boolean/array/object).
   - Enforce unit ranges (scores 0–100, ratings 0–5).
   - Return `{ valid: boolean, errors: string[] }`.

4. Implement `normalize.ts`:
   - `normalizeObservation(raw: unknown, providerKey: string): Observation` — fills `observationId` (ULID), coerces timestamps, sets `metadata.metric` = top-level `metric`.

5. Add unit tests:
   - `validate.test.ts` — known good/bad observations.
   - `metric-catalog.test.ts` — every METRIC_CATALOG row registers.

6. Add workspace dependency in root `package.json` / turbo pipeline.

### Exit criteria

```bash
npm run test -w @memory-middleware/observation-registry
```

All METRIC_CATALOG metrics registered. Invalid observation rejected with explicit errors.

---

## Phase 3 — Observation storage (ingestion path) ✅

**Goal:** Store validated observations as memories.

### Steps

1. Create `packages/observation-ingestion/`:
   ```
   src/
     index.ts
     store-observation.ts
     store-batch.ts
     memory-builder.ts
   ```

2. Implement `memory-builder.ts`:
   - `buildObservationMemory(obs: Observation): CreateMemoryInput` (use existing ingestion input types).
   - Set `memoryType: "observation"`, `sourceType: "json"`.
   - Set metadata per CONTRACTS.md.
   - Single chunk with stringified observation body.

3. Implement `store-observation.ts`:
   - `storeObservation(deps, obs): Promise<{ memoryId, observationId }>`.
   - Call existing ingestion pipeline in `packages/ingestion/src/pipeline.ts` — do not duplicate embed/chunk logic.
   - If same `(workspaceId, businessId, provider, metric)` exists with newer `collectedAt`, archive prior memory and emit `observation_updated`.

4. Create `apps/api/src/lib/observation-store.ts` — Prisma adapter wrapping observation-ingestion.

5. Create `apps/api/src/routes/observations.ts`:
   - `POST /observations` — validate → store batch.
   - `POST /observations/validate` — dry run.
   - Wire RBAC: workspace_admin+.

6. Register routes in `apps/api/src/routes/index.ts`.

7. Emit `observation_created` / `observation_updated` via observability EventEmitter.

### Exit criteria

```bash
# POST two observations, GET memories
curl -X POST "$API/observations" -H "Authorization: Bearer $TOKEN" \
  -d '{"workspaceId":"...","observations":[{"metric":"mobile_score","value":72,...}]}'

curl -X POST "$API/retrieve" -d '{"workspaceId":"...","query":"mobile score","metadataMatch":{"isObservation":"true"}}'
# Returns observation memory in results
```

Memory row has `metadata.isObservation: true`. Historian event logged.

---

## Phase 4 — Non-Apify providers (website + pagespeed) ✅

**Goal:** First real collectors. Validates provider → registry → storage pipeline.

### Steps

1. Create `packages/observation-providers/`:
   ```
   package.json          # depends: observation-registry, observation-ingestion, apify-client (unused until Phase 5)
   src/
     index.ts
     provider-contract.ts
     providers/
       website.ts
       pagespeed.ts
     normalize/
       website.ts
       pagespeed.ts
   ```

2. Implement `website.ts` provider:
   - Reuse `packages/ingestion/src/crawler.ts`.
   - `collect({ params: { url } })` → crawl → compute metrics per METRIC_CATALOG website section.
   - Map crawl output to observations via `normalize/website.ts`.

3. Implement `pagespeed.ts` provider:
   - Call Google PageSpeed Insights API (`PAGESPEED_API_KEY`).
   - `collect({ params: { url, strategy: "mobile" | "desktop" } })`.
   - Map lighthouse scores to observations.

4. Register both providers in `bootstrapDefaultRegistry()` or separate `registerBuiltInProviders()`.

5. Create `apps/api/src/routes/observation-providers.ts`:
   - `GET /observation-providers`
   - `GET /observation-metrics`
   - `POST /observation-providers/:providerKey/collect`

6. `collect` handler flow:
   ```
   resolve provider → validate params → provider.collect() → validate each obs → storeObservation() → return ids
   ```

7. Emit collection started/completed/failed events.

### Exit criteria

```bash
curl -X POST "$API/observation-providers/website/collect" \
  -d '{"workspaceId":"...","params":{"url":"https://example.com"}}'

curl -X POST "$API/observation-providers/pagespeed/collect" \
  -d '{"workspaceId":"...","params":{"url":"https://example.com","strategy":"mobile"}}'

curl -X GET "$API/observations?workspaceId=...&provider=website"
# Returns page_count, schema_present, etc.
```

---

## Phase 5 — Apify providers ✅

**Goal:** Social and search collectors per [APIFY_ACTORS.md](./APIFY_ACTORS.md).

### Steps

1. Add `apify-client` dependency to `observation-providers`.

2. Create `src/apify/`:
   ```
   client.ts
   run-actor.ts
   actors.ts          # actor ID constants
   ```

3. Implement providers:
   - `providers/facebook.ts`
   - `providers/instagram.ts`
   - `providers/tiktok.ts`
   - `providers/facebook-ads.ts`
   - `providers/google-maps.ts`
   - `providers/google-search.ts`
   - `providers/google-business.ts` (wraps google-maps normalizer for subject business)

4. Each provider has `normalize/<provider>.ts` mapping raw Apify items → `Observation[]` per METRIC_CATALOG.

5. Add `GET /observation-providers/:providerKey/runs/:runId` for async polling if using non-blocking `call` options.

6. Add `APIFY_API_TOKEN` to `docs/ENVIRONMENT.md` and `.env.example`.

7. Remove any raw API token from `docs/APIFY_SYSTEM.md`.

8. Register all providers at startup.

### Exit criteria

```bash
# Requires APIFY_API_TOKEN
curl -X POST "$API/observation-providers/facebook/collect" \
  -d '{"workspaceId":"...","params":{"pageUrl":"https://facebook.com/<page>"}}'
# observationCount > 0

curl -X GET "$API/observations?workspaceId=...&provider=facebook&metric=follower_count"
```

Each Apify provider returns normalized observations. No raw Apify payload stored in memories.

---

## Phase 6 — Domain observationFilters ✅

**Goal:** Domains scope observation retrieval.

### Steps

1. Prisma migration `observation_system_phase6`:
   - Add `observation_filters JSONB DEFAULT '[]'` to `domains` table.

2. Update `apps/api/prisma/schema.prisma` — `observationFilters Json @default("[]")`.

3. Update mappers in `apps/api/src/lib/domain-engine/`:
   - `domain-engine-store.ts` — read/write `observationFilters`.
   - Domain create/update routes in `apps/api/src/routes/domains.ts`.

4. Update `packages/domain-engine/src/execution-context.ts`:
   - Include `observationFilters` in `DomainExecutionContext`.

5. Update dashboard `DomainManagerPage.tsx`:
   - Add Observation Filters editor (providers, categories, metrics multi-select from registry API).

6. Implement `packages/retrieval/src/observation-retrieval.ts`:
   ```ts
   retrieveObservations(scope: {
     workspaceId: string;
     filters: ObservationFilter[];
   }): Promise<NormalizedObservation[]>
   ```
   - SQL query on `memories` where `isObservation = true`.
   - Apply filter predicates.

### Exit criteria

```bash
# Create domain with observationFilters for website provider
curl -X PATCH "$API/domains/$DOMAIN_ID" \
  -d '{"observationFilters":[{"providers":["website"]}]}'

curl -X POST "$API/retrieve" \
  -d '{"workspaceId":"...","domainKey":"website","query":"page count"}'
# Response includes observations[] filtered to website provider
```

Retrieve without `domainKey` unchanged.

---

## Phase 7 — Workflow observation layer ✅

**Goal:** Observations appear in workflow context at correct precedence.

### Steps

1. Update `packages/domain-engine/src/workflow-context-builder.ts`:
   - After loading objects, call `retrieveObservations` for each workflow domain's `observationFilters` (union filters, dedupe by observationId).

2. Update `packages/domain-engine/src/workflow-precedence.ts`:
   - Add `observations` layer to `summarizeWorkflowContextLayers`.

3. Update `apps/api/src/lib/workflow-retrieval.ts`:
   - Pass observations into `WorkflowExecutionContext`.

4. Emit `observation_retrieved` when observations enter workflow context.

5. Update `workflow-output-builder.ts` interim: add Observations section listing normalized metrics (until Phase 8 replaces analysis).

### Exit criteria

```bash
curl -X POST "$API/workflows/$WF_ID/execute" \
  -d '{"workspaceId":"...","query":"SEO audit"}'
# Workflow run executionContext.observations.length > 0
# Output markdown includes ## Observations section
```

`WORKFLOW_CONTEXT_LAYER_ORDER` places observations after objects, before retrievedContext.

---

## Phase 8 — Structured LLM analysis ✅

**Goal:** Workflows analyze via closed-task JSON contract.

### Steps

1. Create `packages/domain-engine/src/workflow-analysis-schemas.ts`:
   - Zod schemas for `WorkflowAnalysisInput`, `WorkflowAnalysisOutput`.
   - Per-spec schemas: `seo_audit_v1`, `competitive_gap_v1`, `monthly_marketing_review_v1`.

2. Create `packages/domain-engine/src/workflow-analysis-input.ts`:
   - `buildWorkflowAnalysisInput()` per LLM_ANALYSIS_CONTRACT.md transform table.

3. Create `packages/domain-engine/src/workflow-analysis.ts`:
   - `runWorkflowAnalysis(input, config): Promise<WorkflowAnalysisOutput>`.
   - Use existing model abstraction from `docs/model-layer/` — add `StructuredJsonCaller` interface if missing.
   - System prompt = fixed string from LLM_ANALYSIS_CONTRACT.md.
   - User message = `JSON.stringify(input)` only.
   - temperature 0, JSON schema mode.

4. Create `packages/domain-engine/src/workflow-analysis-validate.ts`:
   - Zod parse output. On failure: retry once with validation errors in payload.

5. Create `packages/domain-engine/src/workflow-analysis-render.ts`:
   - Deterministic markdown from validated output.

6. Edit `packages/domain-engine/src/workflow-execution.ts`:
   ```
   if (workflow.analysisSpecKey) {
     const input = buildWorkflowAnalysisInput(context, workflow, query, workflow.analysisSpecKey);
     const output = await runWorkflowAnalysis(input, config);
     outputs = buildOutputsFromAnalysis(output);
   } else {
     outputs = buildWorkflowOutputs(context, ...);  // existing path
   }
   ```

7. Persist `WorkflowOutput.data` = full analysis JSON.

8. Emit `workflow_analysis_started`, `workflow_analysis_completed`, `workflow_analysis_failed`.

9. Add tests with fixture `WorkflowAnalysisInput`:
   - Zero observations → all tasks `insufficient_data`.
   - `mobile_score: 45` → `seo_mobile_performance` severity `critical`.
   - Invalid LLM response → retry → fail with event.

10. Add `WORKFLOW_ANALYSIS_MODEL` to env docs.

### Exit criteria

```bash
# Workflow with analysisSpecKey: seo_audit_v1
curl -X POST "$API/workflows/$WF_ID/execute" \
  -d '{"workspaceId":"...","query":"Run SEO audit"}'
# Output.data.findings[].taskId matches seo_audit_v1 checklist
# Every finding status=determined has evidenceObservationIds.length > 0
# Trace contains workflow_analysis_input event with no retrievedContext field
```

---

## Phase 9 — Package manifests + workflow bundling ✅

**Goal:** Install domains + workflows from manifests.

### Steps

1. Create `packages/package-manifests/` per [PACKAGE_MANIFESTS.md](./PACKAGE_MANIFESTS.md):
   - `marketing-intelligence/manifest.json`
   - `seo/manifest.json`
   - `social-growth/manifest.json`
   - `competitive-intelligence/manifest.json`

2. Extend `apps/api/src/lib/domain-engine/package-operations.ts`:
   - `installPackage`: for each `manifest.workflows[]`, create `Workflow` with `analysisSpecKey`, domain refs, output types.
   - `exportPackage`: include workflows where `sourcePackageId` matches installed package.
   - `comparePackage`: diff workflows.

3. Register catalog entries via MiddlewareAdmin `POST /platform/packages` (or seed script run manually — not on workspace bootstrap).

4. Document install procedure in [PACKAGE_MANIFESTS.md](./PACKAGE_MANIFESTS.md).

### Exit criteria

```bash
curl -X POST "$API/packages/install" \
  -d '{"workspaceId":"...","packageKey":"marketing-intelligence"}'

curl -X GET "$API/workflows?workspaceId=..."
# 3 workflows, each with analysisSpecKey

curl -X POST "$API/workflows/$SEO_AUDIT_ID/execute" ...
# Full pipeline: domains → observations → LLM analysis → report
```

---

## Phase 10 — Observation Explorer dashboard ✅

**Goal:** Admin UI for browsing observations.

### Steps

1. Create `apps/dashboard/src/pages/ObservationExplorerPage.tsx`:
   - Table: provider, category, metric, value, source, collectedAt, businessId.
   - Filters: provider, category, metric, date range, businessId.
   - Detail drawer: full NormalizedObservation + lineage link.

2. Add API client methods in `apps/dashboard/src/lib/domain-engine-api.ts`:
   - `listObservations(filters)`
   - `getObservation(id)`
   - `collectObservation(providerKey, params)`

3. Add nav entry in `apps/dashboard/src/lib/navigation.ts` under **Operational Intelligence**:
   - Path: `/observations`
   - Label: Observation Explorer

4. Optional: Collection trigger form (provider select + params JSON) calling `POST /observation-providers/:key/collect`.

5. If observation query slow at scale: add GIN index migration per CONTRACTS.md.

### Exit criteria

- Dashboard lists observations for workspace with working filters.
- Collect form triggers website provider and row appears after refresh.
- Empty workspace shows empty state, not error.

---

## Phase 11 — Historian + replay

**Goal:** Observation lifecycle replayable.

### Steps

1. Ensure all events in [API_SURFACE.md](./API_SURFACE.md) emit with structured payloads.

2. Extend `apps/api/src/lib/workflow-replay-store.ts`:
   - Include `observations` slice in replay snapshot.
   - Include `workflow_analysis_input` and `workflow_analysis_output` in snapshot when present.

3. Extend `WorkflowReplayPage.tsx`:
   - Show observation events timeline.
   - Show analysis input/output JSON panels for workflow runs.

4. Integration test: collect → execute workflow → replay → assert observation events present in order.

### Exit criteria

```bash
curl -X GET "$API/workflows/$WF_ID/runs/$RUN_ID/replay"
# Payload includes observations array and analysis output
```

Replay reconstructs observation state at execution time.

---

## Phase 12 — End-to-end verification

**Goal:** Prove success criteria from IMPLEMENT_OBSERVATION_ARCHITECTURE.md.

### Script

Run in order on a clean test workspace:

```
1. POST /packages/install { packageKey: marketing-intelligence }
2. POST /observation-providers/website/collect { url }
3. POST /observation-providers/pagespeed/collect { url }
4. POST /observation-providers/facebook/collect { pageUrl }
5. POST /observation-providers/instagram/collect { profileUrl }
6. POST /observation-providers/tiktok/collect { profileUrl }
7. POST /observation-providers/google-business/collect { placeId or search }
8. GET /observations — count >= 1 per provider
9. POST /workflows/{seo-audit}/execute
10. Assert output.data.findings.length === seo_audit_v1 task count
11. GET /workflows/{seo-audit}/runs/{id}/replay — observations + analysis present
12. Dashboard /observations — rows visible
13. POST /retrieve without domainKey — behavior matches pre-observation baseline test fixture
```

### Success criteria checklist

- [ ] Website Provider
- [ ] PageSpeed Provider
- [ ] Google Business Provider
- [ ] Facebook Provider
- [ ] Instagram Provider
- [ ] TikTok Provider
- [ ] No separate observation database
- [ ] Domains retrieve observations via filters
- [ ] Workflows do not call providers
- [ ] LLM receives only WorkflowAnalysisInput
- [ ] Retrieval without domains unchanged

Mark Phase 12 complete in [README.md](./README.md) build status table.

---

## File creation summary

| Path | Phase |
|------|-------|
| `packages/shared-types/src/observation-contracts.ts` | 1 |
| `packages/shared-types/src/workflow-analysis-contracts.ts` | 1 |
| `packages/observation-registry/` | 2 |
| `packages/observation-ingestion/` | 3 |
| `apps/api/src/routes/observations.ts` | 3 |
| `apps/api/src/lib/observation-store.ts` | 3 |
| `packages/observation-providers/` | 4–5 |
| `apps/api/src/routes/observation-providers.ts` | 4 |
| `packages/retrieval/src/observation-retrieval.ts` | 6 |
| Prisma migration `observation_system_phase6` | 6 |
| `packages/domain-engine/src/workflow-analysis*.ts` | 8 |
| `packages/package-manifests/` | 9 |
| `apps/dashboard/src/pages/ObservationExplorerPage.tsx` | 10 |

---

## Parallel work allowed

| After phase | May parallelize |
|-------------|-----------------|
| 3 | Phase 4 (website/pagespeed) and Phase 6 (domain filters) |
| 4 | Phase 5 (Apify) — independent per provider file |
| 7 | Phase 9 (manifest JSON authoring) |
| 8 | Phase 10 (dashboard) |

Do not start Phase 8 before Phase 7. Do not start Phase 9 install logic before Phase 8 analysisSpecKey on workflows.

---

## Agent rules

1. Execute phases in order unless this doc says parallel OK.
2. Run exit criteria commands before marking a phase done.
3. Update [README.md](./README.md) build status after each phase.
4. Never pass raw chunks or Apify items to LLM.
5. Never hardcode marketing domains in middleware — manifests only.
6. Never create an `observations` database table.
7. Match existing code style in `domain-engine` and `ingestion` packages.
