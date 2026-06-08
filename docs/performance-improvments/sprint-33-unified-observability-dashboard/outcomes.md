# Sprint-33 Outcomes — Unified Observability Dashboard

## Status
- **Implementation:** complete
- **Verification:** complete

## Audit mapping
- **IDs:** long-term
- **Priority:** P2
- **Effort:** 2-4 weeks

## Implementation summary

Unified timing, LLM, and database observability into a single read-only pane on retrieval trace detail.

### API (`retrieval-store.ts`, `retrieval.ts`, `retrieval-contracts.ts`)
- Added `llmCallAudit?: LlmCallAudit` to `StoredRetrievalResult` and `RetrievalTraceView`.
- Added `dbObservability?: RetrievalDbObservability` to `RetrievalTraceView` (already persisted; now returned on `GET /retrieval/:traceId`).
- `POST /retrieve` success and failure paths now persist `llmCallAudit` alongside existing `timingAudit` and `dbObservability`.

### Dashboard
- Added `apps/dashboard/src/lib/traceObservability.ts` — summary builders, availability checks, deep-link helpers.
- Added `apps/dashboard/src/components/observability/TraceObservabilityPanel.tsx` — one pane with:
  - Summary metric strip (execution time, LLM calls/tokens/cost, DB queries/time, anomalies)
  - Subview tabs (All / Timing / LLM / Database)
  - Execution timing via existing `RetrievalTimeline`
  - LLM call table (operation, model, tokens, latency, cost)
  - DB audit tables (slow queries, duplicate groups)
  - Graceful unavailable states when audit data is missing on older traces
- `RetrievalTracesPage` trace detail: replaced standalone "Pipeline Timeline" with `OBS.UNIFIED` panel; supports `?view=observability` deep link with scroll + highlight.
- `RetrievalTracesPage` and `ObservabilityPage` trace lists: added "Observability" link column pointing to `?view=observability`.

### Tests
- `apps/dashboard/src/lib/sprint-33-unified-observability-dashboard.test.ts` — 17/17 pass.
- Sprint-24 regression (`sprint-24-dashboard-timing-audit-display.test.ts`) — 13/13 pass.
- Sprint-07 API regression (`sprint-07-retrieval-db-observability.test.ts`) — 4/4 pass.

## Anti-objectives avoided

| Anti-objective | How avoided |
|----------------|-------------|
| No unnecessary duplication | Removed standalone "Pipeline Timeline" panel; timing now lives only inside `TraceObservabilityPanel` via `RetrievalTimeline`. |
| No new tables | Reuses existing `retrievalOperation.result` JSON blob; no schema migration. |
| Graceful missing db on old traces | `hasDbData` / `hasLlmData` / `hasTimingData` gate sections; unavailable badges and copy explain missing instrumentation. |
| GA-1 | No retrieval ranking, thresholds, or pipeline stage ordering changed. |
| GA-2 | No ML heuristics or non-deterministic tuning; display-only aggregation of persisted audits. |
| GA-3 | Existing trace fields (`stages[]`, `timingAudit`, `contextPackage`) preserved; only additive `llmCallAudit` / `dbObservability` on GET. |
| GA-4 | No performance numbers fabricated; evidence is unit/source tests only. |
| GA-5 | Scope limited to unified observability UI + trace GET/persist wiring for audit fields. |
| GA-6 | No `stages[]` or trace fields removed. |
| GA-7 | No new database tables; JSON result blob only. |

## Verification summary

Verification extended the sprint-33 test suite with behavioral partial-data cases and deep-link UX source checks, then ran dashboard and API regression suites.

### Testing framework
| Check | Result | Evidence |
|-------|--------|----------|
| All audits when present | pass | `buildObservabilitySummary` aggregates timing+LLM+DB; panel renders `OBS.TIME`, `OBS.LLM`, `OBS.DB` sections |
| Partial data OK | pass | Independent `has*Data` gates; summary builders tolerate missing audits; unavailable badges + copy |
| UX review | pass | `OBS.UNIFIED` panel, subview tabs, metric strip, list "Audits" column, `?view=observability` scroll/highlight |

