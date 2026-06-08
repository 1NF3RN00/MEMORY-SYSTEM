# Wave 1 outcomes — Quick wins
- **Focus:** Request dedupe, workspace ID, diagnostics N+1, health poll, ranking removal, React.memo.
- **Generated:** 2026-06-08T17:08:54.698Z
- **Sprints:** 6/6 verified complete
- **Average score:** 97/100
| Sprint | Folder | Impl | Verify | Score | Objectives |
|--------|--------|------|--------|-------|------------|
| 01 | sprint-01-api-request-dedupe | complete | complete | 94 | 3 / 3 |
| 02 | sprint-02-workspace-id-auth-context | complete | complete | 97 | 3 / 3 |
| 03 | sprint-03-operational-diagnostics-n-plus-one | complete | complete | 98 | 3 / 3 |
| 28 | sprint-28-consolidated-health-polling | complete | complete | 97 | 3 / 3 |
| 06 | sprint-06-remove-home-ranking-followup | complete | complete | 96 | 3 / 3 |
| 10 | sprint-10-react-memo-home-panels | complete | complete | 97 | 3 / 3 |

## Per-sprint notes

### sprint-01-api-request-dedupe

Added in-flight GET deduplication to `apps/dashboard/src/lib/api.ts`.

### Changes

1. **`inFlightGets` map** — `Map<string, Promise<unknown>>` keyed by resolved URL (`apiUrl(path)`).
2. **`apiGet` wrapper** — On call, checks the map for an existing promise for the same URL. If present, returns that promise (all concurrent callers await the same in-flight request). If absent, starts `apiRequest` + `parseApiResponse`, stores the promise, and returns it.
3. **Settle cleanup** — `.finally(() => inFlightGets.delete(url))` removes the entry on both success and failure so subsequent calls issue a fresh request.
4. **Error propagation** — Shared promise semantics: a rejection from `parseApiResponse` or `apiRequest` propagates to every waiter; no swallowing or per-caller isolation.

---

### sprint-02-workspace-id-auth-context

Exposed `workspaceId` from `AuthContext` as a derived field (`workspace?.workspaceId ?? null`) alongside the existing `workspace` object. Workspace resolution remains centralized in `AuthProvider` via `/auth/me` (authenticated) or a single dev-mode `/workspaces/default` fallback when Supabase is not configured.

Removed redundant `GET /workspaces/default` calls from home-load consumers:

| File | Change |
|------|--------|
| `apps/dashboard/src/context/AuthContext.tsx` | Added `workspaceId: string \| null` to `AuthState` |
| `apps/dashboard/src/lib/workspaceTelemetry.ts` | `fetchWorkspaceTelemetry(workspaceId)` — no longer fetches workspace |
| `apps/dashboard/src/components/homepage/ContextualIntelligenceMap.tsx` | Uses `useAuth().workspaceId`; fetches graph only after auth resolves |

---

### sprint-03-operational-diagnostics-n-plus-one

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

---

### sprint-28-consolidated-health-polling

Removed the independent `/health` fetch from `OperationalSystemBar`. The system bar now reads `indicators.systemHealth` from the shared telemetry pipeline (`fetchWorkspaceTelemetry` → `useOperationalHomeData` → `HomePage` → `OperationalSystemBar`).

**Changes:**
- `apps/dashboard/src/components/homepage/OperationalSystemBar.tsx` — removed `useEffect`/`useState` and `apiGet("/health")`; display uses `indicators.systemHealth` directly.
- `apps/dashboard/src/components/homepage/sprint-28-consolidated-health-polling.test.ts` — added 9 automated checks for objectives and anti-objectives.

**Evidence:**
- Before: home load issued 2× `GET /health` (telemetry `Promise.all` + SystemBar mount effect).
- After: 1× `GET /health` per telemetry cycle (only inside `fetchWorkspaceTelemetry`).
- Polling in

---

### sprint-06-remove-home-ranking-followup

Removed the follow-up `GET /retrieval/:id/ranking` call from `fetchWorkspaceTelemetry`, which powers home load, the metrics sidebar, and the shared telemetry bundle. Home and sidebar no longer pay the ranking payload cost on every 15–20s poll.

**Code changes**

| File | Change |
|------|--------|
| `apps/dashboard/src/lib/workspaceTelemetry.ts` | Dropped ranking fetch from `fetchWorkspaceTelemetry`; added `fetchRankingBreakdown(retrievalTraceId)` for on-demand use; `contextualConfidence` and `tokenEfficiency` now `null` when ranking is not loaded |
| `apps/dashboard/src/pages/ObservabilityPage.tsx` | After base telemetry loads, fetches ranking for the latest completed retrieval via `fetchRankingBreakdown` |

---

### sprint-10-react-memo-home-panels

Wrapped the three home telemetry panels with `React.memo` and stabilized props from `useOperationalHomeData` so unchanged 15s polls do not trigger panel re-renders.

### Changes

| File | Change |
|------|--------|
| `OperationalIntelligencePanels.tsx` | Wrapped with `memo()` |
| `LiveOperationalStream.tsx` | Wrapped with `memo()` |
| `OperationalSystemBar.tsx` | Wrapped with `memo()`; `useCallback` for command-palette click handler |
| `useOperationalHomeData.ts` | Functional `setTelemetry` with shallow slice compare; `useMemo` on hook return |
| `telemetryShallowEqual.ts` | **New** — shallow equality for `indicators`, `panelData`, `events` |
| `sprint-10-react-memo-home-panels.test.ts` | **New** — source + unit + profiler-model tests for sprint objectives |

### Mechanism

1.

---
