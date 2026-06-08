# Execution Timing Audit System

## Objective

Add **high-resolution, request-scoped timing instrumentation** across all major pipeline stages. Produce a unified audit payload per request, emit it to observability logs, and **change no business logic**.

**Status: Implemented** (2026-06-08). All 12 canonical query-pipeline stages are instrumented. `POST /retrieve` and `POST /retrieval/plan` return `timingAudit` in the response body.

---

## Query Pipeline Stage Map

User-facing pipeline → instrumentation stage → code location:

| # | Pipeline stage | Timing stage name | Instrumented in | Notes |
|---|----------------|-------------------|-----------------|-------|
| 1 | Query Received | `query_received` | `request-timing.ts` `onRequest` | Umbrella from HTTP entry to response |
| 2 | Intent Extraction | `intent_extraction` | `retrieval/pipeline.ts` preprocessing; `planning/pipeline.ts` decomposition | Deterministic keyword/concept extraction |
| 3 | Metadata Filtering | `metadata_filtering` | `retrieval/pipeline.ts` `resolveDomainRetrievalScope` | Domain filters + retrieval rules applied before search |
| 4 | Vector Search | `vector_search:embedding`, `vector_search:pgvector` | `retrieval/pipeline.ts` | Split: OpenAI embed call vs Postgres pgvector query |
| 5 | Keyword Search | `keyword_search` | `retrieval/pipeline.ts` `applyRetrievalExpansion` | Lexical/metadata keyword matching (no BM25 index in V1) |
| 6 | Relationship Expansion | `relationship_expansion` | `retrieval/pipeline.ts` `loadRelationshipsForMemories` + augmentation | **Split out of reranking** (was previously folded in) |
| 7 | Fact Resolution | `fact_resolution` | `retrieval.ts` route `prepareContextPackageForDelivery` | Domain fact overrides applied post-retrieval |
| 8 | Domain Resolution | `domain_resolution` | `domain-engine/execution-context.ts` | Loads facts, instructions, retrieval rules |
| 9 | Reranking | `reranking` | `retrieval/pipeline.ts` `rankChunks` | Hybrid score computation only |
| 10 | Compression | `compression` | `compression/pipeline.ts` | Full compression pipeline wrapper |
| 11 | Context Assembly | `context_assembly` | `retrieval/pipeline.ts` `assembleContextPackage` | Token budget + memory object assembly |
| 12 | Response | `response` | `request-timing.ts` `onResponse` | Serialization + HTTP send |

Additional sub-stages recorded: `retrieval` (umbrella), `graph_traversal` (adjacency load), `planning` (umbrella), `deduplication`, `token_budgeting`, `api_handler:<METHOD> <route>`.

---

## Baseline Latency Measurements (mock integration test)

Source: `packages/retrieval/src/pipeline-timing.test.ts` — mock vector store + mock embedding client, single candidate, no domain context.

| Stage | Duration (ms) | % of retrieval umbrella |
|-------|---------------|-------------------------|
| `metadata_filtering` | 0.11 | 0.4% |
| `intent_extraction` | 0.74 | 2.7% |
| `vector_search:embedding` | 7.29 | 26.5% |
| `vector_search:pgvector` | 15.03 | 54.6% |
| `reranking` | 0.25 | 0.9% |
| `context_assembly` | 0.29 | 1.1% |
| `graph_traversal` | 0.02 | 0.1% |
| `keyword_search` | 0.69 | 2.5% |
| **`retrieval` (total)** | **27.54** | **100%** |
| **Request total** | **29.35** | — |

### Findings

1. **Vector search dominates** — In the mock run, pgvector query (15 ms) + embedding (7 ms) account for ~81% of retrieval time. Real production latency will be higher with OpenAI API RTT and larger workspaces.
2. **Intent extraction is sub-millisecond** — Deterministic preprocessing is not a bottleneck.
3. **Reranking / keyword / metadata filtering are negligible** — All under 1 ms in mock; relationship expansion skipped (no `loadRelationshipsForMemories` mock).
4. **Relationship expansion was previously invisible** — Now timed separately; was folded into `reranking` latency before this audit.
5. **Keyword search is post-assembly** — Runs after context assembly as metadata expansion, not a parallel BM25 channel. V1 hybrid scoring uses vector similarity + ranking boosts, not inverted-index keyword retrieval.
6. **Fact resolution and domain resolution are route-level** — Only measured when `domainKey` is provided on `POST /retrieve`.
7. **Compression is a separate endpoint** — Not chained in `POST /retrieve`; measured when compression routes invoke `runCompressionPipeline`.
8. **hrtime precision** — New audits use `process.hrtime.bigint()` (microsecond precision). Legacy `RetrievalStageRecord.latencyMs` still uses `Date.now()` for dashboard backward compatibility.

