# Telemetry Tier Boundaries — Sprint-12

Reference: [DASHBOARD_LOAD_AUDIT.md §4](../../PERFORMANCE-AUDITS/DASHBOARD_LOAD_AUDIT.md) (analytics loading tiers).

## Summary tier (`fetchTelemetrySummary`)

**Load trigger:** Home mount, MetricsSidebar, home 15s poll (until analytics expanded).

| # | Endpoint | Purpose |
|---|----------|---------|
| 1 | `GET /memory?workspaceId&limit=100` | Memory counts, strategic/transient breakdown |
| 2 | `GET /retrieval?workspaceId&limit=50` | Latency indicators, stream events, 24h ops |
| 3 | `GET /ingestion?workspaceId&limit=30` | Ingestion throughput, stream events |
| 4 | `GET /health` | System health pill |

**Request count:** 4

**Deferred fields until analytics:** compression efficiency, drift counts, low-confidence diagnostics, heatmap scope, compression/context detail, compression stream events.

## Analytics tier (`fetchTelemetryAnalytics`)

**Load trigger:** Observability route mount, home intelligence panel “Load diagnostics”, full poll after expand.

| # | Endpoint | Purpose |
|---|----------|---------|
| 1 | `GET /compression?workspaceId&limit=30` | Compression list + activity feed |
| 2 | `GET /context/render?workspaceId&limit=20` | Tokens assembled, token throughput |
| 3 | `GET /diagnostics/drift?workspaceId&limit=50` | Drift signals, expiring contexts |
| 4 | `GET /diagnostics/operational?mode=slim` | Low-confidence retrieval counts |
| 5 | `GET /retrieval/heatmaps?limit=20` | Most active scope, Observability heatmap |
| 6 | `GET /compression/:id?summary=true` | Compression ratio / fidelity (conditional) |

**Request count:** 5–6

## Full bundle (`fetchWorkspaceTelemetry`)

Alias for summary + analytics. Used by Observability to preserve complete metrics without duplicating merge logic.

## Ranking breakdown

Not part of either tier. Loaded on demand via `fetchRankingBreakdown` on Observability only (Sprint-06).
