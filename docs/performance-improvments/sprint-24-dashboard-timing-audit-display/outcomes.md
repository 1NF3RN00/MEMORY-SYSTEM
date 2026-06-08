# Sprint-24 Outcomes — Dashboard timingAudit Display

## Status
- **Implementation:** complete
- **Verification:** complete

## Audit mapping
- **IDs:** OP-23
- **Priority:** P2
- **Effort:** 3-5 days

## Implementation summary

Shipped hrtime-based pipeline timing in the existing `RetrievalTimeline` on `RetrievalTracesPage` — no new routes or fetches.

| Area | File | Change |
|------|------|--------|
| Timeline utilities | `apps/dashboard/src/lib/timelineTiming.ts` | `formatDurationMs`, `formatTimingStageLabel`, `resolveTimelineStages`, `timingAuditToStageRecords` |
| Timeline UI | `apps/dashboard/src/components/observability/RetrievalTimeline.tsx` | Optional `timingAudit` prop; prefers hrtime stages; shows `hrtime` badge and sub-ms durations; legacy fallback |
| Trace page | `apps/dashboard/src/pages/RetrievalTracesPage.tsx` | `TraceDetail.trace.timingAudit` type; passes audit to timeline |
| Trace persistence | `apps/api/src/lib/retrieval-store.ts` | `StoredRetrievalResult.timingAudit`; returned on `getRetrievalTrace` |
| Route wiring | `apps/api/src/routes/retrieval.ts` | Persist `request.timingCollector.toAudit()` on completed/failed retrieval |
| Shared contract | `packages/shared-types/src/retrieval-contracts.ts` | `RetrievalTraceView.timingAudit?: ExecutionTimingAudit` |
| Tests | `apps/dashboard/src/lib/sprint-24-dashboard-timing-audit-display.test.ts` | 13 unit/source tests |

**Behavior**

1. When `timingAudit.stages[]` is present on a trace, the timeline renders hrtime stages with colon hierarchy labels (e.g. `Vector Search · Embedding`) and millisecond values trimmed to 3 decimal places.
2. When `timingAudit` is absent or empty, the timeline falls back to legacy `stages[]` and integer-ms display (Historian replay and older traces unchanged).
3. Total latency uses `timingAudit.totalLatency` when hrtime data is active; otherwise the existing `totalLatencyMs` prop.

**Evidence:** `npm test -- src/lib/sprint-24-dashboard-timing-audit-display.test.ts` — 13/13 pass.

## Anti-objectives avoided

| Anti-objective | How avoided |
|----------------|-------------|
| Do not break timeline | Legacy `stages` prop remains supported; `HistorianPage` unchanged; empty/absent `timingAudit` falls back to legacy rendering |
| No extra fetches | `timingAudit` piggybacks on existing `GET /retrieval/:traceId` via persisted `result` JSON — no new endpoint or client request |
| Correct hierarchy labels | `formatTimingStageLabel` splits `parent:child` stage names; route paths (`POST /retrieve`) preserved verbatim |
| GA-1 | No retrieval ranking, threshold, or stage-order changes |
| GA-2 | Display-only; no ML/heuristics |
| GA-3 | Legacy `stages[]` unchanged; `timingAudit` is additive on trace view |
| GA-4 | No performance numbers fabricated in outcomes |
| GA-5 | Scoped to timeline display + minimal trace persistence required for no-extra-fetch objective |
| GA-6 | `stages[]` retained; `timingAudit` appended |
| GA-7 | No new DB tables; audit stored in existing `retrievalOperation.result` JSON |

## Verification summary

Verification ran the sprint test suite and inspected implementation wiring against `implement.md` objectives and anti-objectives.

**Test command:** `cd apps/dashboard && npm test -- src/lib/sprint-24-dashboard-timing-audit-display.test.ts`  
**Result:** 13/13 passed (353ms)

**Testing framework coverage**

