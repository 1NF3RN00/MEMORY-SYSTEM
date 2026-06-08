# Performance Audits

Implementation plans for observability and performance instrumentation across the middleware stack.

| Document | Scope |
|----------|-------|
| [Dashboard Load Audit](./DASHBOARD_LOAD_AUDIT.md) | API fan-out, JSON payload size, eager trace/analytics loading, and React re-render analysis on home load |
| [Execution Timing Audit System](./EXECUTION_TIMING_AUDIT_SYSTEM.md) | **Implemented** — all 12 query-pipeline stages measured; baseline latency findings included |
| [LLM Call Audit](./LLM_CALL_AUDIT.md) | **Implemented** — every provider model invocation recorded with tokens, latency, and cost |
| [Database Query Observability](./DATABASE_QUERY_OBSERVABILITY.md) | Prisma query count, duration, slow/duplicate/N+1 detection, retrieval summaries, top-20 report |

Both systems correlate to the existing `traceId` (ULID) and share the `AsyncLocalStorage` scope pattern in `@memory-middleware/observability`.
