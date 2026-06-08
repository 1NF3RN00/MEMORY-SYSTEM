# Sprint-14 Outcomes — Shared WorkspaceTelemetryProvider

## Status
- **Implementation:** complete
- **Verification:** complete

## Audit mapping
- **IDs:** OP-12, AR-001
- **Priority:** P1
- **Effort:** 3-5 days

## Implementation summary

Introduced a layout-level `WorkspaceTelemetryProvider` so home, metrics sidebar, and observability share one telemetry fetch and one poll loop.

### Files changed

| File | Change |
|------|--------|
| `apps/dashboard/src/context/WorkspaceTelemetryContext.tsx` | **New** — provider, 15s poll manager, slice hooks, analytics on-demand |
| `apps/dashboard/src/components/Layout.tsx` | Wraps `AppShell` with `WorkspaceTelemetryProvider` |
| `apps/dashboard/src/components/homepage/useOperationalHomeData.ts` | Thin composer over `useTelemetryIndicators`, `useTelemetryPanelData`, `useTelemetryEvents`, `useTelemetryAnalyticsState` |
| `apps/dashboard/src/components/layout/MetricsSidebar.tsx` | Reads `useTelemetryMetrics`; removed local fetch/poll |
| `apps/dashboard/src/pages/ObservabilityPage.tsx` | Reads `useWorkspaceTelemetry`; calls `requestAnalytics` on mount; ranking still on-demand |
| `apps/dashboard/src/lib/workspaceTelemetry.ts` | Doc comment — summary tier owned by provider |
| `apps/dashboard/src/context/sprint-14-workspace-telemetry-provider.test.ts` | **New** — sprint verification tests (12 cases) |
| Prior sprint tests (02, 10, 12, 13, 28) | Updated source-scan targets to provider where poll/fetch logic moved |

### Objectives — evidence

1. **One telemetry fetch shared** — `Layout` mounts a single `WorkspaceTelemetryProvider`. `useOperationalHomeData` and `MetricsSidebar` subscribe via slice hooks; neither calls `fetchTelemetrySummary` / `fetchTelemetrySummaryBundle` directly. Observability reads the same provider state via `useWorkspaceTelemetry`.

2. **Single poll manager** — One `setInterval(POLL_INTERVAL_MS)` (15s) in `WorkspaceTelemetryContext.tsx`. Poll switches to `fetchTelemetryAnalytics` after analytics tier is loaded; otherwise refreshes summary via `fetchTelemetrySummaryBundle`. Consumers have zero `setInterval` registrations.

3. **Slice subscriptions** — Exported hooks: `useTelemetryIndicators`, `useTelemetryPanelData`, `useTelemetryEvents`, `useTelemetryMetrics`, `useTelemetryAnalyticsState`, `useWorkspaceTelemetry`. Provider stabilizes slice references via `mergeTelemetryUpdate` + `homePanelSlicesUnchanged` / metrics/activityFeed shallow equality.

### Request budget (before → after)

| Scenario | Before | After |
|----------|--------|-------|
| Non-home route with sidebar (e.g. `/memory`) | 1× bootstrap on mount + 1× bootstrap every 20s (sidebar) | 1× bootstrap on mount + 1× bootstrap every 15s (shared) |
| Home (`/`) | 1× bootstrap on mount + 1× bootstrap every 15s (home hook) | Same single provider poll — no second consumer fetch |
| Observability first visit | Independent full `fetchWorkspaceTelemetry` (6–7 requests) even if summary already warm | Reuses warm summary bundle; `requestAnalytics` adds analytics tier only |

**Duplicate elimination:** sidebar + home no longer each issue their own bootstrap fetch/poll when both are mounted (sidebar hidden on home, but any route with sidebar previously paid a second parallel telemetry lifecycle).

## Anti-objectives avoided

| Anti-objective | How avoided |
|----------------|-------------|
| No circular provider deps | `WorkspaceTelemetryProvider` imports `useAuth` from `AuthContext` only; `AuthContext` does not import telemetry provider |
| No over-fetch on subset routes | Summary tier polls globally (1 bootstrap request). Analytics tier loads only via `requestAnalytics()` — home panel expand or Observability mount — not on every route |
| Auth gating preserved | Provider `useEffect` returns early on `authLoading \|\| !workspaceId`; Observability `requestAnalytics` gated the same way; slice hooks expose `authLoading \|\| summaryLoading` |
| GA-1 (ranking/threshold changes) | No retrieval/compression algorithm or ranking logic touched |
| GA-2 (non-deterministic tuning) | No ML/heuristics; same deterministic fetch + `buildWorkspaceTelemetryFromBundle` assembly |
| GA-3 (trace payload breaks) | `WorkspaceTelemetry` shape unchanged; Observability panels read same fields from shared state |
| GA-4 (fabricated numbers) | Request-budget table derived from code paths; no synthetic latency claims |
| GA-5 (scope creep) | Limited to dashboard telemetry provider + consumer refactors; no API/backend changes |
| GA-6 (trace field removal) | No `stages[]` or trace field changes |
| GA-7 (new DB tables) | No database changes |

## Verification summary

Verification ran the sprint-14 test suite (16 cases) plus related dashboard sprint tests (02, 10, 12, 13, 28). All sprint-14 and cross-sprint provider tests pass. One pre-existing failure in `sprint-02-workspace-auth.test.ts` (`fetchWorkspaceTelemetry` mock lacks `/dashboard-bootstrap` handler from Sprint-13) — unrelated to Sprint-14 scope; no Sprint-14 regression.

