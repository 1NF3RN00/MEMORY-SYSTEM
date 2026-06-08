# LLM Call Audit

## Objective

Record **every provider model invocation** with operation name, model, prompt tokens, completion tokens, latency, and estimated cost. Emit a unified `llmCallAudit` payload per request and log `llm.audit.completed` events.

**Status: Implemented** (2026-06-08). All three OpenAI client factories are instrumented. `llmCallAudit` is returned on primary LLM-bearing endpoints.

---

## Model Invocation Inventory

Every code path that calls an external LLM provider:

| Operation | Model | Prompt Tokens | Completion Tokens | Latency | Cost | Code location | Triggered by |
|-----------|-------|---------------|-------------------|---------|------|---------------|--------------|
| `embedding` | `text-embedding-3-small` | OpenAI `usage.prompt_tokens` | `0` (embeddings have no completion) | Wall-clock per `embed()` call | `$0.02 / 1M input tokens` | `packages/ingestion/src/embedding.ts` | Ingestion jobs, `POST /retrieve`, workflow retrieval, observations, historian replay, diagnostics |
| `compression_abstraction` | `gpt-4o-mini` | OpenAI `usage.prompt_tokens` | OpenAI `usage.completion_tokens` | Wall-clock per `summarize()` call | `$0.15 / 1M input · $0.60 / 1M output` | `packages/compression/src/abstraction.ts` | `POST /compress` when over token budget and chunk exceeds 1.5× target |
| `workflow_analysis` | `WORKFLOW_ANALYSIS_MODEL` env (e.g. `gpt-4o-mini`) | OpenAI `usage.prompt_tokens` | OpenAI `usage.completion_tokens` | Wall-clock per `callStructuredJson()` | Model-specific (defaults to gpt-4o-mini rates) | `apps/api/src/lib/workflow-analysis-caller.ts` | `POST /workflows/:id/execute` when analysis enabled |

### Routes without LLM calls

| Endpoint / pipeline | Notes |
|---------------------|-------|
| `POST /retrieval/plan` | Deterministic planning only — no provider calls |
| Planning pipeline | Keyword/concept decomposition — no LLM |
| Normalization (`useLlmStructuring`) | Interface exists; no provider client wired in V1 |
| Relationship generation | Deterministic pair scoring — no LLM |

---

## Per-Request Audit Table Shape

Each recorded invocation becomes one row in `llmCallAudit.calls`:

| Field | Source |
|-------|--------|
| Operation | Caller-assigned: `embedding`, `compression_abstraction`, `workflow_analysis` |
| Model | Provider model ID from request or constant |
| Prompt Tokens | `response.usage.prompt_tokens` |
| Completion Tokens | `response.usage.completion_tokens` (0 for embeddings) |
| Latency | `Date.now()` delta for the HTTP call |
| Cost | `estimateLlmCostUsd()` from `packages/observability/src/llm/pricing.ts` |

Aggregates on `llmCallAudit`:

- `totalPromptTokens`, `totalCompletionTokens`, `totalLatencyMs`, `totalCostUsd`
- `requestId` — correlates to HTTP `traceId` or worker job `traceId`

---

## Baseline Measurements (unit test)

Source: `packages/observability/src/llm/collector.test.ts`

| Operation | Model | Prompt Tokens | Completion Tokens | Latency (ms) | Cost (USD) |
|-----------|-------|---------------|-------------------|--------------|------------|
| `embedding` | `text-embedding-3-small` | 120 | 0 | 42 | 0.000002 |
| `compression_abstraction` | `gpt-4o-mini` | 800 | 120 | 310 | 0.000192 |
| `workflow_analysis` | `gpt-4o-mini` | 500 | 200 | 900 | 0.000195 |

Combined audit totals from test fixture: **920 prompt · 120 completion · 352 ms · ~$0.000389**.

Embedding-only cost check: 10,000 prompt tokens → **$0.0002** (matches `text-embedding-3-small` list price).

---

## Findings

