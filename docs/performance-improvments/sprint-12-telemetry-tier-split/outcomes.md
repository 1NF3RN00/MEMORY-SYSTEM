# Sprint-12 Outcomes — Split Telemetry Summary vs Analytics

## Status
- **Implementation:** complete
- **Verification:** complete

## Audit mapping
- **IDs:** OP-8, FE-004, AR-001
- **Priority:** P1
- **Effort:** 3-5 days

## Implementation summary

Split `fetchWorkspaceTelemetry` into explicit **summary** and **analytics** tiers per `DASHBOARD_LOAD_AUDIT.md` §4.

### Code changes

| Area | Change |
|------|--------|
| `apps/dashboard/src/lib/workspaceTelemetry.ts` | Added `TELEMETRY_TIER_BOUNDARIES`, `fetchTelemetrySummaryBundle`, `fetchTelemetryAnalyticsBundle`, `fetchTelemetrySummary`, `fetchTelemetryAnalytics`, `buildWorkspaceTelemetryFromBundle`. `fetchWorkspaceTelemetry` is now an alias for full (summary + analytics). |
| `apps/dashboard/src/components/homepage/useOperationalHomeData.ts` | Home mount loads summary only (4 requests). Poll stays at 15s; polls summary until analytics expanded, then full bundle. |
| `apps/dashboard/src/components/homepage/OperationalIntelligencePanels.tsx` | “Load diagnostics” button triggers analytics tier on demand. |
| `apps/dashboard/src/pages/HomePage.tsx` | Wires `requestAnalytics` into intelligence panels. |
| `apps/dashboard/src/components/layout/MetricsSidebar.tsx` | Uses `fetchTelemetrySummary` (non-home sidebar counts). |
| `apps/dashboard/src/pages/ObservabilityPage.tsx` | Unchanged — still uses `fetchWorkspaceTelemetry` + `fetchRankingBreakdown` for full analytics. |
| `docs/performance-improvments/sprint-12-telemetry-tier-split/TIER_BOUNDARIES.md` | Tier endpoint mapping reference. |
| `apps/dashboard/src/lib/sprint-12-telemetry-tier-split.test.ts` | Automated tier-boundary and request-count tests. |

### Tier mapping

| Tier | Function | Requests | Load trigger |
|------|----------|----------|--------------|
| Summary | `fetchTelemetrySummary` | **4** | Home mount, MetricsSidebar, home poll (pre-expand) |
| Analytics | `fetchTelemetryAnalytics` | **5–6** | Observability route, home “Load diagnostics”, home poll (post-expand) |
| Full | `fetchWorkspaceTelemetry` | 9–10 | Observability (backward-compatible alias) |

**Summary endpoints:** `/memory`, `/retrieval`, `/ingestion`, `/health`

**Analytics endpoints:** `/compression`, `/context/render`, `/diagnostics/drift`, `/diagnostics/operational?mode=slim`, `/retrieval/heatmaps`, optional `/compression/:id?summary=true`

### Evidence

- `fetchTelemetrySummary` issues exactly 4 API calls (see `sprint-12-telemetry-tier-split.test.ts`).
- Home hook imports `fetchTelemetrySummaryBundle`, not `fetchWorkspaceTelemetry`.
- Observability retains full bundle + ranking on demand.
- All 84 dashboard vitest tests pass (`npm test` in `apps/dashboard`).

## Anti-objectives avoided

| Anti-objective | How avoided |
|----------------|-------------|
| Do not break Observability completeness | `ObservabilityPage` still calls `fetchWorkspaceTelemetry` (full alias) and `fetchRankingBreakdown`; all panels (heatmap, compression, traces) receive complete data. |
| Do not duplicate logic unmaintainably | Single assembly path via `buildWorkspaceTelemetryFromBundle`; summary and analytics only differ in fetch bundles. |
| Do not break API contracts silently | `fetchWorkspaceTelemetry` export preserved as full-bundle alias; no API route changes. |
| GA-1 | No retrieval ranking, thresholds, or pipeline stage changes. |
| GA-2 | No ML/heuristic tuning; tier split is fetch gating only. |
| GA-3 | Trace payloads unchanged; Observability still loads full telemetry shape. |
| GA-4 | Request counts verified by unit tests, not fabricated benchmarks. |
| GA-5 | Scope limited to telemetry client + home/sidebar hooks; no unrelated refactors. |
| GA-6 | No trace field removals. |
| GA-7 | No new database tables. |

## Verification summary

Verification ran sprint-12 automated tests plus the full dashboard vitest suite (84 tests). All objectives met; no anti-objective or global GA violations observed.

### Testing framework

| Check | Method | Result |
|-------|--------|--------|
| Home request count drops | `fetchTelemetrySummary` mock fetch — asserts 4 calls, no diagnostics/heatmap | Pass |
| Observability full analytics | Source check + `fetchWorkspaceTelemetry` mock — ≥9 calls incl. diagnostics | Pass |
| Tier mapping documented | `TELEMETRY_TIER_BOUNDARIES` export + `TIER_BOUNDARIES.md` | Pass |
| Regression safety | Full dashboard suite (`npm test` in `apps/dashboard`) | 84/84 pass |

