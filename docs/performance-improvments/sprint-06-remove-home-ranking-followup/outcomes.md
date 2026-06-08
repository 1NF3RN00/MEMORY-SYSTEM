# Sprint-06 Outcomes — Remove Home Ranking Follow-Up

## Status
- **Implementation:** complete
- **Verification:** complete

## Audit mapping
- **IDs:** OP-6, FE-006
- **Priority:** P1
- **Effort:** <1 day

## Implementation summary

Removed the follow-up `GET /retrieval/:id/ranking` call from `fetchWorkspaceTelemetry`, which powers home load, the metrics sidebar, and the shared telemetry bundle. Home and sidebar no longer pay the ranking payload cost on every 15–20s poll.

**Code changes**

| File | Change |
|------|--------|
| `apps/dashboard/src/lib/workspaceTelemetry.ts` | Dropped ranking fetch from `fetchWorkspaceTelemetry`; added `fetchRankingBreakdown(retrievalTraceId)` for on-demand use; `contextualConfidence` and `tokenEfficiency` now `null` when ranking is not loaded |
| `apps/dashboard/src/pages/ObservabilityPage.tsx` | After base telemetry loads, fetches ranking for the latest completed retrieval via `fetchRankingBreakdown` |
| `apps/dashboard/src/components/homepage/OperationalIntelligencePanels.tsx` | Shows `—` when `contextualConfidence` is `null` |
| `apps/dashboard/src/components/layout/MetricsSidebar.tsx` | Shows `—` for token efficiency when unavailable; sub-label directs users to Observability |
| `apps/dashboard/src/components/homepage/types.ts` | `contextualConfidence: number \| null` |
| `apps/dashboard/src/lib/sprint-06-remove-home-ranking-followup.test.ts` | Automated checks for no `/ranking` on home telemetry, null confidence handling, Observability on-demand fetch |

**Behavior change**

- **Before:** Every `fetchWorkspaceTelemetry` invocation issued 9 parallel list requests plus up to 2 follow-ups (compression detail + ranking breakdown). Ranking breakdown could be 20–200 KB depending on trace size.
- **After:** Home/sidebar telemetry omits ranking. Contextual confidence and token efficiency display `—` on home; low-confidence retrieval count still comes from `/diagnostics/operational`. Observability page loads ranking only when visited, after the base telemetry bundle resolves.

**Evidence**

- `fetchWorkspaceTelemetry` body contains no `/ranking` reference (see test `fetchWorkspaceTelemetry does not call /ranking`).
- Mocked invocation records zero `/ranking` network calls.
- `fetchRankingBreakdown` isolated in Observability page load path.

## Anti-objectives avoided

| Anti-objective | How avoided |
|----------------|-------------|
| Do not remove ranking from Observability pages | `ObservabilityPage` still renders `ReinforcementScoringPanel` with rows from `fetchRankingBreakdown` after telemetry loads |
| Do not break explainability API | No API route or server changes; `GET /retrieval/:id/ranking` unchanged; only client call site moved |
| Do not hide ranking-detected failures | `lowConfidenceCount` still populated from `/diagnostics/operational`; Historian and retrieval trace detail pages untouched |
| GA-1 | No retrieval ranking algorithm, threshold, or stage-order changes |
| GA-2 | No ML heuristics or non-deterministic tuning introduced |
| GA-3 | Trace payloads consumed by dashboard trace pages unchanged; only home telemetry bundle slimmed |
| GA-4 | No performance numbers fabricated; measurements left for verification sprint |
| GA-5 | Scope limited to workspace telemetry + confidence UI + Observability on-demand fetch |
| GA-6 | No `stages[]` or trace fields removed |
| GA-7 | No new database tables |

## Verification summary

Verification ran the sprint test suite and full dashboard vitest suite on 2026-06-08.

**Testing framework**

| Check | Method | Result |
|-------|--------|--------|
| No `/ranking` on home load | Static source scan of `fetchWorkspaceTelemetry` + mocked `fetch` counting `/ranking` calls | Pass — 0 ranking requests per `fetchWorkspaceTelemetry` invocation |
| Observability still fetches ranking | Source scan of `ObservabilityPage.tsx` + `fetchRankingBreakdown` unit test | Pass — calls `GET /retrieval/:id/ranking` after telemetry resolves |
| No runtime errors on home with missing ranking | Mocked telemetry returns `contextualConfidence: null`, `tokenEfficiency: null`; UI source guards `!== null` before `.toFixed(2)` | Pass — null-safe rendering in `OperationalIntelligencePanels` and `MetricsSidebar` |