### Output surfaces

- **API response**: `timingAudit` on `POST /retrieve`, `POST /retrieval/plan`
- **HTTP header**: `X-Timing-Total-Ms`
- **Structured log**: `timing.audit.completed` (Pino + events table)
- **Legacy stages**: `stages[]` on retrieval traces unchanged

### Example `timingAudit` payload

```json
{
  "requestId": "01RETRIEVAL",
  "totalLatency": 29.352,
  "stages": [
    { "stage": "metadata_filtering", "durationMs": 0.107 },
    { "stage": "intent_extraction", "durationMs": 0.744 },
    { "stage": "vector_search:embedding", "durationMs": 7.286 },
    { "stage": "vector_search:pgvector", "durationMs": 15.027 },
    { "stage": "reranking", "durationMs": 0.245 },
    { "stage": "context_assembly", "durationMs": 0.292 },
    { "stage": "keyword_search", "durationMs": 0.69 },
    { "stage": "retrieval", "durationMs": 27.537 }
  ]
}
```

---

## Pre-Implementation State Assessment (archived)

The codebase already has **partial, inconsistent** stage timing:

| Area | Location | What exists | Gaps |
|------|----------|-------------|------|
| HTTP layer | `packages/observability/src/middleware/request-logging.ts` | `response_time_ms` via Fastify `elapsedTime` | No per-handler stages; no unified audit |
| Ingestion | `packages/ingestion/src/pipeline.ts` | `IngestionStageRecord` with `latencyMs` | Uses `Date.now()`; no `ingestion` wrapper; crawl not timed separately |
| Retrieval | `packages/retrieval/src/pipeline.ts` | `RetrievalStageRecord` + event `latencyMs` | Relationship expansion folded into `reranking`; no `retrieval` umbrella stage |
| Compression | `packages/compression/src/pipeline.ts` | Sub-stage records | Not linked to parent request audit |
| Planning | `packages/planning/src/pipeline.ts` | Planning stages | Not propagated to retrieval request audit |
| Context delivery | `packages/context-delivery/src/pipeline.ts` | Render stages incl. `fact_precedence` | Not unified with retrieval trace |
| Domain engine | `packages/domain-engine/src/execution-context.ts` | Event on resolve | No duration measurement |
| Trace analysis | `packages/retrieval-diagnostics/src/trace-analysis.ts` | Post-hoc `latencyMs` from stored stages | Analysis only; not live instrumentation |

**Key architectural gap:** Each pipeline owns its own `pushStage` helper (duplicated 4×) with ISO `startedAt` + `Date.now()` deltas. There is no shared `ExecutionTimingAudit` contract or central log emission.

---

## Design Principles

1. **Instrumentation only** — wrap existing calls; no algorithm, threshold, or ordering changes.
2. **High resolution** — use `process.hrtime.bigint()` (nanosecond monotonic clock), convert to `durationMs` with microsecond precision.
3. **Request correlation** — `requestId` = existing `traceId` (ULID from `x-trace-id` or generated). Do not introduce a second ID scheme.
4. **Non-invasive propagation** — `AsyncLocalStorage` carries the active `ExecutionTimingCollector` across async boundaries within a request.
5. **Additive output** — append `timingAudit` to responses and logs; do not remove existing `*StageRecord` arrays (dashboard depends on them).
6. **Observability-first** — every completed request emits `timing.audit.completed` via the existing Pino logger + Prisma event sink.

---

## Phase 1 — Shared Contracts & Core Timing Library

### 1.1 Add types to `@memory-middleware/shared-types`

