# Sprint-34 Migration — Workspace Metrics Aggregation Store

## Overview

Adds `workspace_metrics_summaries` — one row per workspace with pre-aggregated operation counters. Dashboard summary tier reads counts via `GET /workspaces/:workspaceId/metrics/summary` (O(1) `findUnique` by primary key).

Historian traces, `retrievalOperation.result` JSON, and diagnostic payloads are **unchanged**.

## Schema

| Table | PK | Purpose |
|-------|-----|---------|
| `workspace_metrics_summaries` | `workspace_id` | Scalar counters for retrieval, ingestion, compression, context render, active memories |

Migration: `apps/api/prisma/migrations/20250608120000_sprint34_metrics_aggregation/migration.sql`

## Deploy steps

1. Apply migration:
   ```bash
   npm run db:migrate:deploy -w @memory-middleware/api
   ```
2. Regenerate Prisma client:
   ```bash
   npm run db:generate -w @memory-middleware/api
   ```
3. Backfill existing workspaces (idempotent):
   ```bash
   npx tsx apps/api/scripts/backfill-workspace-metrics.ts
   ```
   Or single workspace:
   ```bash
   npx tsx apps/api/scripts/backfill-workspace-metrics.ts <workspaceId>
   ```

## Dual-write behavior

Counters increment on terminal operation completion:

| Operation | Hook location | Terminal statuses |
|-----------|---------------|-------------------|
| Retrieval | `completeRetrievalOperation` | `completed`, `failed` |
| Ingestion | `createPipelineStore.updateTraceStatus` | `completed`, `stored`, `failed` |
| Compression | `completeCompressionOperation` | `completed`, `failed` |
| Context render | `completeContextRenderOperation` | `completed`, `failed` |
| Active memories | `persistMemory` (+1), `expireTemporaryMemories` (-1) | — |

New operations after deploy auto-populate counters even before backfill.

## Rollback (reversible)

1. Revert application code (dashboard falls back to trace-list counts when `metricsSummary` is null).
2. Drop table (no FK dependents except `workspaces`):
   ```sql
   DROP TABLE IF EXISTS "workspace_metrics_summaries";
   ```
3. Remove Prisma model and re-run `db:generate`.

No changes to historian, trace JSON columns, or EventLog.

## Verification

After backfill, compare sample workspace:

```bash
# API metrics summary
curl -H "Authorization: Bearer $TOKEN" \
  "$API/workspaces/$WORKSPACE_ID/metrics/summary"
```

Counts should match `COUNT(*)` on operation tables for totals; 24h windows use `created_at >= now() - interval '24 hours'`.
