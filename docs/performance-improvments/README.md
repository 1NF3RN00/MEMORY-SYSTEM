# Performance Improvements — Sprint Index

Derived from **System Performance Audit V1** (`docs/PERFORMANCE-AUDITS/`).

## Waves (start here)

**Human guide:** [`WAVES.md`](./WAVES.md) — goals, success criteria, email/log behavior.  
**Machine list:** [`waves.json`](./waves.json) — sprint IDs per wave (mirrored in `scripts/performance-sprints/waves.json`).

```bash
npm run perf:wave -- --wave 2
npm run perf:outcomes -- --wave 2   # progress without waiting for completion
```

## How to run a sprint

1. Read [`GLOBAL_PROMPT.md`](./GLOBAL_PROMPT.md).
2. Open the sprint folder `sprint-XX-<slug>/`.
3. Run **implementation** using `implement.md`.
4. Run **verification** using `verify.md`.
5. Both agents edit `outcomes.md`.

## Sprint pair format

| File | Purpose |
|------|---------|
| `implement.md` | Build the fix; meet objectives; document anti-objective avoidance |
| `verify.md` | Test framework; score work; flag violations |
| `outcomes.md` | Shared ledger (both agents write here) |

## Recommended execution order

### Wave 1 — Quick wins (parallel)
- sprint-01-api-request-dedupe
- sprint-02-workspace-id-auth-context
- sprint-03-operational-diagnostics-n-plus-one
- sprint-28-consolidated-health-polling
- sprint-06-remove-home-ranking-followup
- sprint-10-react-memo-home-panels

### Wave 2 — Payload slimming
- sprint-04-lite-relationship-graph
- sprint-05-compression-metadata-endpoint
- sprint-27-slim-operational-diagnostics-api
- sprint-16-lazy-load-graph

### Wave 3 — Observability & baselines
- sprint-31-production-retrieval-baseline
- sprint-32-dashboard-load-measurement-harness
- sprint-07-db-observability-core
- sprint-08-db-observability-phase-four
- sprint-09-llm-audit-route-coverage
- sprint-35-worker-observability-scopes
- sprint-38-eventlog-db-leaderboard-persistence

### Wave 4 — Dashboard data layer
- sprint-12-telemetry-tier-split
- sprint-13-dashboard-bootstrap-endpoint
- sprint-14-workspace-telemetry-provider
- sprint-15-react-query-telemetry

### Wave 5 — Render & UX polish
- sprint-11-remove-framer-layout-events
- sprint-19-ref-based-canvas-clock
- sprint-20-single-mobile-desktop-panel
- sprint-21-api-compression-verify
- sprint-30-compression-trace-id-ux

### Wave 6 — Retrieval depth
- sprint-17-pgvector-index-review
- sprint-18-embedding-query-cache
- sprint-29-context-package-race-fix
- sprint-36-execution-timing-completion
- sprint-39-context-delivery-timing-wrappers
- sprint-23-ingestion-timing-wrappers
- sprint-24-dashboard-timing-audit-display

### Wave 7 — Long-term
- sprint-25-websocket-operational-stream
- sprint-26-explain-analyze-automation
- sprint-33-unified-observability-dashboard
- sprint-34-metrics-aggregation-store
- sprint-37-parallel-bm25-channel-v2

## Full sprint catalog