**New file:** `packages/shared-types/src/execution-timing-contracts.ts`

```typescript
export type ExecutionStageName =
  | "ingestion"
  | "normalization"
  | "chunking"
  | "embedding_generation"
  | "memory_storage"
  | "retrieval"
  | "reranking"
  | "compression"
  | "context_assembly"
  | "domain_resolution"
  | "fact_resolution"
  | "instruction_loading"
  | "graph_traversal"
  | "relationship_expansion"
  | "api_handler"
  // sub-stages preserved for drill-down
  | "preprocessing"
  | "vector_retrieval"
  | "deduplication"
  | "token_budgeting"
  | "planning"
  | "context_rendering";

export interface ExecutionStageTiming {
  stage: ExecutionStageName | string;
  startTime: string;   // ISO-8601
  endTime: string;     // ISO-8601
  durationMs: number;  // hrtime-derived, 3 decimal places
}

export interface ExecutionTimingAudit {
  requestId: string;
  totalLatency: number;
  stages: ExecutionStageTiming[];
}
```

Export from `packages/shared-types/src/index.ts`.

### 1.2 Add timing module to `@memory-middleware/observability`

**New files:**

| File | Responsibility |
|------|----------------|
| `src/timing/hrtime.ts` | `nowHr()`, `hrToMs(bigint)`, `isoNow()` |
| `src/timing/collector.ts` | `ExecutionTimingCollector` — `startStage()`, `endStage()`, `toAudit()` |
| `src/timing/context.ts` | `AsyncLocalStorage<ExecutionTimingCollector>` + `runWithTiming()`, `getTimingCollector()` |
| `src/timing/bridge.ts` | Convert legacy `*StageRecord` → `ExecutionStageTiming[]` |
| `src/timing/emit.ts` | `emitTimingAudit(logger, events, audit, metadata?)` |

**Collector API:**

```typescript
class ExecutionTimingCollector {
  constructor(requestId: string);
  startStage(stage: string): void;          // records hrtime + ISO start
  endStage(stage: string): void;          // pairs with start; computes durationMs
  measure<T>(stage: string, fn: () => T): T;
  measureAsync<T>(stage: string, fn: () => Promise<T>): Promise<T>;
  mergeStages(stages: ExecutionStageTiming[]): void;
  toAudit(): ExecutionTimingAudit;
}
```

**Log emission shape** (Pino `info`):

```json
{
  "event_type": "timing.audit.completed",
  "request_id": "<traceId>",
  "total_latency_ms": 142.387,
  "stage_count": 12,
  "stages": [ /* full array */ ],
  "route": "POST /retrieve",
  "workspace_id": "..."
}
```

Persist via existing `EventEmitter` with `event_type: "timing.audit.completed"`.

---

## Phase 2 — HTTP / API Handler Instrumentation

### 2.1 Fastify timing plugin

**New file:** `packages/observability/src/middleware/request-timing.ts`

Hook into existing `registerRequestLogging` flow in `apps/api/src/create-app.ts`:

| Hook | Action |
|------|--------|
| `onRequest` | Create `ExecutionTimingCollector(traceId)`; store on `request.timingCollector`; enter ALS |
| `preHandler` | `startStage("api_handler:<method> <route>")` using Fastify route template |
| `onResponse` | `endStage(...)`; `emitTimingAudit()`; attach `X-Timing-Total-Ms` header (optional, additive) |
| `onError` | Still emit partial audit with failed stage |

**Dashboard API routes to instrument** (all handlers in `apps/api/src/routes/`):

- `ingest.ts`, `ingestion.ts` — ingestion flows
- `retrieval.ts` — full retrieve orchestration
- `compression.ts`, `context.ts`, `planning.ts`
- `domains.ts`, `workflows.ts`, `objects.ts`
- `relationships.ts` — graph/neighborhood endpoints
- `diagnostics.ts`, `historian.ts`, `memory.ts`, `search.ts`
- `packages.ts`, `observations.ts`, `workspaces.ts`

Each handler gets `api_handler:<METHOD> <path>` as a top-level stage. Nested pipeline stages nest under the same collector via ALS.

### 2.2 Extend Fastify request type

