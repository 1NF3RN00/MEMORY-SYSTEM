# Sprint-04 Outcomes — Lite Relationship Graph Endpoint

## Status
- **Implementation:** complete
- **Verification:** complete

## Audit mapping
- **IDs:** BUG-002, OP-4
- **Priority:** P0
- **Effort:** 1-3 days

## Implementation summary

Added a `lite=true` query parameter to `GET /relationships/graph` that returns a slim graph payload for the home contextual map.

### Changes

1. **`apps/api/src/lib/relationship-graph-store.ts`**
   - Added `RelationshipGraphLiteView` (`workspaceId`, `nodes`, `edges` only).
   - Added `buildLiteRelationshipGraph()` early-return path when `options.lite` is set.
   - Lite path skips `buildRetrievalHeatmap`, retrieval/compression operation fetches, chunk metadata includes, and omits `domains`, `timelineEvents`, `retrievalTraces`, and `stats`.
   - Extracted shared `buildGraphEdges()` so edge derivation stays identical between lite and full modes.
   - Node/edge `id` fields and edge schema unchanged.

2. **`apps/api/src/routes/compression.ts`**
   - Route accepts `lite=true` and passes `{ lite: true }` to the store.
   - Default behavior (no `lite` param) unchanged — still returns full `RelationshipGraphView`.

3. **`apps/dashboard/src/components/homepage/ContextualIntelligenceMap.tsx`**
   - Home map fetch URL updated to `?workspaceId=…&lite=true`.

4. **`apps/api/src/lib/relationship-graph-store-lite.test.ts`**
   - Unit tests cover lite shape, full-graph regression, query skipping, and payload reduction.

### Objective evidence

| # | Objective | Met | Evidence |
|---|-----------|-----|----------|
| 1 | `lite=true` omits timeline, retrievalTraces, heatmap embeds | yes | Lite path does not call `buildRetrievalHeatmap` or fetch retrieval/compression ops; response keys are `workspaceId`, `nodes`, `edges` only (`relationship-graph-store-lite.test.ts`) |
| 2 | ContextualIntelligenceMap uses lite endpoint | yes | `ContextualIntelligenceMap.tsx` line 172: `&lite=true` |
| 3 | Full graph endpoint unchanged when lite absent | yes | `RelationshipMapPage.tsx` still calls without `lite`; full test asserts `domains`, `timelineEvents`, `retrievalTraces`, `stats` present |

## Anti-objectives avoided

| Anti-objective | How avoided |
|----------------|-------------|
| Do not break Relationship Map page needing full graph | `RelationshipMapPage.tsx` unchanged; continues calling `/relationships/graph?workspaceId=…` without `lite`. Full code path preserved behind `options?.lite` guard. |
| Do not change node/edge ID schema | Same `RelationshipGraphNode` / `RelationshipGraphEdge` types and `buildGraphEdges()` used in both modes; node `id` and edge `id`/`source`/`target` unchanged. |
| Do not reduce precision of full map page | Lite branch is opt-in only; full graph still loads heatmap, chunk metadata, timeline, and retrieval traces. |
| GA-1 | No retrieval ranking, threshold, or stage-order changes. |
| GA-2 | No ML heuristics or non-deterministic tuning added. |
| GA-3 | Full trace payloads consumed by Relationship Map page unchanged. |
| GA-4 | Payload reduction measured via deterministic JSON byte comparison in unit test, not fabricated. |
| GA-5 | Scope limited to graph store, route param, home map URL, and sprint test. |
| GA-6 | No `stages[]` or trace fields removed from full response. |
| GA-7 | No new database tables. |

## Verification summary

Verification ran the sprint test suite (extended with home-map field and schema-regression assertions), inspected route and dashboard diffs, and measured representative fixture payload bytes.

### Testing framework

| Check | Method | Result |
|-------|--------|--------|
| Lite omits enrichment fields | Mock prisma + `getWorkspaceRelationshipGraph(..., { lite: true })` | Response has only `workspaceId`, `nodes`, `edges`; no `domains`/`timelineEvents`/`retrievalTraces`/`stats` |
| Lite skips heatmap/retrieval/compression queries | Mock prisma query log | 3 queries only: `workspace.findUnique`, `memoryRelationship.findMany`, `memory.findMany.lite` |
| Full graph regression | Same mock without `lite` option | `domains`, `timelineEvents` (3), `retrievalTraces` (1), `stats`, enriched node metrics present; retrieval/compression/full-memory queries logged |
| Home map required fields | Assert node `id`/`label`/`domain`/`accessCount`/`retrievalEligible` and edge `source`/`target`/`weight` | All present on lite response |
| Node/edge ID schema parity | `deepEqual` lite vs full node ids and edges | Identical `id` sets and edge objects (`rel-1`, `mem-1`↔`mem-2`) |
| Payload byte reduction | `Buffer.byteLength(JSON.stringify(...))` on fixture | 2120 B full → 1037 B lite (51.1% reduction) |
| Home uses lite URL | Source inspection | `ContextualIntelligenceMap.tsx` fetches `&lite=true` |
| Relationship Map uses full URL | Source inspection | `RelationshipMapPage.tsx` fetches without `lite` param |