| Check | Method | Result |
|-------|--------|--------|
| timingAudit renders | Unit tests on `resolveTimelineStages`, `formatDurationMs`; source assertions on `RetrievalTimeline` / `RetrievalTracesPage` | Pass |
| Legacy trace works | Fallback tests (absent + empty `timingAudit`); `HistorianPage` source check (legacy-only wiring) | Pass |
| Visual QA | Source inspection: hrtime badge, sub-ms `formatDurationMs`, colon hierarchy labels (`stageLabel.sub`) | Pass (no browser snapshot) |

**Regression:** Retrieval pipeline (`packages/retrieval/src/pipeline.ts`) unchanged. Sprint changes are display + trace JSON persistence only; legacy `stages[]` contract preserved on `RetrievalTraceView`.

### Objective results
| # | Objective | Result | Evidence |
|---|-----------|--------|----------|
| 1 | Hrtime stages in UI | **met** | `resolveTimelineStages` prefers `timingAudit.stages` (`source: "hrtime"`); `RetrievalTimeline` shows `hrtime` badge and `formatDurationMs` sub-ms values; `RetrievalTracesPage` passes `trace.timingAudit` |
| 2 | Fallback to legacy stages[] | **met** | Absent/empty `timingAudit` → `source: "legacy"` with original `stages`; `HistorianPage` still uses `<RetrievalTimeline stages={timelineStages} />` only |
| 3 | No new page | **met** | `App.tsx` has no timing-audit route; enhancement lives on existing `/retrieval-traces/:traceId` |

### Anti-objective results
| Anti-objective | Violated? | Evidence |
|----------------|-----------|----------|
| Do not break timeline | **no** | Legacy `stages?: StageRecord[]` prop retained; historian and empty-audit paths use legacy rendering |
| No extra fetches | **no** | `timingAudit` piggybacks on existing trace GET via `retrieval-store` + `retrieval.ts` persistence; no new client fetch patterns |
| Correct hierarchy labels | **no** | `formatTimingStageLabel` splits `vector_search:embedding` → `Vector Search · Embedding`; route paths preserved verbatim (`POST /retrieve`) |
| GA-1 (ranking/threshold changes) | **no** | No retrieval pipeline or ranking edits |
| GA-2 (non-deterministic tuning) | **no** | Display-only formatting |
| GA-3 (trace payload breakage) | **no** | `timingAudit` additive; `stages[]` unchanged |
| GA-4 (fabricated numbers) | **no** | Measurements cite test output and source behavior only |
| GA-5 (scope creep) | **no** | Scoped to timeline + minimal persistence |
| GA-6 (stages[] removal) | **no** | `stages[]` retained on contract and UI fallback |
| GA-7 (new DB tables) | **no** | Stored in existing `retrievalOperation.result` JSON |

## Verification Score
- **Score:** 97 / 100
- **Objectives met:** 3 / 3
- **Anti-objectives violated:** none

| Dimension | Weight | Score | Notes |
|-----------|--------|-------|-------|
| Objectives met | 40% | 40 | All three objectives met with automated + source evidence |
| Anti-objectives clean | 25% | 25 | Sprint and global anti-objectives verified clean |
| Test coverage | 20% | 17 | 13 unit/source tests; no RTL render or browser visual snapshot |
| Regression safety | 15% | 15 | Legacy timeline path and retrieval outputs unchanged |

## Measurements
| Metric | Before | After | Target | Evidence |
|--------|--------|-------|--------|----------|
| dx | timingAudit only in POST response / logs | hrtime stages visible on retrieval trace timeline | hrtime visible in dashboard | `RetrievalTimeline` hrtime badge + sub-ms `formatDurationMs`; 13/13 sprint tests pass |
| Sprint test pass rate | — | 13/13 (100%) | All verification tests green | `npm test -- src/lib/sprint-24-dashboard-timing-audit-display.test.ts` |

## Places for improvement
- Add a React Testing Library render test for `RetrievalTimeline` with `SAMPLE_TIMING_AUDIT` to assert DOM output (badge text, hierarchy labels, sub-ms values) instead of source-regex checks alone.
- Add an API integration test that completes a retrieval, fetches `GET /retrieval/:traceId`, and asserts `timingAudit` round-trips through `retrieval-store`.