```typescript
declare module "fastify" {
  interface FastifyRequest {
    traceId: string;
    timingCollector: ExecutionTimingCollector;
  }
}
```

---

## Phase 3 — Pipeline Stage Instrumentation

Instrument by wrapping **existing stage boundaries** with `collector.measureAsync()`. Keep all existing `pushStage` / `stage()` calls unchanged.

### 3.1 Ingestion pipeline (`packages/ingestion/src/pipeline.ts`)

| Required stage | Instrumentation point |
|----------------|----------------------|
| `ingestion` | Wrap entire `runIngestionPipeline` |
| `normalization` | Wrap `normalizeContent()` (+ website `crawlWebsite()` as sub-metadata) |
| `chunking` | Wrap chunking block (structural + fixed chunks) |
| `embedding_generation` | Wrap `embedChunks()` |
| `memory_storage` | Wrap `persistMemory()` + `updateChunkEmbeddings()` |

### 3.2 Retrieval pipeline (`packages/retrieval/src/pipeline.ts`)

| Required stage | Instrumentation point |
|----------------|----------------------|
| `retrieval` | Wrap full `runRetrievalPipeline` |
| `preprocessing` | Already staged — add hrtime wrapper |
| `vector_retrieval` | Wrap embed + `vectorStore.search()` |
| `reranking` | Wrap `rankChunks()` only |
| `relationship_expansion` | **New timing boundary** around `loadRelationshipsForMemories` + `applyRelationshipAugmentation` (lines 331–391) — no logic change, just timing split from reranking |
| `deduplication` | Existing stage |
| `context_assembly` | Wrap `assembleContextPackage()` |
| `graph_traversal` | Wrap `applyRetrievalExpansion()` + adjacency load (metadata neighbor hints) |

### 3.3 Compression pipeline (`packages/compression/src/pipeline.ts`)

| Required stage | Instrumentation point |
|----------------|----------------------|
| `compression` | Wrap full `runCompressionPipeline` |
| Sub-stages | Map existing `overlap_detection`, `semantic_merge`, etc. as child stages |

### 3.4 Context delivery (`packages/context-delivery/src/pipeline.ts`)

| Required stage | Instrumentation point |
|----------------|----------------------|
| `context_rendering` | Wrap full pipeline |
| `fact_resolution` | Wrap `prepareContextPackageForDelivery()` / `applyFactOverridesToMemories` |
| `instruction_loading` | Wrap `buildInstructionSections()` |

### 3.5 Domain engine (`packages/domain-engine/src/execution-context.ts`)

| Required stage | Instrumentation point |
|----------------|----------------------|
| `domain_resolution` | Wrap `resolveDomainExecutionContext()` — `loadExecutionContextData()` |
| `instruction_loading` | Time `loaded.instructions` resolution separately when domain+action specified |

Called from:

- `apps/api/src/routes/retrieval.ts`
- `apps/api/src/lib/workflow-retrieval.ts`

### 3.6 Planning pipeline (`packages/planning/src/pipeline.ts`)

| Required stage | Instrumentation point |
|----------------|----------------------|
| `planning` | Wrap `runPlanningPipeline` |

Merge planning stages into parent retrieval request audit when planning precedes retrieval in same HTTP request.

### 3.7 Relationship / graph routes (`apps/api/src/routes/relationships.ts`)

| Required stage | Instrumentation point |
|----------------|----------------------|
| `graph_traversal` | Wrap `getMemoryNeighborhood()`, `getWorkspaceRelationshipGraph()` |

---

## Phase 4 — Request Orchestration Wiring

### 4.1 Propagate collector into pipeline inputs

Add optional `timingCollector?: ExecutionTimingCollector` to:

- `RunRetrievalInput`
- `PipelineOptions` (ingestion)
- `RunCompressionInput`
- `RunContextRenderInput`
- `RunPlanningInput`
- `ResolveExecutionContextDeps`

**Fallback:** if not passed, use `getTimingCollector()` from ALS.

### 4.2 API route orchestration (`apps/api/src/routes/retrieval.ts` example)