| Sprint | Title | Audit IDs | Priority |
|--------|-------|-----------|----------|
| sprint-01-api-request-dedupe | API In-Flight Request Deduplication | OP-1, BUG-003, FE-001 | P0 |
| sprint-02-workspace-id-auth-context | Workspace ID in AuthContext | OP-2, BUG-003 | P0 |
| sprint-03-operational-diagnostics-n-plus-one | Fix Operational Diagnostics N+1 | BUG-001, DB-002, OP-3, RC-004 | P0 |
| sprint-04-lite-relationship-graph | Lite Relationship Graph Endpoint | BUG-002, OP-4 | P0 |
| sprint-05-compression-metadata-endpoint | Compression Metadata-Only Endpoint | OP-5 | P0 |
| sprint-06-remove-home-ranking-followup | Remove Home Ranking Follow-Up | OP-6, FE-006 | P1 |
| sprint-07-db-observability-core | Database Query Observability Phases 1-3 | MF-003, DB-001, OP-7, RC-003 | P0 |
| sprint-08-db-observability-phase-four | DB Observability Phase 4 — Leaderboard & Scopes | AR-005, DATABASE_QUERY_OBSERVABILITY | P1 |
| sprint-09-llm-audit-route-coverage | LLM Audit Full Route Coverage | PBUG-002, OP-15 | P1 |
| sprint-10-react-memo-home-panels | React.memo Home Panels | OP-9, FE-005 | P1 |
| sprint-11-remove-framer-layout-events | Remove Framer Layout on Event Cards | OP-10, FE-005 | P1 |
| sprint-12-telemetry-tier-split | Split Telemetry Summary vs Analytics | OP-8, FE-004, AR-001 | P1 |
| sprint-13-dashboard-bootstrap-endpoint | Dashboard Bootstrap Endpoint | OP-11 | P1 |
| sprint-14-workspace-telemetry-provider | Shared WorkspaceTelemetryProvider | OP-12, AR-001 | P1 |
| sprint-15-react-query-telemetry | React Query for Telemetry | OP-13, FE-003 | P1 |
| sprint-16-lazy-load-graph | Lazy-Load Relationship Graph | OP-14 | P2 |
| sprint-17-pgvector-index-review | pgvector Index EXPLAIN Review | OP-16, LAT-001, MF-001 | P2 |
| sprint-18-embedding-query-cache | Embedding Query Cache | OP-17, LAT-002 | P2 |
| sprint-19-ref-based-canvas-clock | Ref-Based Canvas Phase Label & Clock | OP-18, FE-005 | P2 |
| sprint-20-single-mobile-desktop-panel | Single Mobile/Desktop Panel Instance | OP-19, FE-005 | P2 |
| sprint-21-api-compression-verify | Verify API gzip/brotli Compression | OP-20 | P2 |
| sprint-22-list-field-projection | List Endpoint Field Projection | OP-21 | P2 |
| sprint-23-ingestion-timing-wrappers | Ingestion Pipeline Timing Wrappers | OP-22, MF-005 | P2 |
| sprint-24-dashboard-timing-audit-display | Dashboard timingAudit Display | OP-23 | P2 |
| sprint-25-websocket-operational-stream | WebSocket Operational Stream | OP-24, FE-003 | P3 |
| sprint-26-explain-analyze-automation | EXPLAIN ANALYZE Automation | OP-25 | P3 |
| sprint-27-slim-operational-diagnostics-api | Slim Operational Diagnostics API | RC-004 | P1 |
| sprint-28-consolidated-health-polling | Consolidated Health Polling | BUG-003, FE-001 | P1 |
| sprint-29-context-package-race-fix | Context Package Persistence Race Fix | PBUG-001 | P1 |
| sprint-30-compression-trace-id-ux | Compression Trace ID UX | PBUG-003 | P2 |
| sprint-31-production-retrieval-baseline | Production Retrieval Latency Baseline | MF-006, LAT-009 | P0 |
| sprint-32-dashboard-load-measurement-harness | Dashboard Load Measurement Harness | FE-002, DASHBOARD_LOAD_AUDIT | P0 |
| sprint-33-unified-observability-dashboard | Unified Observability Dashboard | long-term | P2 |
| sprint-34-metrics-aggregation-store | Metrics Aggregation Store | AR-002 | P3 |
| sprint-35-worker-observability-scopes | Worker Job Observability Scopes | AR-004 | P1 |
| sprint-36-execution-timing-completion | Execution Timing Completion | EXECUTION_TIMING | P2 |
| sprint-37-parallel-bm25-channel-v2 | Parallel BM25 Keyword Channel (V2) | AR-003 | P3 |
| sprint-38-eventlog-db-leaderboard-persistence | EventLog DB Leaderboard Persistence | AR-005 | P2 |
| sprint-39-context-delivery-timing-wrappers | Context Delivery Timing Wrappers | EXECUTION_TIMING | P2 |

## Audit coverage matrix

| Audit item | Sprint(s) |
|------------|-----------|
| OP-1 … OP-25 (top opportunities) | sprint-01 … sprint-26 (see catalog) |
| BUG-001 … BUG-003 | sprint-03, sprint-04, sprint-01+02+28 |
| PBUG-001 … PBUG-003 | sprint-29, sprint-09, sprint-30 |
| MF-001 … MF-006 | sprint-17/18, sprint-01–06, sprint-07, sprint-31/32 |
| AR-001 … AR-005 | sprint-12/14, sprint-34, sprint-37, sprint-35, sprint-08/38 |
| RC-001 … RC-004 | sprint-17/18, sprint-01–14, sprint-07, sprint-27 |
| Missing measurements | sprint-31, sprint-32 |
| Five founder fixes | sprint-01, sprint-03, sprint-04, sprint-07, sprint-05+27 |
