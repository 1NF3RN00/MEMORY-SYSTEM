# Sprint-05 Outcomes — Compression Metadata-Only Endpoint

## Status
- **Implementation:** complete
- **Verification:** complete

## Audit mapping
- **IDs:** OP-5
- **Priority:** P0
- **Effort:** 1-3 days

## Implementation summary

Added a metadata-only projection for compression traces so home telemetry no longer downloads multi-MB context packages.

### API (`apps/api`)

1. **`CompressionTraceSummaryView`** — new shared type in `packages/shared-types/src/compression-contracts.ts` describing token counts, fidelity score, merge/trim counts, and trace identity fields only (no context packages, stages, or decision bodies).

2. **`getCompressionTraceSummary()`** — new store function in `apps/api/src/lib/compression-store.ts` that reads the same `compressionOperation` row as `getCompressionTrace()` but projects only summary fields from `result`.

3. **`GET /compression/:traceId?summary=true`** — extended the existing detail route in `apps/api/src/routes/compression.ts`. When `summary=true`, returns `{ trace: CompressionTraceSummaryView }`. Default behavior (no flag) unchanged — full trace with context packages for Compression Traces page and historian replay consumers.

### Dashboard (`apps/dashboard`)

4. **`fetchWorkspaceTelemetry`** — switched the conditional latest-compression fetch from `GET /compression/:id` to `GET /compression/:id?summary=true`. Reads `compressionMetadata`, `fidelityReport.fidelityScore`, `mergeCount`, and `trimCount` from the summary shape. Fixed prior bug where code looked for nonexistent `fidelityReport.overallScore`.

### Tests

5. **`compression-store-summary.test.ts`** — asserts summary omits context packages and measures serialized payload reduction on a realistic large fixture.

6. **`sprint-05-compression-metadata-endpoint.test.ts`** — asserts home telemetry uses `?summary=true` and Compression Traces page still uses full detail route.

## Anti-objectives avoided

| Anti-objective | How avoided |
|----------------|-------------|
| Do not strip fields needed by detail view | Full `getCompressionTrace()` and `GET /compression/:traceId` (without `summary=true`) unchanged. `CompressionTracesPage` continues to fetch full traces. |
| Do not change compression pipeline outputs | No changes to `runCompressionPipeline`, `completeCompressionOperation`, or stored `result` JSON shape. Summary is a read-time projection only. |
| Do not break historian replay | Historian and replay paths use full trace retrieval (`getCompressionTrace`, stored `result` blobs). Summary route is opt-in via query flag. |
| GA-1 | No retrieval ranking, threshold, or stage-order changes. |
| GA-2 | No ML heuristics or non-deterministic tuning added. |
| GA-3 | Full trace payload shape for dashboard detail view preserved; only home telemetry switched to summary tier. |
| GA-4 | Payload measurements from deterministic unit-test fixture (see Measurements). |
| GA-5 | Scope limited to compression summary route + workspaceTelemetry consumer + tests. |
| GA-6 | No `stages[]` or trace fields removed from full trace responses. |
| GA-7 | No new database tables; summary reads existing `compressionOperation.result` JSON. |

## Verification summary

Verification ran the sprint test suite and inspected consumer paths for regressions.

### Testing framework

| Check | Test / method | Result |
|-------|---------------|--------|
| Context packages absent in summary | `compression-store-summary.test.ts` — asserts `originalContextPackage`, `optimizedContextPackage`, `stageTraces` not in summary | **PASS** (2/2) |
| Home telemetry uses summary endpoint | `sprint-05-compression-metadata-endpoint.test.ts` — source + mocked `fetchWorkspaceTelemetry` | **PASS** (2/2) |
| Detail page keeps full trace route | `sprint-05-compression-metadata-endpoint.test.ts` — `CompressionTracesPage` uses `/compression/${traceId}` without `summary=true` | **PASS** (1/1) |
| Payload KB savings | `compression-store-summary.test.ts` — serialized `{ trace }` byte comparison on 80×4×2KB fixture | **PASS** — full >500 KB, summary <2 KB, summary <1% of full |
| Historian / pipeline regression | Code inspection — no `summary` usage in `packages/compression`, `historian.ts`, or `context-store.ts` (still `getCompressionTrace`) | **PASS** |

