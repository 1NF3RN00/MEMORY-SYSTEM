# Sprint-30 Outcomes — Compression Trace ID UX

## Status
- **Implementation:** complete
- **Verification:** complete

## Audit mapping
- **IDs:** PBUG-003
- **Priority:** P2
- **Effort:** <1 day

## Implementation summary

Improved compression vs retrieval trace ID UX across API, client, and dashboard.

### API (`compression-store.ts`, `compression.ts`)
- Added `CompressionContextResolveError` contract in `packages/shared-types/src/compression-contracts.ts` with `code`, `suppliedTraceId`, `retrievalTraceId`, and `compressionTraceId`.
- Extracted `buildCompressionTraceIdMismatchError()` for the compression-trace-ID branch in `resolveContextPackage()`.
- `POST /compress` now returns the full structured 400 body (not only `error` string) when the wrong trace ID type is supplied.

### Dashboard client
- Added `ApiError` in `apps/dashboard/src/lib/api.ts` to preserve structured error fields (`code`, `retrievalTraceId`, `compressionTraceId`).
- Added `apps/dashboard/src/lib/compressionTraceId.ts` for local list matching and hint formatting.
- `CompressionTracesPage` now:
  - Shows field hint explaining retrieval vs compression trace IDs.
  - Validates pasted IDs against loaded compression traces before submit.
  - Falls back to `GET /compression/:id?summary=true` when retrieval lookup fails (IDs not in recent list).
  - Renders actionable inline alert with one-click swap to the correct retrieval trace and links to view retrieval/compression results.
  - Blocks submit client-side when a compression trace ID is detected locally.

### Tests
- `apps/api/src/lib/sprint-30-compression-trace-id-ux.test.ts` — 3/3 pass (structured mismatch error, helper, valid retrieval path).
- `apps/dashboard/src/lib/sprint-30-compression-trace-id-ux.test.ts` — 7/7 pass (API error shape, client validation, UI hints, valid compression URLs preserved).

## Anti-objectives avoided

| Anti-objective | How avoided |
|----------------|-------------|
| No opaque auto-resolve | Server never silently maps a compression trace ID to its retrieval trace for `POST /compress`; client only suggests the correct ID with explicit user action (button/link). |
| Valid compression URLs work | `GET /compression/:traceId` detail route unchanged; compression trace detail page still navigates via `/compression-traces/:traceId`; tests assert existing fetch/navigate paths remain. |
| GA-1 | No retrieval ranking, thresholds, or pipeline stage ordering changed. |
| GA-2 | No ML heuristics or non-deterministic tuning; ID detection uses existing DB lookups and loaded trace lists. |
| GA-3 | Trace payloads consumed by dashboard (`stages[]`, compression detail shape) unchanged; only 400 error bodies gained optional structured fields. |
| GA-4 | No performance numbers fabricated; evidence is unit/source tests only. |
| GA-5 | Scope limited to compression trace ID UX (store errors, API client, CompressionTracesPage hints). |
| GA-6 | No `stages[]` or trace fields removed. |
| GA-7 | No new database tables; uses existing `compressionOperation` / `retrievalOperation` lookups. |

## Verification summary

Verification ran the sprint-30 test suites and reviewed API, client, and dashboard source for PBUG-003 coverage.

### Testing framework

| Check | Result | Command / evidence |
|-------|--------|-------------------|
| 1. Wrong ID guided error | **Pass** | `npx tsx --test src/lib/sprint-30-compression-trace-id-ux.test.ts` (3/3) — structured `compression_trace_id_provided` body with `retrievalTraceId`; dashboard client maps `ApiError` → `traceIdHint` |
| 2. Correct ID works | **Pass** | API test `resolves context package for a valid retrieval trace ID`; dashboard source retains `navigate(\`/compression-traces/${result.compressionTraceId}\`)` |
| 3. E2E compress | **Partial** | No live HTTP/browser E2E run; valid compress + detail paths verified via unit tests and source assertions on `CompressionTracesPage` and `GET /compression/:traceId` |