### Test runs (2026-06-08)
```
apps/dashboard: sprint-33 — 17/17 pass
apps/dashboard: sprint-24 regression — 13/13 pass
apps/api: sprint-07 regression — 4/4 pass (npx tsx --test)
```

### Objective results
| # | Objective | Result | Evidence |
|---|-----------|--------|----------|
| 1 | All three audits on trace detail | **met** | `TraceObservabilityPanel` wires timing (`RetrievalTimeline`), LLM table, DB tables; `RetrievalTracesPage` passes `timingAudit`, `llmCallAudit`, `dbObservability`; GET maps all three from `retrieval-store.ts` |
| 2 | Link from list | **met** | `observabilityTraceHref` → `/retrieval-traces/:id?view=observability`; "Observability" links on `RetrievalTracesPage` and `ObservabilityPage` list tables; deep link scrolls + highlights panel |
| 3 | Read-only | **met** | No `apiPost`/`apiPut`/`apiDelete`/`onSubmit` in panel; subview controls are `type="button"` only |

### Anti-objective results
| Anti-objective | Violated? | Evidence |
|----------------|-----------|----------|
| No unnecessary duplication | **no** | Standalone "Pipeline Timeline" removed from `RetrievalTracesPage`; timing only inside unified panel |
| No new tables | **no** | `StoredRetrievalResult` JSON fields only; no Prisma schema/migration changes |
| Graceful missing db on old traces | **no** | `hasDbData`/`hasLlmData`/`hasTimingData`; unavailable badge + "Older traces may predate DB instrumentation" copy |
| GA-1 | **no** | No changes under `packages/retrieval/src/pipeline.ts` ranking/threshold paths |
| GA-2 | **no** | Display-only aggregation; no autonomous/ML tuning |
| GA-3 | **no** | `stages[]`, `timingAudit`, `contextPackage` unchanged; additive GET fields only |
| GA-4 | **no** | Measurements cite code/tests only |
| GA-5 | **no** | Scope limited to observability UI + audit field wiring |
| GA-6 | **no** | No trace fields removed |
| GA-7 | **no** | JSON blob persistence only |

### Regression safety
Retrieval/compression pipeline outputs unchanged. Sprint-24 timing display regression (13/13) and Sprint-07 DB observability persistence (4/4) pass. `HistorianPage` retains legacy-only `RetrievalTimeline` wiring per Sprint-24 contract.

## Verification Score
- **Score:** 95 / 100
- **Objectives met:** 3 / 3
- **Anti-objectives violated:** none

**Rubric breakdown**
| Dimension | Weight | Score | Notes |
|-----------|--------|-------|-------|
| Objectives met | 40% | 40 | All three objectives met with automated evidence |
| Anti-objectives clean | 25% | 25 | Sprint + global GA-1–GA-7 clean |
| Test coverage | 20% | 15 | Strong source + unit tests; no component render or E2E browser tests |
| Regression safety | 15% | 15 | Sprint-24 and Sprint-07 regressions pass |

## Measurements
| Metric | Before | After | Target | Evidence |
|--------|--------|-------|--------|----------|
| dx | three separate surfaces (timing in pipeline panel; LLM/DB not in UI) | one `OBS.UNIFIED` pane with timing + LLM + DB subviews | one pane all audits | `TraceObservabilityPanel.tsx`, `RetrievalTracesPage.tsx`; 17 sprint-33 tests |
| trace list navigation | trace ID link only | + "Observability" deep link column on retrieval + observability pages | link from list | `observabilityTraceHref`, list tables in both pages |
| old-trace UX | N/A (DB not shown) | unavailable badges per audit section | graceful missing db | `hasDbData` gates + copy in `TraceObservabilityPanel` |

## Places for improvement
- Add React Testing Library render tests for `TraceObservabilityPanel` (tab switching, unavailable states) instead of source-only assertions.
- Add a lightweight E2E or Playwright check for `?view=observability` scroll/highlight behavior in a real browser.
- Consider unified observability deep links from compression trace detail (out of current sprint scope).
