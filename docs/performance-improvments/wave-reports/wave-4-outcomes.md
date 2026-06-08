# Wave 4 outcomes — Dashboard data layer
- **Focus:** Telemetry tiers, bootstrap endpoint, shared provider, React Query.
- **Generated:** 2026-06-08T20:52:24.165Z
- **Sprints:** 4/4 verified complete
- **Average score:** 97/100
| Sprint | Folder | Impl | Verify | Score | Objectives |
|--------|--------|------|--------|-------|------------|
| 12 | sprint-12-telemetry-tier-split | complete | complete | 98 | 3 / 3 |
| 13 | sprint-13-dashboard-bootstrap-endpoint | complete | complete | 96 | 3/3 |
| 14 | sprint-14-workspace-telemetry-provider | complete | complete | 96 | 3 / 3 |
| 15 | sprint-15-react-query-telemetry | complete | complete | 98 | 3 / 3 |

## Per-sprint notes

### sprint-12-telemetry-tier-split

Split `fetchWorkspaceTelemetry` into explicit **summary** and **analytics** tiers per `DASHBOARD_LOAD_AUDIT.md` §4.

### Code changes

| Area | Change |
|------|--------|
| `apps/dashboard/src/lib/workspaceTelemetry.ts` | Added `TELEMETRY_TIER_BOUNDARIES`, `fetchTelemetrySummaryBundle`, `fetchTelemetryAnalyticsBundle`, `fetchTelemetrySummary`, `fetchTelemetryAnalytics`, `buildWorkspaceTelemetryFromBundle`. `fetchWorkspaceTelemetry` is now an alias for full (summary + analytics). |
| `apps/dashboard/src/components/homepage/useOperationalHomeData.ts` | Home mount loads summary only (4 requests). Poll stays at 15s; polls summary until analytics expanded, then full bundle. |

---

### sprint-13-dashboard-bootstrap-endpoint

Shipped `GET /workspaces/:workspaceId/dashboard-bootstrap` as a summary-tier batched endpoint that replaces the four parallel home telemetry calls (memory, retrieval, ingestion, health).

### Changes

| Area | File | What |
|------|------|------|
| Contract | `packages/shared-types/src/dashboard-bootstrap-contracts.ts` | Typed `DashboardBootstrapResponse` with slim memory/trace summaries and embedded health |
| API loader | `apps/api/src/lib/dashboard-bootstrap.ts` | `loadDashboardBootstrapSummary` — `Promise.all` over memory, retrieval, ingestion, and DB health probe |
| API route | `apps/api/src/routes/workspaces.ts` | Route with `enforceWorkspaceScope`, workspace existence check, trace-correlated event emit |

---

### sprint-14-workspace-telemetry-provider

Introduced a layout-level `WorkspaceTelemetryProvider` so home, metrics sidebar, and observability share one telemetry fetch and one poll loop.

### Files changed

| File | Change |
|------|--------|
| `apps/dashboard/src/context/WorkspaceTelemetryContext.tsx` | **New** — provider, 15s poll manager, slice hooks, analytics on-demand |
| `apps/dashboard/src/components/Layout.tsx` | Wraps `AppShell` with `WorkspaceTelemetryProvider` |
| `apps/dashboard/src/components/homepage/useOperationalHomeData.ts` | Thin composer over `useTelemetryIndicators`, `useTelemetryPanelData`, `useTelemetryEvents`, `useTelemetryAnalyticsState` |
| `apps/dashboard/src/components/layout/MetricsSidebar.tsx` | Reads `useTelemetryMetrics`; removed local fetch/poll |

---

### sprint-15-react-query-telemetry

Migrated `WorkspaceTelemetryProvider` from manual `useState` + `setInterval` polling to TanStack React Query (`@tanstack/react-query` v5).

### Changes shipped

| Area | File | What changed |
|------|------|--------------|
| Dependency | `apps/dashboard/package.json` | Added `@tanstack/react-query` |
| Query client | `apps/dashboard/src/lib/queryClient.ts` | Shared `QueryClient` with `structuralSharing: true`, `refetchOnWindowFocus: false` |
| Query keys | `apps/dashboard/src/lib/telemetryQueryKeys.ts` | Documented `telemetry.summary` / `telemetry.analytics` keys; `TELEMETRY_STALE_TIME_MS = TELEMETRY_POLL_INTERVAL_MS` (15s) |
| App shell | `apps/dashboard/src/main.tsx` | `QueryClientProvider` wraps router/auth (telemetry-only scope) |

---