1. **Three distinct LLM surfaces** — Embeddings (high volume, low cost), compression abstraction (conditional, per-chunk), workflow analysis (single structured call per run). No other provider clients exist in the monorepo.
2. **Embeddings dominate call count** — Every retrieval and ingestion embeds at least once; compression and workflow analysis are conditional.
3. **Compression LLM is budget-gated** — `optionalAbstraction` only calls the model when a chunk is >1.5× target tokens and abstraction is enabled; otherwise deterministic extraction runs with zero provider cost.
4. **Token usage depends on provider response** — If OpenAI omits `usage`, recorded tokens are `0` (cost $0). Production logs should be validated against provider dashboards.
5. **Cost is estimated, not billed** — Pricing table in `llm/pricing.ts` uses public list prices; actual invoice may differ by tier, caching, or batch discounts.
6. **ALS scope required for recording** — `recordLlmCall()` writes only when a `LlmCallCollector` is active. Primary routes wrap handlers; historian/diagnostics/observation routes rely on the same clients but need explicit `runWithLlmCallAsync` to appear in `llmCallAudit` (calls still execute).
7. **Planning has no LLM cost** — `POST /retrieval/plan` returns `llmCallAudit` with empty `calls[]`.
8. **Worker jobs emit via logs** — Ingestion worker creates a per-job collector and emits `llm.audit.completed` after pipeline completion.

---

## Architecture

```
HTTP onRequest
├── request.llmCallCollector = new LlmCallCollector(traceId)
└── onResponse → emitLlmCallAudit()

Route handler
└── runWithTimingAsync(timing, fn, llm) / runWithLlmCallAsync(llm, fn)
    └── pipeline / client factory
        └── recordLlmCall({ operation, model, tokens, latency })
```

### Instrumented clients

| Client factory | Package |
|----------------|---------|
| `createOpenAiEmbeddingClient` | `@memory-middleware/ingestion` |
| `createOpenAiAbstractionClient` | `@memory-middleware/compression` |
| `createOpenAiStructuredJsonCaller` | `apps/api` |

### Output surfaces

| Surface | Content |
|---------|---------|
| API response | `llmCallAudit` on `POST /retrieve`, `POST /retrieval/plan`, `POST /compress`, `POST /workflows/:id/execute` |
| Structured log | `llm.audit.completed` (Pino) |
| Event sink | `events` table via `EventEmitter` |

### Example `llmCallAudit` payload

```json
{
  "requestId": "01JXXXXXXXXXXXXXXXXXXXXXXX",
  "totalPromptTokens": 312,
  "totalCompletionTokens": 0,
  "totalLatencyMs": 287,
  "totalCostUsd": 0.000006,
  "calls": [
    {
      "operation": "embedding",
      "model": "text-embedding-3-small",
      "promptTokens": 312,
      "completionTokens": 0,
      "latencyMs": 287,
      "costUsd": 0.000006,
      "timestamp": "2026-06-08T14:32:01.410Z"
    }
  ]
}
```

---

## File Change Summary

| Package / App | Files | Change |
|---------------|-------|--------|
| `packages/shared-types` | `llm-call-contracts.ts` | `LlmCallRecord`, `LlmCallAudit` types |
| `packages/observability` | `llm/*`, `middleware/request-timing.ts`, `timing/context.ts` | Collector, ALS, emit, pricing |
| `packages/ingestion` | `embedding.ts` | Record embedding calls |
| `packages/compression` | `abstraction.ts` | Record summarization calls |
| `apps/api` | `workflow-analysis-caller.ts`, routes, `job-processor.ts` | Record analysis calls; wire audit output |

---

## Relationship to Other Audits

| System | Measures |
|--------|----------|
| Execution timing | Pipeline stage latency (no token/cost) |
| LLM call audit | Provider invocations — tokens, latency, cost |
| Database query observability | Prisma operations |

All three correlate to the same `traceId` / `requestId`.

---

## References

- `docs/PERFORMANCE-AUDITS/EXECUTION_TIMING_AUDIT_SYSTEM.md`
- `docs/PERFORMANCE-AUDITS/DATABASE_QUERY_OBSERVABILITY.md`
- `docs/model-layer/token-accounting.md`
- `packages/observability/src/llm/`
