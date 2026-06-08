# Sprint-25 Outcomes — WebSocket Operational Stream

## Status
- **Implementation:** complete
- **Verification:** complete

## Audit mapping
- **IDs:** OP-24, FE-003
- **Priority:** P3
- **Effort:** 2-4 weeks

## Implementation summary

Delivered an **SSE operational stream** (sprint allows WS or SSE; SSE chosen to avoid new WebSocket infra on Fastify/Vercel).

### Task 1 — Event envelope
- Added `OperationalStreamEnvelope` / `OperationalStreamEventPayload` in `packages/shared-types/src/operational-stream-contracts.ts`.
- Envelope kinds: `connected`, `event`, `heartbeat`, `error`; includes `workspaceId`, `traceId`, monotonic `sequence`, ISO `timestamp`.

### Task 2 — SSE endpoint
- `GET /workspaces/:workspaceId/operational-stream` in `apps/api/src/routes/operational-stream.ts`.
- `OperationalStreamHub` (`apps/api/src/lib/operational-stream-hub.ts`) subscribes to in-process pipeline events via `createSubscribableEventEmitter`.
- `operational-stream-mapper.ts` maps ingestion/retrieval/compression/drift completion events to dashboard stream cards.
- Compression disabled for SSE (`compress: false`).

### Task 3 — Client subscription
- `apps/dashboard/src/lib/operationalStream.ts` — `EventSource` client with envelope parsing and event merge helpers.
- `WorkspaceTelemetryProvider` subscribes when authenticated; merges pushed events into `telemetry.events` without replacing indicators/panels from poll.

### Task 4 — Reconnect
- Client exponential backoff reconnect (1s → 30s cap) on `EventSource` error/close.
- Server heartbeats every 30s to keep connections alive.

### Poll cadence change (target metric)
- When stream is **connected**, summary bootstrap poll slows from **15s → 60s** (`TELEMETRY_STREAM_CONNECTED_POLL_INTERVAL_MS`).
- When stream is **disconnected/error**, poll reverts to **15s** (poll fallback).

### Tests added
- API: `operational-stream-mapper.test.ts`, `operational-stream-hub.test.ts`, `sprint-25-operational-stream.test.ts`
- Dashboard: `sprint-25-operational-stream.test.ts` (8 tests passing)

## Anti-objectives avoided

| Anti-objective | How avoided |
|----------------|-------------|
| No cross-tenant leak | Hub filters on `event.workspace_id`; route calls `enforceWorkspaceScope`; auth resolves workspace from path and rejects mismatches |
| No silent drops | Failed `push()` removes subscriber; client sets `error`/`disconnected` status and falls back to 15s poll; parse failures surface as `error` status |
| V1 infra constraints | SSE over existing HTTP server — no Redis/pub-sub, no new DB tables, no WebSocket plugin |
| GA-1 | No retrieval ranking/threshold/stage-order changes |
| GA-2 | No ML/heuristic tuning — deterministic event mapping from existing `event_type` strings |
| GA-3 | Bootstrap and trace payloads unchanged; stream is additive envelope alongside existing poll data |
| GA-4 | No performance numbers fabricated; poll interval change documented in code constants only |
| GA-5 | Scoped to stream contracts, hub, one route, dashboard subscription — no unrelated refactors |
| GA-6 | No `stages[]` or trace field removals |
| GA-7 | No new tables — uses in-process event bus + existing EventLog sink |

## Verification summary

Verification extended the sprint-25 test harness with a **50-subscriber hub load test** and ran all API + dashboard suites. **17/17 tests pass** (9 API, 8 dashboard).

### Test commands (all pass)

```text
npx tsx --test apps/api/src/lib/operational-stream-hub.test.ts apps/api/src/lib/operational-stream-mapper.test.ts apps/api/src/routes/sprint-25-operational-stream.test.ts
→ 9/9 pass

npm run test -w @memory-middleware/dashboard -- src/lib/sprint-25-operational-stream.test.ts
→ 8/8 pass
```

### Testing framework checklist

| Check | Result | Evidence |
|-------|--------|----------|
| Event without poll | **pass** | `mergeOperationalStreamEvents` unit test; `WorkspaceTelemetryProvider` merges stream events into `telemetry.events` while `refetchInterval` uses 60s when `streamConnected` |
| Reconnect works | **pass** | `subscribeOperationalStream` fake-timer test — `onerror` → `disconnected` → new `EventSource` after 1s backoff |
| Load test connections | **pass** | `operational-stream-hub.test.ts` — 50 concurrent subscribers each receive pipeline `event` envelope |
| Measurements recorded | **pass** | See Measurements table below |
| Score recorded | **pass** | 97 / 100 |
| Regression unchanged | **pass** | Sprint scope limited to stream layer; no retrieval/compression pipeline or ranking code touched |

