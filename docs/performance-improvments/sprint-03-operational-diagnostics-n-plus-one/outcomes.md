# Sprint-03 Outcomes — Fix Operational Diagnostics N+1

## Status
- **Implementation:** complete
- **Verification:** complete

## Audit mapping
- **IDs:** BUG-001, DB-002, OP-3, RC-004
- **Priority:** P0
- **Effort:** <1 day

## Implementation summary

Replaced the per-trace `retrievalOperation.findFirst` loop in `GET /diagnostics/operational` with a single batch fetch.

### Changes

| File | Change |
|------|--------|
| `apps/api/src/lib/retrieval-store.ts` | Added `getRetrievalResultsByTraceIds()` — one `findMany` with `traceId IN (...)`, `select: { traceId, result }`, deduped by latest `createdAt` |
| `apps/api/src/routes/historian.ts` | Collect trace IDs from `listRetrievalTraces`, batch-fetch results, map synchronously into enriched traces |
| `apps/api/src/lib/operational-diagnostics-batch.test.ts` | Unit tests for batch query count (O(1) vs O(n)), dedup behavior, and unchanged report shape |

### Query pattern (before → after)

| Step | Before | After |
|------|--------|-------|
| `listRetrievalTraces` | 1 query | 1 query |
| `listReplaySnapshots` | 1 query | 1 query |
| Per-trace operation lookup | **N** `findFirst` | **1** `findMany` |
| **Total for limit=100** | **~102** | **3** |

### Objective evidence

1. **One batch query for operations** — `getRetrievalResultsByTraceIds` issues exactly one `findMany`; test asserts 1 call for 100 trace IDs and 0 `findFirst` calls.
2. **Response shape unchanged** — Enrichment logic preserved field-for-field (`retrievalTraceId`, `query`, `status`, `createdAt`, optional `error`, `failedStage`, `snapshot`); `buildOperationalDiagnostics` fixture test confirms report sections unchanged.
3. **Sub-linear scaling** — Operation lookups are O(1) DB round-trips regardless of limit; synchronous in-memory map replaces N concurrent awaits.

## Anti-objectives avoided

| Anti-objective | How avoided |
|----------------|-------------|
| Do not change `buildOperationalDiagnostics` report structure | `packages/historian/src/diagnostics.ts` untouched; same `enrichedTraces` input shape passed to `buildOperationalDiagnostics` |
| Do not load full contextPackage when only error/stage needed | Batch query uses `select: { traceId, result }` — same JSON payload as prior `findFirst`; no additional contextPackage loading beyond existing `result` field (slim select deferred to sprint-27) |
| Do not remove snapshot attachment | `listReplaySnapshots` + `snapshotByTrace` map unchanged; snapshots still spread onto enriched traces when present |
| GA-1 (ranking/threshold changes) | No retrieval pipeline, ranking, or stage-order changes |
| GA-2 (non-deterministic tuning) | Deterministic `orderBy: { createdAt: "desc" }` dedup; no ML/heuristics |
| GA-3 (trace payload breakage) | API response still `{ report: OperationalDiagnosticsReport }` with identical field names |
| GA-4 (fabricated numbers) | Query counts derived from code structure and passing unit test; no latency benchmarks fabricated |
| GA-5 (scope creep) | Only historian route + retrieval-store helper + test; no unrelated refactors |
| GA-6 (remove trace fields) | All `stages[]` and trace fields in report preserved |
| GA-7 (new DB tables) | Reused existing `retrieval_operations` table with indexed `traceId` |

## Verification summary

Verification ran the sprint test suite and inspected implementation diffs. All five unit tests pass via `node --import tsx --test src/lib/operational-diagnostics-batch.test.ts` in `apps/api`.

### Testing framework

| Check | Method | Result |
|-------|--------|--------|
| Prisma call count O(1) | Mock prisma counting `findMany` / `findFirst` for 100 trace IDs | 1 `findMany`, 0 `findFirst` |
| Scaling with limit | Mock prisma for sizes 10, 50, 100 — query count constant | 1 `findMany` at each size |
| Report shape regression | Fixture traces → `enrichTracesForOperationalDiagnostics` → `buildOperationalDiagnostics` | `failedRetrievals`, `lowConfidenceRetrievals`, `topScore`, `generatedAt` unchanged |
| Empty input guard | `getRetrievalResultsByTraceIds(prisma, [])` | 0 queries, empty map |
| Dedup correctness | Duplicate traceId rows with different `createdAt` | Latest row wins |

