import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(here, "..");

function readSource(relativePath: string): string {
  return readFileSync(join(srcRoot, relativePath), "utf8");
}

describe("sprint-34 metrics aggregation store", () => {
  it("registers GET /workspaces/:workspaceId/metrics/summary with workspace scope", () => {
    const source = readSource("routes/workspaces.ts");
    assert.match(source, /\/workspaces\/:workspaceId\/metrics\/summary/);
    assert.match(source, /getWorkspaceMetricsSummary/);
    assert.match(source, /enforceWorkspaceScope/);
  });

  it("increments retrieval metrics on completeRetrievalOperation", () => {
    const source = readSource("lib/retrieval-store.ts");
    assert.match(source, /recordRetrievalMetrics/);
  });

  it("increments compression metrics on completeCompressionOperation", () => {
    const source = readSource("lib/compression-store.ts");
    assert.match(source, /recordCompressionMetrics/);
  });

  it("increments context render metrics on completeContextRenderOperation", () => {
    const source = readSource("lib/context-store.ts");
    assert.match(source, /recordContextRenderMetrics/);
  });

  it("increments ingestion metrics on terminal updateTraceStatus", () => {
    const source = readSource("lib/ingestion-store.ts");
    assert.match(source, /recordIngestionMetrics/);
    assert.match(source, /ingestionStatusToMetricsStatus/);
  });

  it("getWorkspaceMetricsSummary uses findUnique for O(1) read", () => {
    const source = readSource("lib/metrics-aggregation-store.ts");
    assert.match(source, /findUnique/);
    assert.match(source, /workspaceId/);
  });

  it("documents backfill script and migration", () => {
    const migration = readFileSync(
      join(
        srcRoot,
        "..",
        "prisma",
        "migrations",
        "20250608120000_sprint34_metrics_aggregation",
        "migration.sql",
      ),
      "utf8",
    );
    assert.match(migration, /workspace_metrics_summaries/);
    const backfill = readSource("../scripts/backfill-workspace-metrics.ts");
    assert.match(backfill, /backfillWorkspaceMetrics/);
    assert.match(backfill, /backfillAllWorkspaceMetrics/);
  });

  it("exports WorkspaceMetricsSummaryResponse contract", () => {
    const contractsPath = join(
      srcRoot,
      "..",
      "..",
      "..",
      "packages",
      "shared-types",
      "src",
      "workspace-metrics-contracts.ts",
    );
    const source = readFileSync(contractsPath, "utf8");
    assert.match(source, /WorkspaceMetricsSummaryResponse/);
    assert.match(source, /metrics\/summary/);
  });
});