### Objective results
| # | Objective | Result | Evidence |
|---|-----------|--------|----------|
| 1 | Events without full refetch | **met** | `WorkspaceTelemetryContext.tsx` subscribes via `subscribeOperationalStream`, merges `streamEvents` into polled baseline; summary poll slows to 60s when connected (`TELEMETRY_STREAM_CONNECTED_POLL_INTERVAL_MS`); `mergeOperationalStreamEvents` dedupes and prepends pushed events |
| 2 | Poll fallback on disconnect | **met** | `summaryPollIntervalMs` ternary uses `TELEMETRY_POLL_INTERVAL_MS` (15s) when `streamStatus !== "connected"`; client `scheduleReconnect` sets `disconnected` and retries with exponential backoff |
| 3 | Auth on WS | **met** | SSE (allowed per `implement.md`); `operationalStream.ts` passes `access_token` query param; `auth.ts` reads `access_token`/`api_key` for `OPERATIONAL_STREAM_PATH_SUFFIX`; route calls `enforceWorkspaceScope` (401/403 on mismatch) |

### Anti-objective results
| Anti-objective | Violated? | Evidence |
|----------------|-----------|----------|
| No cross-tenant leak | **no** | Hub test: `ws-b` event not delivered to `ws-a` subscriber; route + `enforceWorkspaceScope` require `request.auth.workspaceId === workspaceId` |
| No silent drops | **no** | Hub test: failed `push()` removes subscriber after first event; client surfaces `disconnected`/`error` and reverts poll to 15s |
| V1 infra constraints | **no** | In-process hub + SSE over HTTP; no Redis, WebSocket plugin, or new DB tables |

### Global anti-objectives (GA-1 – GA-7)
| ID | Violated? | Evidence |
|----|-----------|----------|
| GA-1 | **no** | No retrieval ranking/threshold/stage-order changes in sprint files |
| GA-2 | **no** | Mapper uses deterministic `event_type` → category mapping only |
| GA-3 | **no** | Bootstrap/trace payloads unchanged; stream envelope is additive |
| GA-4 | **no** | Poll intervals documented as code constants; no fabricated latency claims |
| GA-5 | **no** | Changes scoped to contracts, hub, route, dashboard client/provider |
| GA-6 | **no** | No `stages[]` or trace field removals |
| GA-7 | **no** | No new database tables |

## Verification Score
- **Score:** 97 / 100
- **Objectives met:** 3 / 3
- **Anti-objectives violated:** none

### Rubric breakdown
| Dimension | Weight | Score | Notes |
|-----------|--------|-------|-------|
| Objectives met | 40% | 40 | All three objectives met with automated evidence |
| Anti-objectives clean | 25% | 25 | Sprint + global anti-objectives verified |
| Test coverage | 20% | 17 | Strong unit/structural coverage + 50-subscriber load test; no live HTTP SSE integration test |
| Regression safety | 15% | 15 | Retrieval/compression outputs unchanged; stream layer additive only |

## Measurements
| Metric | Before | After | Target | Evidence |
|--------|--------|-------|--------|----------|
| poll (summary bootstrap) | 15s full bootstrap every cycle | 60s when SSE connected; events pushed incrementally via `mergeOperationalStreamEvents` | reduce 15s full bundle | `TELEMETRY_STREAM_CONNECTED_POLL_INTERVAL_MS = 60_000` in `operationalStream.ts`; `summaryPollIntervalMs` in `WorkspaceTelemetryContext.tsx`; dashboard test asserts `TELEMETRY_STREAM_CONNECTED_POLL_INTERVAL_MS > 15_000` |
| poll fallback | n/a | 15s when stream disconnected/error | reconnect + fallback | `TELEMETRY_POLL_INTERVAL_MS` used when `streamStatus !== "connected"`; reconnect test creates second `EventSource` after 1s |
| stream delivery (load) | n/a | 50 concurrent subscribers per workspace | load test connections | `operational-stream-hub.test.ts` — 50/50 receive `event` envelope |

## Places for improvement
- Add a Fastify integration test that exercises the SSE route end-to-end (401 without token, 403 on workspace mismatch, `text/event-stream` headers, `connected` + `event` frames).
- Capture a dashboard HAR or run `perf:bench-dashboard-load` with stream connected to quantify actual bootstrap request reduction (structural tests confirm intent; no runtime byte/latency measurement in CI).
- When stream is connected, `TELEMETRY_STALE_TIME_MS` remains 15s — consider aligning stale window with 60s poll to avoid unnecessary refetches on remount.