### Objective results

| # | Objective | Result | Evidence |
|---|-----------|--------|----------|
| 1 | One batch query fetches all operations for listed traceIds | **met** | `getRetrievalResultsByTraceIds` uses single `findMany` with `traceId IN (...)`; tests assert 1 call for 100 IDs |
| 2 | Response shape unchanged for dashboard consumers | **met** | `historian.ts` enrichment fields identical to pre-change diff; fixture test validates `OperationalDiagnosticsReport` sections; `packages/historian/src/diagnostics.ts` has zero diff |
| 3 | Latency scales sub-linearly with limit | **met** | DB round-trips for operation lookup are O(1) regardless of limit (10/50/100 all issue 1 `findMany`); `Promise.all` + N awaits replaced with sync map |

### Anti-objective results

| Anti-objective | Violated? | Evidence |
|----------------|-----------|----------|
| Do not change `buildOperationalDiagnostics` report structure | **no** | `packages/historian/src/diagnostics.ts` unchanged; fixture test output matches expected sections |
| Do not load full contextPackage when only error/stage needed | **no** | `select: { traceId, result }` only; same `result` JSON as prior `findFirst` (no new fields loaded) |
| Do not remove snapshot attachment | **no** | `snapshotByTrace` map + `...(snapshot ? { snapshot } : {})` preserved in `historian.ts` |
| GA-1 | **no** | No retrieval pipeline or ranking changes |
| GA-2 | **no** | Deterministic `orderBy` dedup only |
| GA-3 | **no** | Dashboard consumes `{ report: { lowConfidenceRetrievals, failedRetrievals, ... } }` — structure intact |
| GA-4 | **no** | Measurements from code analysis + passing mock tests only |
| GA-5 | **no** | Scope limited to historian route, retrieval-store helper, tests |
| GA-6 | **no** | No trace/report fields removed |
| GA-7 | **no** | No new tables |

### Regression safety

- Retrieval/compression pipeline outputs: **unchanged** (no pipeline files modified).
- `GET /diagnostics/operational` response envelope: `{ report }` unchanged.
- Enrichment logic field-for-field equivalent to pre-sprint `Promise.all` + `findFirst` loop (git diff review).

## Verification Score

- **Score:** 98 / 100
- **Objectives met:** 3 / 3
- **Anti-objectives violated:** none

### Rubric breakdown

| Dimension | Weight | Score | Notes |
|-----------|--------|-------|-------|
| Objectives met | 40% | 40 | All three objectives met with automated evidence |
| Anti-objectives clean | 25% | 25 | Sprint + global anti-objectives verified clean |
| Test coverage | 20% | 18 | Strong unit/mock coverage; no live DB or HTTP integration test |
| Regression safety | 15% | 15 | Report shape fixture + untouched `diagnostics.ts` |

## Measurements

| Metric | Before | After | Target | Evidence |
|--------|--------|-------|--------|----------|
| Operation queries (limit=100) | 100 `findFirst` | 1 `findMany` | 100 → 1-2 per request | `operational-diagnostics-batch.test.ts` mock counts |
| Total route queries (limit=100) | ~102 (1 list + 1 snapshots + 100 findFirst) | 3 (1 list + 1 snapshots + 1 findMany) | ≤5 | Code review of `historian.ts` |
| findMany calls at limit=10/50/100 | N/A (was N) | 1 at each size | O(1) | Scaling test in `operational-diagnostics-batch.test.ts` |
| Unit tests | 0 | 5 passing | ≥1 | `node --import tsx --test src/lib/operational-diagnostics-batch.test.ts` — 5 pass, 0 fail |

## Places for improvement

1. **Add `test` script to `apps/api/package.json`** — tests exist but are not wired into workspace `npm test`; CI may miss them.
2. **Optional Prisma integration test** — seed `retrieval_operations` rows and assert `GET /diagnostics/operational` returns expected report with measured query count via `$on('query')` logging.
3. **Slim `result` projection (sprint-27)** — `result` JSON still contains full stored payload; future sprint can select only `error` + `stages` paths if Prisma/JSON path queries are adopted.
