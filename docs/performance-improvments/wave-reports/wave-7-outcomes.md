# Wave 7 outcomes — Long-term
- **Focus:** WebSocket stream, EXPLAIN automation, unified observability UI, metrics store, BM25 V2 spike.
- **Generated:** 2026-06-08T22:05:29.866Z
- **Sprints:** 5/5 verified complete
- **Average score:** 96/100
| Sprint | Folder | Impl | Verify | Score | Objectives |
|--------|--------|------|--------|-------|------------|
| 25 | sprint-25-websocket-operational-stream | complete | complete | 97 | 3 / 3 |
| 26 | sprint-26-explain-analyze-automation | complete | complete | 94 | 3 / 3 |
| 33 | sprint-33-unified-observability-dashboard | complete | complete | 95 | 3 / 3 |
| 34 | sprint-34-metrics-aggregation-store | complete | complete | 97 | 3 / 3 |
| 37 | sprint-37-parallel-bm25-channel-v2 | complete | complete | 95 | 3 / 3 |

## Per-sprint notes

### sprint-25-websocket-operational-stream

Delivered an **SSE operational stream** (sprint allows WS or SSE; SSE chosen to avoid new WebSocket infra on Fastify/Vercel).

### Task 1 — Event envelope
- Added `OperationalStreamEnvelope` / `OperationalStreamEventPayload` in `packages/shared-types/src/operational-stream-contracts.ts`.
- Envelope kinds: `connected`, `event`, `heartbeat`, `error`; includes `workspaceId`, `traceId`, monotonic `sequence`, ISO `timestamp`.

### Task 2 — SSE endpoint
- `GET /workspaces/:workspaceId/operational-stream` in `apps/api/src/routes/operational-stream.ts`.
- `OperationalStreamHub` (`apps/api/src/lib/operational-stream-hub.ts`) subscribes to in-process pipeline events via `createSubscribableEventEmitter`.
- `operational-stream-mapper.ts

---

### sprint-26-explain-analyze-automation

Shipped opt-in automated EXPLAIN capture for slow Prisma read queries.

### 1. Slow query hook (`packages/observability/src/database/explain-on-slow.ts`)
- Registers a Prisma `$on('query')` handler when `explainOnSlow` is enabled on the instrumented client.
- Triggers only when `event.duration >= DB_SLOW_QUERY_MS` and SQL is a read (`SELECT` / `WITH`).
- Skips writes (`INSERT`/`UPDATE`/`DELETE`) and nested `EXPLAIN` statements.
- Caps at **3 EXPLAIN captures per scope** to limit overhead.
- Emits `database.query.explain` structured logs with sanitized plan nodes, index names, and `sql_fingerprint` correlated to `scope_id` / `scope_type`.

### 2. EXPLAIN script (`scripts/explain-slow-query.ts`)
- Offline harness: `npm run perf:explain-slow-query -- --sql "SELECT …"` or `--file query.sql`.
-

---

### sprint-33-unified-observability-dashboard

Unified timing, LLM, and database observability into a single read-only pane on retrieval trace detail.

### API (`retrieval-store.ts`, `retrieval.ts`, `retrieval-contracts.ts`)
- Added `llmCallAudit?: LlmCallAudit` to `StoredRetrievalResult` and `RetrievalTraceView`.
- Added `dbObservability?: RetrievalDbObservability` to `RetrievalTraceView` (already persisted; now returned on `GET /retrieval/:traceId`).
- `POST /retrieve` success and failure paths now persist `llmCallAudit` alongside existing `timingAudit` and `dbObservability`.

### Dashboard
- Added `apps/dashboard/src/lib/traceObservability.ts` — summary builders, availability checks, deep-link helpers.
- Added `apps/dashboard/src/components/observability/TraceObservabilityPanel.tsx` — one pane with:
  - Summary metric strip (executi

---

### sprint-34-metrics-aggregation-store

Shipped pre-aggregated workspace metrics store for O(1) dashboard count reads.

### 1. Schema design
- Added `WorkspaceMetricsSummary` Prisma model (`workspace_metrics_summaries`) — one row per workspace with scalar counters for retrieval, ingestion, compression, context render, and active memories.
- Migration: `apps/api/prisma/migrations/20250608120000_sprint34_metrics_aggregation/migration.sql`
- Shared contract: `packages/shared-types/src/workspace-metrics-contracts.ts` (`WorkspaceMetricsSummaryResponse`)

### 2. Increment on complete
Dual-write hooks on terminal operation completion:

| Operation | Location | Trigger |
|-----------|----------|---------|
| Retrieval | `completeRetrievalOperation` | `completed` / `failed` + latency |

---

### sprint-37-parallel-bm25-channel-v2

Delivered a **flag-gated V2 parallel lexical channel spike** that evaluates BM25/full-text retrieval alongside vector search without altering V1 ranking or context package output.

### Index design (Task 1)
- Documented in [`INDEX_DESIGN.md`](./INDEX_DESIGN.md)
- Prototype uses on-the-fly PostgreSQL `to_tsvector` + `ts_rank_cd` (`lexical-search-sql.ts`)
- Production recommendation: persisted `search_vector tsvector` + GIN index (not migrated in this spike)

### Flagged prototype (Task 2)
- Env flag: `RETRIEVAL_PARALLEL_BM25_V2_ENABLED` — **default off** (`retrieval-bm25-env.ts`)
- Pipeline input: `parallelBm25V2: { enabled, lexicalStore }` on `runRetrievalPipeline`
- When enabled: lexical search starts after preprocessing **in parallel** with query embed + pgvector
- Shadow output:

---
