/**
 * Backfill pre-aggregated workspace metrics from existing operation tables.
 * Run: npx tsx apps/api/scripts/backfill-workspace-metrics.ts [workspaceId]
 *
 * Idempotent — safe to re-run. See sprint-34 MIGRATION.md for rollback steps.
 */
import { PrismaClient } from "@prisma/client";
import {
  backfillAllWorkspaceMetrics,
  backfillWorkspaceMetrics,
} from "../src/lib/metrics-aggregation-store.js";

const prisma = new PrismaClient();
const workspaceId = process.argv[2];

async function main(): Promise<void> {
  const results = workspaceId
    ? [await backfillWorkspaceMetrics(prisma, workspaceId)]
    : await backfillAllWorkspaceMetrics(prisma);

  for (const result of results) {
    console.log(
      [
        result.workspaceId,
        `memories=${result.activeMemories}`,
        `retrieval=${result.retrievalTotal}`,
        `ingestion=${result.ingestionTotal}`,
        `compression=${result.compressionTotal}`,
        `contextRender=${result.contextRenderTotal}`,
      ].join(" "),
    );
  }

  console.log(`Backfilled metrics for ${results.length} workspace(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