```
POST /retrieve
├── api_handler:POST /retrieve
├── domain_resolution          (if domainKey)
├── planning                   (if inline planning added later)
├── retrieval
│   ├── preprocessing
│   ├── vector_retrieval
│   ├── reranking
│   ├── relationship_expansion
│   ├── deduplication
│   ├── token_budgeting
│   ├── graph_traversal
│   └── context_assembly
├── compression                  (if compression route chained)
└── context_rendering            (if delivery chained)
```

Pass `request.timingCollector` into each pipeline call.

### 4.3 Response augmentation (additive only)

Append to API responses where a trace/result object already exists:

```typescript
{
  ...existingResponse,
  timingAudit: collector.toAudit()
}
```

For endpoints that return minimal payloads (e.g. `204`), emit audit to logs only.

---

## Phase 5 — Bridge Legacy Stage Records

**File:** `packages/observability/src/timing/bridge.ts`

Convert existing persisted `*StageRecord` arrays to unified format for:

- `IngestionStageRecord` → map `normalized` → `normalization`, `embedded` → `embedding_generation`, etc.
- `RetrievalStageRecord` → direct mapping
- `CompressionStageRecord`, `PlanningStageRecord`, `ContextRenderStageRecord`

Used by:

1. Historian replay views (backward compatibility)
2. Diagnostics trace analysis enrichment

---

## Phase 6 — Observability Integration

### 6.1 Log events

| Event | When |
|-------|------|
| `timing.audit.completed` | Every request completion |
| `timing.stage.completed` | Optional per-stage debug (behind `LOG_LEVEL=debug`) |

### 6.2 Dashboard exposure (read-only, no new pages required for V1)

Existing pages already consume stage arrays:

- `RetrievalTracesPage.tsx` + `RetrievalTimeline.tsx`
- `IngestionTracesPage.tsx`
- `CompressionTracesPage.tsx`
- `ContextDeliveryPage.tsx`

**V1 additive change:** accept optional `timingAudit` on trace views; render in `RetrievalTimeline` if present. No behavior change to trace fetching.

### 6.3 No database migration required

Timing audits live in:

- Structured logs (Pino → log aggregator)
- Event sink (`events` table via existing `createPrismaEventSink`)

Optionally store `timingAudit` JSON in existing `result` columns on `retrievalOperation` / ingestion traces (already JSON blobs) — no schema change.

---

## File Change Summary

| Package / App | Files | Change type |
|---------------|-------|-------------|
| `packages/shared-types` | `execution-timing-contracts.ts`, `index.ts` | New types |
| `packages/observability` | `timing/*`, `middleware/request-timing.ts`, `index.ts` | New module |
| `packages/ingestion` | `pipeline.ts` | Wrap stages |
| `packages/retrieval` | `pipeline.ts` | Wrap stages + split relationship timing |
| `packages/compression` | `pipeline.ts` | Wrap stages |
| `packages/context-delivery` | `pipeline.ts` | Wrap stages |
| `packages/planning` | `pipeline.ts` | Wrap stages |
| `packages/domain-engine` | `execution-context.ts` | Wrap resolve |
| `apps/api` | `create-app.ts`, all `routes/*.ts` | Plugin + pass collector |

**Estimated touch count:** ~20 files, ~400–600 LOC (mostly thin wrappers).

---

## Implementation Order (completed)

| Phase | Status | Delivered |
|-------|--------|-----------|
| 1 — Types + Collector | Done | `execution-timing-contracts.ts`, `timing/collector.ts`, `hrtime.ts` |
| 2 — HTTP Plugin | Done | `request-timing.ts`, `X-Timing-Total-Ms` header |
| 3 — Pipeline Wrappers | Done | retrieval, planning, compression, domain-engine |
| 4 — Route Wiring | Done | `POST /retrieve`, `POST /retrieval/plan` |
| 5 — Legacy Bridge | Done | `timing/bridge.ts` |
| 6 — Log Emission | Done | `timing.audit.completed` event + Pino log |

**Remaining (optional):** ingestion pipeline wrappers, context-delivery wrappers, relationship graph routes, dashboard `RetrievalTimeline` `timingAudit` display.

---

## Testing Strategy

