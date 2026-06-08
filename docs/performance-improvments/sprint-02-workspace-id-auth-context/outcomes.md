# Sprint-02 Outcomes — Workspace ID in AuthContext

## Status
- **Implementation:** complete
- **Verification:** complete

## Audit mapping
- **IDs:** OP-2, BUG-003
- **Priority:** P0
- **Effort:** <1 day

## Implementation summary

Exposed `workspaceId` from `AuthContext` as a derived field (`workspace?.workspaceId ?? null`) alongside the existing `workspace` object. Workspace resolution remains centralized in `AuthProvider` via `/auth/me` (authenticated) or a single dev-mode `/workspaces/default` fallback when Supabase is not configured.

Removed redundant `GET /workspaces/default` calls from home-load consumers:

| File | Change |
|------|--------|
| `apps/dashboard/src/context/AuthContext.tsx` | Added `workspaceId: string \| null` to `AuthState` |
| `apps/dashboard/src/lib/workspaceTelemetry.ts` | `fetchWorkspaceTelemetry(workspaceId)` — no longer fetches workspace |
| `apps/dashboard/src/components/homepage/ContextualIntelligenceMap.tsx` | Uses `useAuth().workspaceId`; fetches graph only after auth resolves |
| `apps/dashboard/src/components/homepage/useOperationalHomeData.ts` | Passes `workspaceId` to telemetry; gates on `authLoading` |
| `apps/dashboard/src/components/layout/MetricsSidebar.tsx` | Same pattern (non-home layout, same telemetry API) |
| `apps/dashboard/src/pages/ObservabilityPage.tsx` | Same pattern |

**Loading behavior:** All consumers wait for `authLoading === false` and a non-null `workspaceId` before issuing workspace-scoped API calls. UI loading states combine auth loading with local fetch loading (`authLoading || loading`).

**Request reduction on home load:** Before, `ContextualIntelligenceMap` and `useOperationalHomeData` each called `GET /workspaces/default` independently (2 extra requests). After, both read `workspaceId` from auth context (0 duplicate workspace fetches). Target: **−2 requests** on authenticated home load.

**Evidence:**
- `grep "/workspaces/default"` in `apps/dashboard/src/components/homepage/` → no matches
- `grep "/workspaces/default"` in `apps/dashboard/src/lib/workspaceTelemetry.ts` → no matches
- `npm run typecheck` (dashboard) → pass
- `npm test` (dashboard vitest) → 6/6 pass

## Anti-objectives avoided

| Anti-objective | How avoided |
|----------------|-------------|
| Do not break unauthenticated flows | `workspaceId` is `null` when unauthenticated; consumers early-return without fetching. `ProtectedRoute` still gates authenticated pages on `workspace`. Dev-mode fallback in `refreshProfile` unchanged. |
| Do not fetch workspace before session valid | All telemetry/graph effects guard on `authLoading \|\| !workspaceId`. No workspace-scoped API calls until auth profile resolves. |
| Do not duplicate workspace state in many contexts | Single source of truth: `AuthContext.workspace` / `workspaceId`. No new React contexts added. |
| GA-1 (retrieval ranking changes) | No retrieval/compression pipeline code touched. |
| GA-2 (non-deterministic tuning) | No algorithm or heuristic changes. |
| GA-3 (trace payload breakage) | No trace/API response shape changes. |
| GA-4 (fabricated metrics) | Request-count reduction is structural (removed duplicate fetches); no latency numbers claimed without measurement. |
| GA-5 (scope creep) | Limited to AuthContext + telemetry + home-load consumers listed in sprint scope. Other pages still using `/workspaces/default` left for future sprints. |
| GA-6 (trace field removal) | No `stages[]` or trace field changes. |
| GA-7 (new DB tables) | No database changes. |

## Verification summary

Verification agent added `apps/dashboard/src/context/sprint-02-workspace-auth.test.ts` — 21 automated tests covering all three objectives, sprint anti-objectives, and home-load request budget. Re-ran full dashboard suite.

**Commands run:**
```text
npm run typecheck  → pass
npm test           → 27/27 pass (6 api.test + 21 sprint-02)
```

