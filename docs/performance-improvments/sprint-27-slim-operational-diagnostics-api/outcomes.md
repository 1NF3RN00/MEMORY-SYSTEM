# Sprint-27 Outcomes — Slim Operational Diagnostics API

## Status
- **Implementation:** complete
- **Verification:** complete

## Audit mapping
- **IDs:** RC-004
- **Priority:** P1
- **Effort:** 3-5 days

## Implementation summary

Added `?mode=slim` to `GET /diagnostics/operational` for dashboard telemetry while preserving default full mode for Historian deep analysis.

### Changes

1. **`OperationalDiagnosticsSlimReport` type** (`packages/shared-types/src/historian-contracts.ts`) — counts-only report with `mode: "slim"` and `counts` object (`failedRetrievals`, `lowConfidenceRetrievals`, `tokenWaste`, `contextualDegradation`).

2. **`toOperationalDiagnosticsSlimReport()`** (`packages/historian/src/diagnostics.ts`) — derives slim counts from the same `buildOperationalDiagnostics()` output so diagnostic logic is identical.

3. **`apps/api/src/lib/operational-diagnostics.ts`** — shared enrichment and report builders used by the route and tests.

4. **`GET /diagnostics/operational?mode=slim`** (`apps/api/src/routes/historian.ts`):
   - Default `mode=full` (unchanged response for Historian and other full consumers).
   - Slim mode returns `{ report: OperationalDiagnosticsSlimReport }` with precomputed counts only.
   - Slim path uses `getRetrievalFailureInfoByTraceIds()` for failed traces only (skips full result JSON fetch for completed traces).

5. **`fetchWorkspaceTelemetry`** (`apps/dashboard/src/lib/workspaceTelemetry.ts`) — requests `mode=slim` and reads `report.counts.lowConfidenceRetrievals`.

6. **Tests**
   - `apps/api/src/lib/operational-diagnostics-slim.test.ts` — counts match full, payload size, failedStage preserved in full mode, failure-info batch fetch.
   - `apps/dashboard/src/lib/sprint-27-slim-operational-diagnostics-api.test.ts` — telemetry uses slim; HistorianPage keeps full mode.
   - Updated related dashboard sprint test mocks for slim response shape.

## Anti-objectives avoided

| Anti-objective | How avoided |
|----------------|-------------|
| Historian deep analysis intact | Default `mode=full`; `HistorianPage.tsx` unchanged (no `mode=slim`); full arrays (`failedRetrievals`, `lowConfidenceRetrievals`, `tokenWaste`, `contextualDegradation`) still returned |
| Keep failedStage info | Full mode unchanged; slim mode still runs same `buildOperationalDiagnostics()` using `getRetrievalFailureInfoByTraceIds()` which extracts `failedStage` from stages |
| Same diagnostic logic | Slim counts derived via `toOperationalDiagnosticsSlimReport(buildOperationalDiagnostics(...))` — no threshold or filter changes |
| GA-1 (ranking/threshold changes) | `packages/historian/src/diagnostics.ts` filter logic untouched except adding slim wrapper |
| GA-2 (non-deterministic tuning) | No ML/heuristics; same deterministic filters |
| GA-3 (trace payload breakage) | Full mode response shape unchanged; slim is opt-in via query param |
| GA-4 (fabricated numbers) | Payload measurements from inline fixture in unit test |
| GA-5 (scope creep) | Only operational diagnostics route, telemetry consumer, types, and tests |
| GA-6 (stages[] removal) | No trace/stage fields removed from full mode |
| GA-7 (new DB tables) | No schema changes; reuses existing Prisma queries |

## Verification summary

Verification ran the sprint testing framework: API unit tests (`operational-diagnostics-slim.test.ts`, `operational-diagnostics-batch.test.ts`), dashboard sprint-27 tests, and independent payload measurements on 3- and 100-trace fixtures.

### Test runs (2026-06-08)

| Suite | Command | Result |
|-------|---------|--------|
| API slim + batch | `node --import tsx --test src/lib/operational-diagnostics-slim.test.ts src/lib/operational-diagnostics-batch.test.ts` (from `apps/api`) | **10/10 pass** |
| Dashboard sprint-27 | `npx vitest run src/lib/sprint-27-slim-operational-diagnostics-api.test.ts` | **3/3 pass** |
| Related dashboard mocks | `npx vitest run` on sprint-02, sprint-05, sprint-06, sprint-28 tests | **39/39 pass** |

### Checklist