**Commands run (2026-06-08):**

```bash
npm run test -w @memory-middleware/dashboard -- src/lib/sprint-05-compression-metadata-endpoint.test.ts
# 3 passed

npx tsx --test apps/api/src/lib/compression-store-summary.test.ts
# 2 passed
```

### Objective results
| # | Objective | Result | Evidence |
|---|-----------|--------|----------|
| 1 | Home telemetry gets token counts and fidelity without context packages | **met** | `workspaceTelemetry.ts` fetches `?summary=true`; mocked test maps `compressionMetadata` + `fidelityReport.fidelityScore` → `compressionAnalytics` with correct ratio/efficiency |
| 2 | Full trace detail still on compression traces page | **met** | `CompressionTracesPage.tsx` line 185: `apiGet<TraceDetail>(\`/compression/${traceId}\`)`; static test confirms no `summary=true` in page source |
| 3 | Payload reduction measurable | **met** | Store test: full payload >500 KB, summary <2 KB, ratio <1%; implementation fixture ~1,327 KB → ~0.44 KB (99.97% reduction) |

### Anti-objective results
| Anti-objective | Violated? | Evidence |
|----------------|-----------|----------|
| Do not strip fields needed by detail view | **no** | `GET /compression/:traceId` without flag still calls `getCompressionTrace()`; `/fidelity` sub-route unchanged; `CompressionTracesPage` uses full route |
| Do not change compression pipeline outputs | **no** | `packages/compression` untouched; summary is read-time projection in `getCompressionTraceSummary()` only |
| Do not break historian replay | **no** | `historian.ts` has no summary path; `context-store.ts` still uses `getCompressionTrace`; stored `result` JSON unchanged |
| GA-1 through GA-7 | **no** | No ranking/stage-order changes; no new tables; full trace shape preserved; scope limited to summary route + telemetry consumer |

### Regression safety
- Full `getCompressionTrace()` response shape unchanged (context packages, stages, decisions still present).
- Summary tier is opt-in via `?summary=true` only; default consumers unaffected.

## Verification Score
- **Score:** 97 / 100
- **Objectives met:** 3 / 3
- **Anti-objectives violated:** none

**Rubric breakdown:** Objectives 40/40 · Anti-objectives 25/25 · Test coverage 18/20 (no Fastify HTTP integration test) · Regression safety 14/15 (fixture-based, not live API HAR)

## Measurements
| Metric | Before | After | Target | Evidence |
|--------|--------|-------|--------|----------|
| Latest compression detail payload (fixture: 80 memories × 4 × 2KB chunks) | ~1,327 KB (`GET /compression/:id`) | ~0.44 KB (`GET /compression/:id?summary=true`) | remove multi-MB from home conditional fetch | `compression-store-summary.test.ts`; inline fixture: `fullBytes=1326693`, `summaryBytes=440`, **99.97% reduction** |
| Home telemetry compression fetch | Full trace with context packages | Summary metadata only | — | `workspaceTelemetry.ts` uses `?summary=true` |

## Places for improvement

1. **Route-level integration test** — Add a Fastify inject test for `GET /compression/:traceId?summary=true` to assert HTTP 200, response schema, and absence of `optimizedContextPackage` without relying on store-only mocks.
2. **Live payload capture** — Optional HAR or `perf:sprint` measurement against a seeded workspace to confirm multi-MB savings on real home telemetry fetch (unit fixture already proves order-of-magnitude reduction).
3. **Wire API test into CI** — `compression-store-summary.test.ts` uses `node:test` but is not wired to an `npm test` script in `@memory-middleware/api`; dashboard sprint test is in Vitest CI path.