| Test | Location | Validates |
|------|----------|-----------|
| `collector.test.ts` | `packages/observability` | hrtime accuracy, nested stages, `toAudit()` shape |
| `bridge.test.ts` | `packages/observability` | Legacy record conversion |
| `pipeline-timing.test.ts` | per pipeline package | Stage count + ordering unchanged; durations > 0 |
| `request-timing.test.ts` | `apps/api` | Handler emits `timing.audit.completed` |
| Manual | `POST /retrieve` | Response includes `timingAudit`; logs contain full stages |

**Regression guard:** snapshot existing pipeline outputs (context packages, memory objects, rankings) before/after — must be identical.

---

## Canonical Output Example

```json
{
  "requestId": "01JXXXXXXXXXXXXXXXXXXXXXXX",
  "totalLatency": 287.412,
  "stages": [
    {
      "stage": "api_handler:POST /retrieve",
      "startTime": "2026-06-08T14:32:01.123Z",
      "endTime": "2026-06-08T14:32:01.410Z",
      "durationMs": 287.412
    },
    {
      "stage": "domain_resolution",
      "startTime": "2026-06-08T14:32:01.125Z",
      "endTime": "2026-06-08T14:32:01.148Z",
      "durationMs": 23.104
    },
    {
      "stage": "retrieval",
      "startTime": "2026-06-08T14:32:01.149Z",
      "endTime": "2026-06-08T14:32:01.380Z",
      "durationMs": 231.056
    },
    {
      "stage": "vector_retrieval",
      "startTime": "2026-06-08T14:32:01.162Z",
      "endTime": "2026-06-08T14:32:01.245Z",
      "durationMs": 83.221
    },
    {
      "stage": "relationship_expansion",
      "startTime": "2026-06-08T14:32:01.268Z",
      "endTime": "2026-06-08T14:32:01.291Z",
      "durationMs": 23.007
    }
  ]
}
```

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| ALS lost across worker boundaries | Worker jobs create their own collector with job `traceId`; merge via events |
| Double-counting stages | Parent stages (`retrieval`) wrap children; children also recorded — document as hierarchical, not additive |
| `Date.now()` vs hrtime mismatch with existing records | Bridge layer converts; new audits use hrtime exclusively |
| Performance overhead | hrtime calls are ~nanoseconds; no I/O in hot path until request end |

---

## Out of Scope (per requirements)

- Changing pipeline behavior, thresholds, or stage ordering
- New database tables or migrations
- Replacing existing `*StageRecord` types
- Real-time dashboards or alerting (logs/events only)
- Cross-service distributed tracing (single-process V1)

---

## Alignment with Global Architecture Prompt

This plan follows the observability-first mandate in `docs/GLOBAL_ARCHITECTURE_PROMPT.md`:

- Deterministic, explainable, traceable operations
- Structured events for every major operation
- Dashboard inspectability via existing trace viewers
- Layered simplicity — one shared collector, thin wrappers at boundaries

---

## Relationship to Database Query Observability

This system complements `DATABASE_QUERY_OBSERVABILITY.md`:

| System | Measures | Granularity |
|--------|----------|-------------|
| Execution timing | Pipeline stages (retrieval, compression, etc.) | Application logic boundaries |
| Database query observability | Prisma operations | Database access layer |

Both share `AsyncLocalStorage` scope propagation and correlate to the same `traceId` / `retrievalId`. A single retrieval request may produce both `timingAudit` and `dbObservability` payloads.

---

## References

- `docs/PERFORMANCE-AUDITS/DATABASE_QUERY_OBSERVABILITY.md` — complementary database query audit
- `docs/GLOBAL_ARCHITECTURE_PROMPT.md` — observability requirements
- `docs/architecture/analytics-observability.md` — observability categories
- `docs/infrastructure/observability-infrastructure.md` — infrastructure stack
- `packages/observability/` — existing logger, trace, and request logging
- `packages/ingestion/src/pipeline.ts` — ingestion stage records
- `packages/retrieval/src/pipeline.ts` — retrieval stage records
- `packages/compression/src/pipeline.ts` — compression stage records
- `packages/context-delivery/src/pipeline.ts` — context render stage records
- `packages/planning/src/pipeline.ts` — planning stage records
- `packages/domain-engine/src/execution-context.ts` — domain resolution