**Test runs (2026-06-08):**

```
apps/api:   npx tsx --test src/lib/sprint-30-compression-trace-id-ux.test.ts → 3/3 pass
dashboard:  npm run test -- --run src/lib/sprint-30-compression-trace-id-ux.test.ts → 7/7 pass
```

### Objective results
| # | Objective | Result | Evidence |
|---|-----------|--------|----------|
| 1 | Actionable error with retrievalTraceId | **Met** | `buildCompressionTraceIdMismatchError()` returns `code`, `retrievalTraceId`, `compressionTraceId`; `POST /compress` sends full body on 400 (`compression.ts` L46–47); `ApiError` preserves fields (`api.ts` L34–97) |
| 2 | Client validation if applicable | **Met** | `validateRetrievalTraceIdForCompress()` blocks submit when ID matches loaded compression traces; fallback `GET /compression/:id?summary=true` surfaces hint when ID not in list (`CompressionTracesPage.tsx` L233–282) |
| 3 | UI hints | **Met** | Form hint text, inline alert with one-click swap to retrieval ID, links to retrieval/compression detail pages (`CompressionTracesPage.tsx` L335–386) |

### Anti-objective results
| Anti-objective | Violated? | Evidence |
|----------------|-----------|----------|
| No opaque auto-resolve | **No** | Server rejects compression IDs with 400; client only sets hints — user must click swap or re-submit |
| Valid compression URLs work | **No** | `GET /compression/:traceId` route unchanged; detail view still loads via `apiGet(\`/compression/${traceId}\`)` |
| GA-1 (ranking/stages) | **No** | No retrieval/compression pipeline edits |
| GA-2 (non-deterministic tuning) | **No** | DB lookup + loaded trace list only |
| GA-3 (trace payload compat) | **No** | Success payloads unchanged; 400 bodies gained optional structured fields |
| GA-4 (fabricated numbers) | **No** | Evidence is test output only |
| GA-5 (scope creep) | **No** | Changes confined to compression trace ID UX |
| GA-6 (stages[] removal) | **No** | No trace field removals |
| GA-7 (new DB tables) | **No** | Uses existing `compressionOperation` / `retrievalOperation` lookups |

### Regression
Retrieval/compression algorithm outputs unchanged. Scope limited to error UX and dashboard guidance; no ranking, threshold, or stage-order changes observed.

## Verification Score
- **Score:** 94 / 100
- **Objectives met:** 3 / 3
- **Anti-objectives violated:** none

**Rubric breakdown:**

| Dimension | Weight | Score | Notes |
|-----------|--------|-------|-------|
| Objectives met | 40% | 40 | All three objectives met with automated + source evidence |
| Anti-objectives clean | 25% | 25 | Sprint + global anti-objectives verified |
| Test coverage | 20% | 14 | Store + client unit tests strong; no route-level HTTP or browser E2E |
| Regression safety | 15% | 15 | No algorithm or trace-payload regressions |

## Measurements
| Metric | Before | After | Target | Evidence |
|--------|--------|-------|--------|----------|
| ux | opaque 400 string or generic not-found | structured 400 with `retrievalTraceId` + inline dashboard hints | less ID confusion | 10/10 sprint-30 tests pass; `CompressionTracesPage` hint panel + `compression_trace_id_provided` contract |

## Places for improvement
- Add a Fastify `inject` integration test for `POST /compress` with a compression trace ID to assert HTTP 400 body shape end-to-end (store tests cover logic but not the route wire-up).
- Add a manual or Playwright checklist for the full compress happy path (retrieve → compress → navigate to detail) to satisfy the E2E checklist item without relying on source inspection.
- Consider surfacing the structured hint when `GET /retrieval/:id` returns 404 but summary lookup succeeds, without waiting for form submit (currently hint appears on input blur via effect — already implemented; document in sprint README for operators).