**Commands run (2026-06-08):**

```text
cd apps/dashboard
npm test -- sprint-12-telemetry-tier-split.test.ts   # 8/8 pass
npm test                                            # 84/84 pass
```

### Objective results
| # | Objective | Result | Evidence |
|---|-----------|--------|----------|
| 1 | Home loads summary tier on mount | **met** | `useOperationalHomeData` mount calls `fetchTelemetrySummaryBundle` only (4 endpoints: memory, retrieval, ingestion, health). Static import guard: no `fetchWorkspaceTelemetry` in hook. Mock test confirms exactly 4 API calls with no `/diagnostics/` or `/heatmaps`. |
| 2 | Analytics on Observability or panel expand | **met** | `ObservabilityPage` still uses `fetchWorkspaceTelemetry` + `fetchRankingBreakdown`. Home exposes “Load diagnostics” → `requestAnalytics` → `fetchTelemetryAnalyticsBundle`. Post-expand poll switches to `fetchTelemetryAnalytics`. |
| 3 | Tier boundaries documented | **met** | `TELEMETRY_TIER_BOUNDARIES` in `workspaceTelemetry.ts`, `TIER_BOUNDARIES.md` in sprint folder, inline JSDoc table. Tests assert summary=4 endpoints, analytics≥5. |

### Anti-objective results
| Anti-objective | Violated? | Evidence |
|----------------|-----------|----------|
| Do not break Observability completeness | **no** | `ObservabilityPage` unchanged contract: full bundle + ranking on demand; heatmap/compression panels still fed from complete telemetry shape. |
| Do not duplicate logic unmaintainably | **no** | Single merge path via `buildWorkspaceTelemetryFromBundle`; tiers differ only in fetch bundles (`fetchTelemetrySummaryBundle` vs `fetchTelemetryAnalyticsBundle`). |
| Do not break API contracts silently | **no** | `fetchWorkspaceTelemetry` preserved as full-bundle alias; no API route changes; prior sprint tests (05, 06, 27, 28) still pass. |
| GA-1 (ranking/thresholds) | **no** | Fetch gating only; no retrieval pipeline changes. |
| GA-2 (non-deterministic tuning) | **no** | Static tier boundaries; no ML/heuristics. |
| GA-3 (trace payload breaks) | **no** | `WorkspaceTelemetry` shape unchanged; Observability loads same fields after full fetch. |
| GA-4 (fabricated numbers) | **no** | Request counts from vitest mock call inspection, not estimated benchmarks. |
| GA-5 (scope creep) | **no** | Changes limited to telemetry client, home hook, sidebar, sprint docs/tests. |
| GA-6 (trace field removal) | **no** | No `stages[]` or trace field removals. |
| GA-7 (new DB tables) | **no** | Dashboard-only change. |

## Verification Score
- **Score:** 98 / 100
- **Objectives met:** 3 / 3
- **Anti-objectives violated:** none

**Rubric breakdown**

| Dimension | Weight | Score | Notes |
|-----------|--------|-------|-------|
| Objectives met | 40% | 40 | All three objectives verified with code + automated tests |
| Anti-objectives clean | 25% | 25 | Sprint + GA-1–GA-7 clean |
| Test coverage | 20% | 19 | Strong unit/source tests; hook mount not runtime-tested with React Testing Library |
| Regression safety | 15% | 14 | Full suite green; no retrieval/compression API changes; home panels show placeholder analytics until expand (by design) |

## Measurements
| Metric | Before | After | Target | Evidence |
|--------|--------|-------|--------|----------|
| Home telemetry requests (mount) | 12 parallel + follow-ups (audit) / 9–10 (impl) | **4** (summary tier) | 12 → 4 on home | `sprint-12-telemetry-tier-split.test.ts` — `fetchTelemetrySummary` mock: 4 calls, paths `/memory`, `/retrieval`, `/ingestion`, `/health` only |
| Home telemetry requests (post-expand) | 9–10 | 9–10 (full bundle via analytics merge) | — | `fetchWorkspaceTelemetry` mock: ≥9 calls; `fetchTelemetryAnalyticsBundle` hits 5 core analytics endpoints |
| Dashboard test suite | — | 84 / 84 pass | no regressions | `npm test` in `apps/dashboard` (2026-06-08) |

## Places for improvement

1. **Hook runtime test:** Add a React Testing Library test for `useOperationalHomeData` that mocks fetch on mount and asserts exactly 4 requests before any user interaction (today verified via static source + summary function test).
2. **HAR baseline:** Capture a DevTools Network HAR on home load before/after in a real workspace to complement mock-based request counts (per `DASHBOARD_LOAD_AUDIT.md` validation guidance).
3. **Sprint-28 test wording:** `sprint-28-consolidated-health-polling.test.ts` still describes `fetchWorkspaceTelemetry` as the “sole home health caller”; home now routes health via `fetchTelemetrySummaryBundle` — test passes but label is stale.