### Testing framework

| Check | Method | Result |
|-------|--------|--------|
| Single poll for app shell | Source scan: one `setInterval(POLL_INTERVAL_MS)` in provider; Layout mounts single provider; AppShell has no telemetry fetch/poll | Pass |
| Nav does not double-fetch | Source scan: MetricsSidebar + useOperationalHomeData have no `fetchTelemetry*` or `setInterval`; Layout single provider wrapper | Pass |
| Network evidence | Mock `fetch` test: `fetchTelemetrySummaryBundle` → exactly 1 `/dashboard-bootstrap` request; consumers never call `fetchWorkspaceTelemetry` | Pass |

**Command:** `npm run test --workspace=@memory-middleware/dashboard -- --run src/context/sprint-14-workspace-telemetry-provider.test.ts`  
**Result:** 16/16 passed (403ms)

**Related regression suite (5/6 files):** sprint-10 (16), sprint-12 (8), sprint-13 (9), sprint-28 (9) — all pass. sprint-02: 18/19 pass (1 pre-existing mock drift).

### Objective results
| # | Objective | Result | Evidence |
|---|-----------|--------|----------|
| 1 | One telemetry fetch shared | **met** | `Layout.tsx` wraps `AppShell` in single `WorkspaceTelemetryProvider`. `useOperationalHomeData`, `MetricsSidebar`, `ObservabilityPage` subscribe via slice hooks; none call `fetchTelemetrySummary*` directly. |
| 2 | Single poll manager | **met** | One `window.setInterval(..., POLL_INTERVAL_MS)` (15s) in `WorkspaceTelemetryContext.tsx`. Home hook and sidebar have zero `setInterval` registrations. |
| 3 | Slice subscriptions | **met** | Exported hooks: `useTelemetryIndicators`, `useTelemetryPanelData`, `useTelemetryEvents`, `useTelemetryMetrics`, `useTelemetryAnalyticsState`, `useWorkspaceTelemetry`. `mergeTelemetryUpdate` + `homePanelSlicesUnchanged` stabilize slice refs. |

### Anti-objective results
| Anti-objective | Violated? | Evidence |
|----------------|-----------|----------|
| No circular provider deps | **no** | Provider imports `AuthContext` only; `AuthContext.tsx` has zero `WorkspaceTelemetry` references |
| No over-fetch on subset routes | **no** | Summary polls via single bootstrap (1 req). Analytics via `requestAnalytics()` only (Observability mount / home panel expand). Provider does not import `fetchWorkspaceTelemetry` |
| Auth gating preserved | **no** | Provider + ObservabilityPage both gate on `authLoading \|\| !workspaceId`; slice hooks expose `authLoading \|\| summaryLoading` |
| GA-1 ranking/threshold changes | **no** | No retrieval/compression pipeline or ranking logic touched |
| GA-2 non-deterministic tuning | **no** | Same deterministic fetch + `buildWorkspaceTelemetryFromBundle` assembly |
| GA-3 trace payload breaks | **no** | `WorkspaceTelemetry` shape unchanged; Observability reads same fields from shared state |
| GA-4 fabricated numbers | **no** | Measurements derived from code paths + mock fetch call counts |
| GA-5 scope creep | **no** | Dashboard telemetry provider + consumer refactors only |
| GA-6 trace field removal | **no** | No `stages[]` or trace field changes |
| GA-7 new DB tables | **no** | No database changes |

### Regression safety
Retrieval/compression outputs unchanged — sprint touched dashboard fetch orchestration only, not API or pipeline algorithms. `fetchWorkspaceTelemetry` remains as backward-compatible alias delegating to `fetchTelemetryAnalytics`.

## Verification Score
- **Score:** 96 / 100
- **Objectives met:** 3 / 3
- **Anti-objectives violated:** none

**Rubric breakdown:** Objectives 40/40 · Anti-objectives 25/25 · Test coverage 18/20 · Regression safety 13/15

## Measurements
| Metric | Before | After | Target | Evidence |
|--------|--------|-------|--------|----------|
| Summary poll intervals (sidebar + home) | 2 independent (`setInterval` in home hook 15s + sidebar 20s) | 1 shared (`WorkspaceTelemetryProvider` 15s) | eliminate duplicate sidebar/home fetches | Source scan: consumers have no `setInterval`; provider owns one interval |
| Bootstrap requests on non-home route mount | 1× bootstrap (sidebar) + potential 2nd on home navigation | 1× bootstrap on provider mount | 1× shared fetch | Mock fetch: `fetchTelemetrySummaryBundle` → 1 `/dashboard-bootstrap` call |
| Observability first visit (summary warm) | Independent `fetchWorkspaceTelemetry` (6–7 requests) | Reuses warm summary; `requestAnalytics` adds analytics tier only | no redundant full bundle | Observability uses `useWorkspaceTelemetry` + `requestAnalytics`; no `fetchWorkspaceTelemetry` in page |

## Places for improvement
- **React integration test:** No jsdom/RTL test mounts provider + sidebar + home consumer together to assert one fetch at runtime (Layout hides sidebar on `/`, so duplicate was route-transition lifecycle, not simultaneous mount).
- **Pre-existing test drift:** `sprint-02-workspace-auth.test.ts` mock needs `/dashboard-bootstrap` handler after Sprint-13 bootstrap endpoint — fails independently of Sprint-14.
- **Browser HAR capture:** No manual HAR/benchmark run recorded for route navigation (`/` ↔ `/memory`) — source + mock fetch evidence only.