**Code audit (grep):**
- `apps/dashboard/src/components/homepage/` — 0 `/workspaces/default` references
- `apps/dashboard/src/lib/workspaceTelemetry.ts` — 0 `/workspaces/default` references
- Sprint-scoped files — exactly 1 `/workspaces/default` caller (`AuthContext.tsx` dev fallback only)

**Workspace switch:** N/A — no multi-workspace switch UI exists; `workspaceId` updates when `refreshProfile` re-runs on session change (covered by AuthContext derivation test).

**Runtime HAR (browser network tab):** Not captured in this verification run (no live dev server + browser session). Structural evidence and mocked-network tests confirm the −2 duplicate fetches are eliminated; authenticated production path uses `/auth/me` (workspace embedded) with zero `/workspaces/default` on home load.

**Regression:** No retrieval/compression pipeline or API route changes in sprint scope. Dashboard-only auth/telemetry wiring.

### Objective results
| # | Objective | Result | Evidence |
|---|-----------|--------|----------|
| 1 | AuthContext exposes workspaceId after auth resolves | **met** | `AuthState.workspaceId: string \| null`; derived `workspace?.workspaceId ?? null`; exposed in context value; tests pass |
| 2 | ContextualIntelligenceMap and telemetry stop fetching /workspaces/default independently | **met** | Grep: 0 matches in homepage + workspaceTelemetry; static tests on 4 consumer files; mock test confirms telemetry uses `workspaceId` param only |
| 3 | Loading states remain correct | **met** | All consumers guard `authLoading \|\| !workspaceId`; combined loading (`authLoading \|\| loading` / `showLoading`); graph shows "Loading relationship graph…" |

### Anti-objective results
| Anti-objective | Violated? | Evidence |
|----------------|-----------|----------|
| Do not break unauthenticated flows | **no** | `ProtectedRoute` still requires `workspace`; consumers return early when `workspaceId` null; test asserts Navigate to `/access` |
| Do not fetch workspace before session valid | **no** | `AUTH_LOADING_GUARD` present in all 4 consumer components; empty `workspaceId` → telemetry returns null without fetch |
| Do not duplicate workspace state in many contexts | **no** | Single `AuthContext`; no `WorkspaceContext`; test asserts |
| GA-1 through GA-7 | **no** | No pipeline/algorithm/trace/DB changes; scope limited to dashboard auth wiring |

## Verification Score
- **Score:** 97 / 100
- **Objectives met:** 3 / 3
- **Anti-objectives violated:** none

**Rubric breakdown:**
| Dimension | Weight | Score | Notes |
|-----------|--------|-------|-------|
| Objectives met | 40% | 100 | All three met with code + automated test evidence |
| Anti-objectives clean | 25% | 100 | Sprint + global anti-objectives verified |
| Test coverage | 20% | 85 | 21 sprint tests + structural audit; runtime HAR not captured |
| Regression safety | 15% | 100 | No retrieval/compression output changes |

## Measurements
| Metric | Before | After | Target | Evidence |
|--------|--------|-------|--------|----------|
| `GET /workspaces/default` on home load (authenticated) | 2 (map + telemetry) | 0 (workspace from `/auth/me` via AuthContext) | −1 to −2 | Grep audit; request-budget test (1 caller in scoped files, dev-only) |
| `GET /workspaces/default` on home load (dev/no Supabase) | 3 (auth fallback + map + telemetry) | 1 (AuthContext dev fallback only) | −1 to −2 | Static analysis of `refreshProfile` + removed consumer fetches |
| Dashboard tests | 6 pass | 27 pass (+21 sprint-02) | Objectives covered by tests | `npm test` output 2026-06-08 |
| Typecheck | pass | pass | no regressions | `npm run typecheck` |

## Places for improvement
1. **Runtime HAR capture** — Run dashboard against live API and confirm ≤1 `/workspaces/default` on home load in browser DevTools (dev mode) or 0 (authenticated Supabase).
2. **React integration tests** — `@testing-library/react` hook tests for `useOperationalHomeData` / `ContextualIntelligenceMap` would assert fetch timing relative to `authLoading` transitions (currently covered by static guard regex + module mocks).
3. **Follow-on sprint** — 9 other dashboard pages still call `/workspaces/default` independently (`IngestPage`, `CommandPalette`, trace pages, etc.); out of scope for sprint-02 but same pattern applies.