- [x] Slim payload &lt;10 KB typical — **190 B** at 100 traces (independent measurement)
- [x] Slim counts match full report section lengths — asserted in `operational-diagnostics-slim.test.ts`
- [x] Historian full mode OK — `HistorianPage.tsx` has no `mode=slim`; default route branch is `full`
- [x] Measurements recorded below
- [x] Score computed per rubric
- [x] Regression: retrieval/compression pipelines untouched; full-mode `{ report: OperationalDiagnosticsReport }` shape preserved

### Objective results
| # | Objective | Result | Evidence |
|---|-----------|--------|----------|
| 1 | Counts without full result JSON | **met** | `buildSlimOperationalDiagnosticsReport()` returns `mode: "slim"` + `counts` only; route slim branch skips `getRetrievalResultsByTraceIds` for completed traces (`historian.ts` L338–357); slim JSON **189 B** (3-trace) vs **475 B** full |
| 2 | Full mode for historian | **met** | Default `mode=full` when query param absent; `HistorianPage.tsx` fetches `/diagnostics/operational?workspaceId=${workspaceId}` without `mode=slim` (sprint-27 test); full arrays + `failedStage` preserved (`operational-diagnostics-slim.test.ts` L141–152) |
| 3 | Dashboard uses slim | **met** | `fetchWorkspaceTelemetry` requests `mode=slim` and reads `report.counts.lowConfidenceRetrievals` (`workspaceTelemetry.ts` L213–218, L74–77); sprint-27 runtime mock test confirms call URL and count mapping |

### Anti-objective results
| Anti-objective | Violated? | Evidence |
|----------------|-----------|----------|
| Historian deep analysis intact | **no** | Full mode unchanged; HistorianPage still uses full endpoint |
| Keep failedStage info | **no** | Full report test asserts `failedStage: "vector_search"`; `getRetrievalFailureInfoByTraceIds()` extracts stage from `stages[]` for slim path |
| Same diagnostic logic | **no** | Slim counts = `report.*.length` from same `buildOperationalDiagnostics()` (`toOperationalDiagnosticsSlimReport` in `packages/historian/src/diagnostics.ts`); filter thresholds unchanged |
| GA-1 (ranking/threshold changes) | **no** | `diagnostics.ts` filter logic unmodified except slim wrapper export |
| GA-2 (non-deterministic tuning) | **no** | No new heuristics or ML |
| GA-3 (trace payload breakage) | **no** | Full mode response shape unchanged; slim opt-in via query param |
| GA-4 (fabricated numbers) | **no** | Payload sizes reproduced independently via `node --import tsx -e` measurement script |
| GA-5 (scope creep) | **no** | Changes confined to operational diagnostics route, telemetry, types, tests |
| GA-6 (stages[] removal) | **no** | Full mode still returns per-trace arrays with stage-derived fields |
| GA-7 (new DB tables) | **no** | Reuses existing Prisma queries; no schema migration |

### Rubric breakdown

| Dimension | Weight | Score | Notes |
|-----------|--------|-------|-------|
| Objectives met | 40% | 40 | 3/3 met with test + measurement evidence |
| Anti-objectives clean | 25% | 25 | No sprint or global anti-objective violations |
| Test coverage | 20% | 18 | Unit + static + mock integration cover all objectives; no HTTP route integration test |
| Regression safety | 15% | 15 | Full mode shape preserved; diagnostic filters unchanged |
| **Overall** | | **98** | |

## Verification Score
- **Score:** 98 / 100
- **Objectives met:** 3 / 3
- **Anti-objectives violated:** none

## Measurements
| Metric | Before | After | Target | Evidence |
|--------|--------|-------|--------|----------|
| payload (3-trace fixture) | 475 B full | 189 B slim | major diagnostics reduction | Independent measurement + `operational-diagnostics-slim.test.ts` (slim &lt; 512 B, full &gt; slim) |
| payload (100-trace fixture) | 3,218 B full | 190 B slim | major diagnostics reduction | Independent measurement — **94.1% reduction**; well under 10 KB typical |
| DB fetch (slim, completed traces) | full `result` JSON for all traces | failure info query only for failed trace ids | reduce wasted reads | Route branches on `mode=slim` → `getRetrievalFailureInfoByTraceIds(failedTraceIds)` only |
| Unit tests | 5 (batch) | 10 (batch + slim) | ≥1 | `operational-diagnostics-*.test.ts` — 10/10 pass |
| Dashboard tests | — | 3 sprint-27 + 39 related pass | — | Vitest runs on sprint-27 and updated mock fixtures |

## Places for improvement

- Add a route-level integration test (Fastify inject) asserting `?mode=slim` vs default response shapes and status 200 — would close the small gap on test coverage.
- `getRetrievalFailureInfoByTraceIds` still `select`s full `result` JSON from Prisma and strips in process; a future sprint could narrow the DB projection if the schema allows.