**Test command:** `node --import tsx --test src/lib/relationship-graph-store-lite.test.ts` in `apps/api` — **5 pass, 0 fail**.

### Objective results

| # | Objective | Result | Evidence |
|---|-----------|--------|----------|
| 1 | `lite=true` omits timeline, retrievalTraces, heatmap embeds | **met** | Lite response keys asserted absent; query log excludes retrieval/compression/heatmap paths; `buildRetrievalHeatmap` not invoked in `buildLiteRelationshipGraph` |
| 2 | ContextualIntelligenceMap uses lite endpoint | **met** | `ContextualIntelligenceMap.tsx:172` — `/relationships/graph?workspaceId=${workspaceId}&lite=true` |
| 3 | Full graph endpoint unchanged when lite absent | **met** | Route defaults `lite=false`; full-graph test asserts enrichment sections; `RelationshipMapPage.tsx:65` unchanged |

### Anti-objective results

| Anti-objective | Violated? | Evidence |
|----------------|-----------|----------|
| Do not break Relationship Map page needing full graph | **no** | `RelationshipMapPage.tsx` still calls full endpoint; full-graph unit test passes |
| Do not change node/edge ID schema | **no** | `preserves node and edge id schema between lite and full responses` test — identical edge objects and node id sets |
| Do not reduce precision of full map page | **no** | Full path unchanged; heatmap/chunk/timeline/retrieval traces still built when `lite` absent |
| GA-1 | **no** | No retrieval pipeline or ranking changes |
| GA-2 | **no** | Deterministic store branching only |
| GA-3 | **no** | Full `RelationshipGraphView` payload intact for Relationship Map consumers |
| GA-4 | **no** | Measured 51.1% reduction from reproducible fixture JSON, not estimated |
| GA-5 | **no** | Scope limited to graph store, route param, home map URL, tests |
| GA-6 | **no** | No trace or `stages[]` fields removed from full response |
| GA-7 | **no** | No new tables |

### Regression safety

- Retrieval/compression pipeline outputs: **unchanged** (no pipeline files modified).
- Full `GET /relationships/graph` response shape: **unchanged** when `lite` absent.
- Lite home map receives superset of fields required by `mapGraphFromApi` (`id`, `label`, `domain`, `accessCount`, `retrievalEligible`, `source`, `target`, `weight`).

## Verification Score

- **Score:** 97 / 100
- **Objectives met:** 3 / 3
- **Anti-objectives violated:** none

### Rubric breakdown

| Dimension | Weight | Score | Notes |
|-----------|--------|-------|-------|
| Objectives met | 40% | 40 | All three objectives met with automated + source evidence |
| Anti-objectives clean | 25% | 25 | Sprint + global anti-objectives verified clean |
| Test coverage | 20% | 17 | Five unit/mock tests cover all objectives; no HTTP or live-DB integration test |
| Regression safety | 15% | 15 | Full-graph fixture regression + identical edge schema between modes |

## Measurements

| Metric | Before | After | Target | Evidence |
|--------|--------|-------|--------|----------|
| payload (representative fixture) | 2120 B full graph JSON | 1037 B lite JSON (51.1% reduction) | 50–80% graph reduction on home | `relationship-graph-store-lite.test.ts` + measured fixture run |
| DB queries (lite path) | 5 parallel queries (relationships, memories+chunks, heatmap, 50 retrievals, 30 compressions) | 2 parallel queries (relationships, memories select-only) + workspace lookup | fewer queries on home | Query log assertion in lite unit test (3 total calls) |
| home fetch URL | `/relationships/graph?workspaceId=…` | `/relationships/graph?workspaceId=…&lite=true` | home uses lite | `ContextualIntelligenceMap.tsx:172` |
| unit tests | 3 (implementation) | 5 passing | ≥1 | `node --import tsx --test src/lib/relationship-graph-store-lite.test.ts` |

## Places for improvement

1. **Add `test` script to `apps/api/package.json`** — sprint tests exist but are not wired into workspace `npm test`; CI may miss them without explicit invocation.
2. **Optional HTTP integration test** — hit `GET /relationships/graph?lite=true` vs full on seeded DB and assert response keys + measured byte delta.
3. **Production payload baseline** — fixture achieves 51.1% reduction (lower bound of 50–80% target); capture a real workspace HAR or server log to confirm home-page savings at scale.