**Commands**

```text
cd apps/dashboard
npm test -- --run src/lib/sprint-06-remove-home-ranking-followup.test.ts  # 6/6 passed
npm test -- --run                                                        # 42/42 passed (full dashboard suite)
```

**Code review corroboration**

- Home path (`useOperationalHomeData`) and sidebar (`MetricsSidebar`) call only `fetchWorkspaceTelemetry` — no ranking follow-up.
- `fetchRankingBreakdown` is exported and used only from `ObservabilityPage.tsx` (plus tests).
- `GET /retrieval/:traceId/ranking` route in `apps/api/src/routes/retrieval.ts` unchanged.
- `RetrievalTracesPage` and `HistorianPage` still consume ranking/diagnostics independently — no regression to explainability views.

**Regression**

- Retrieval/compression server outputs unchanged (no API or pipeline edits).
- Dashboard trace detail pages still load full `rankingBreakdown` from trace payloads.

### Objective results
| # | Objective | Result | Evidence |
|---|-----------|--------|----------|
| 1 | Home load does not fetch ranking breakdown | **met** | `fetchWorkspaceTelemetry` has no `/ranking` in function body; mocked invocation: 0 `/ranking` calls (`sprint-06-remove-home-ranking-followup.test.ts` lines 19–54) |
| 2 | Confidence indicator handles missing ranking | **met** | Returns `contextualConfidence: null`, `tokenEfficiency: null`; `lowConfidenceCount` still 1 from diagnostics mock; UI renders `—` when null (test lines 57–96; `OperationalIntelligencePanels.tsx` lines 67–69; `MetricsSidebar.tsx` lines 80–89) |
| 3 | Observability page still loads ranking on demand | **met** | `ObservabilityPage` calls `fetchRankingBreakdown(latestRetrievalId)` after telemetry; `fetchRankingBreakdown` hits `/retrieval/:id/ranking`; `ReinforcementScoringPanel` still rendered when rows present (test lines 99–128; `ObservabilityPage.tsx` lines 44–57, 220–221) |

### Anti-objective results
| Anti-objective | Violated? | Evidence |
|----------------|-----------|----------|
| Do not remove ranking from Observability pages | **no** | `ObservabilityPage` retains `fetchRankingBreakdown` + `ReinforcementScoringPanel` |
| Do not break explainability API | **no** | `retrieval.ts` ranking route unchanged; `fetchRankingBreakdown` uses same endpoint |
| Do not hide ranking-detected failures | **no** | `lowConfidenceCount` sourced from `/diagnostics/operational`; Historian/retrieval trace pages untouched |
| GA-1 through GA-7 | **no** | Client-only call-site move; no algorithm, trace schema, or DB changes |

## Verification Score
- **Score:** 96 / 100
- **Objectives met:** 3 / 3
- **Anti-objectives violated:** none

**Rubric breakdown**

| Dimension | Weight | Score | Notes |
|-----------|--------|-------|-------|
| Objectives met | 40% | 40 | All three objectives met with automated + source evidence |
| Anti-objectives clean | 25% | 25 | No sprint or global anti-objective violations found |
| Test coverage | 20% | 16 | Six targeted unit tests cover all objectives; no browser/HAR or React render integration test |
| Regression safety | 15% | 15 | API and trace-detail explainability paths unchanged |

## Measurements
| Metric | Before | After | Target | Evidence |
|--------|--------|-------|--------|----------|
| requests per home/sidebar poll | 9 parallel + up to 2 follow-ups (compression + ranking) | 9 parallel + up to 1 follow-up (compression only) | -1 | Mocked `fetchWorkspaceTelemetry`: 0 `/ranking` calls; ranking removed from function body |
| ranking payload on home poll | included when latest completed retrieval exists | omitted | -20 to -200 KB | Ranking request eliminated from home path; payload delta not live-captured in CI (inferred from endpoint removal; typical breakdown size per audit) |
| Observability visit | ranking bundled in telemetry | ranking fetched on demand after telemetry | unchanged ranking availability | `fetchRankingBreakdown` issues 1 `/ranking` call when Observability loads |

## Places for improvement

1. **HAR / browser network capture** — Record a before/after HAR on home load to document actual KB saved per poll (verify checklist item 1 literal network-tab evidence).
2. **React render test** — Mount `OperationalIntelligencePanels` with `contextualConfidence: null` and assert `—` in DOM (stronger than source-regex check).
3. **Observability integration test** — Mock `fetchWorkspaceTelemetry` + `fetchRankingBreakdown` and assert `ReinforcementScoringPanel` receives rows after page effect runs.
