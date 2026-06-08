import type { Prisma, PrismaClient } from "@prisma/client";
import type { WorkspaceMetricsSummaryResponse } from "@memory-middleware/shared-types";

const ROLLING_WINDOW_MS = 24 * 60 * 60 * 1000;

const TERMINAL_INGESTION_STATUSES = new Set(["completed", "stored", "failed"]);

type OperationKind = "retrieval" | "ingestion" | "compression" | "contextRender";
type TerminalStatus = "completed" | "failed";

interface MetricsRow {
  workspaceId: string;
  activeMemories: number;
  retrievalTotal: number;
  retrievalCompleted: number;
  retrievalFailed: number;
  retrieval24h: number;
  retrievalFailed24h: number;
  retrievalLatencySumMs: bigint;
  retrievalLatencyCount: number;
  ingestionTotal: number;
  ingestionCompleted: number;
  ingestionFailed: number;
  ingestion24h: number;
  compressionTotal: number;
  compressionCompleted: number;
  compressionFailed: number;
  contextRenderTotal: number;
  contextRenderCompleted: number;
  contextRenderFailed: number;
  rollingWindowStartAt: Date;
  updatedAt: Date;
}

function emptyMetricsData(workspaceId: string): Prisma.WorkspaceMetricsSummaryCreateInput {
  return {
    workspace: { connect: { id: workspaceId } },
    activeMemories: 0,
    retrievalTotal: 0,
    retrievalCompleted: 0,
    retrievalFailed: 0,
    retrieval24h: 0,
    retrievalFailed24h: 0,
    retrievalLatencySumMs: 0n,
    retrievalLatencyCount: 0,
    ingestionTotal: 0,
    ingestionCompleted: 0,
    ingestionFailed: 0,
    ingestion24h: 0,
    compressionTotal: 0,
    compressionCompleted: 0,
    compressionFailed: 0,
    contextRenderTotal: 0,
    contextRenderCompleted: 0,
    contextRenderFailed: 0,
    rollingWindowStartAt: new Date(),
  };
}

function shouldResetRollingWindow(rollingWindowStartAt: Date, now = new Date()): boolean {
  return now.getTime() - rollingWindowStartAt.getTime() >= ROLLING_WINDOW_MS;
}

function rollingWindowPatch(
  row: Pick<MetricsRow, "rollingWindowStartAt" | "retrieval24h" | "retrievalFailed24h" | "ingestion24h">,
  now = new Date(),
): Prisma.WorkspaceMetricsSummaryUpdateInput | null {
  if (!shouldResetRollingWindow(row.rollingWindowStartAt, now)) {
    return null;
  }
  return {
    rollingWindowStartAt: now,
    retrieval24h: 0,
    retrievalFailed24h: 0,
    ingestion24h: 0,
  };
}

function toResponse(row: MetricsRow): WorkspaceMetricsSummaryResponse {
  const avgLatencyMs =
    row.retrievalLatencyCount > 0
      ? Math.round(Number(row.retrievalLatencySumMs) / row.retrievalLatencyCount)
      : 0;

  return {
    workspaceId: row.workspaceId,
    activeMemories: row.activeMemories,
    retrieval: {
      total: row.retrievalTotal,
      completed: row.retrievalCompleted,
      failed: row.retrievalFailed,
      last24h: row.retrieval24h,
      failedLast24h: row.retrievalFailed24h,
      avgLatencyMs,
    },
    ingestion: {
      total: row.ingestionTotal,
      completed: row.ingestionCompleted,
      failed: row.ingestionFailed,
      last24h: row.ingestion24h,
      throughputPerHour: Number((row.ingestion24h / 24).toFixed(1)),
    },
    compression: {
      total: row.compressionTotal,
      completed: row.compressionCompleted,
      failed: row.compressionFailed,
    },
    contextRender: {
      total: row.contextRenderTotal,
      completed: row.contextRenderCompleted,
      failed: row.contextRenderFailed,
    },
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function ensureMetricsRow(
  prisma: PrismaClient,
  workspaceId: string,
): Promise<MetricsRow> {
  const existing = await prisma.workspaceMetricsSummary.findUnique({
    where: { workspaceId },
  });
  if (existing) {
    return existing;
  }

  return prisma.workspaceMetricsSummary.create({
    data: emptyMetricsData(workspaceId),
  });
}

async function applyOperationIncrement(
  prisma: PrismaClient,
  workspaceId: string,
  kind: OperationKind,
  status: TerminalStatus,
  options?: { latencyMs?: number },
): Promise<void> {
  const row = await ensureMetricsRow(prisma, workspaceId);
  const now = new Date();
  const windowReset = rollingWindowPatch(row, now);

  const completedDelta = status === "completed" ? 1 : 0;
  const failedDelta = status === "failed" ? 1 : 0;

  const baseUpdate: Prisma.WorkspaceMetricsSummaryUpdateInput = {
    ...(windowReset ?? {}),
  };

  switch (kind) {
    case "retrieval":
      Object.assign(baseUpdate, {
        retrievalTotal: { increment: 1 },
        retrievalCompleted: { increment: completedDelta },
        retrievalFailed: { increment: failedDelta },
        retrieval24h: { increment: 1 },
        retrievalFailed24h: { increment: failedDelta },
        ...(status === "completed" && options?.latencyMs && options.latencyMs > 0
          ? {
              retrievalLatencySumMs: { increment: BigInt(Math.round(options.latencyMs)) },
              retrievalLatencyCount: { increment: 1 },
            }
          : {}),
      });
      break;
    case "ingestion":
      Object.assign(baseUpdate, {
        ingestionTotal: { increment: 1 },
        ingestionCompleted: { increment: completedDelta },
        ingestionFailed: { increment: failedDelta },
        ingestion24h: { increment: 1 },
      });
      break;
    case "compression":
      Object.assign(baseUpdate, {
        compressionTotal: { increment: 1 },
        compressionCompleted: { increment: completedDelta },
        compressionFailed: { increment: failedDelta },
      });
      break;
    case "contextRender":
      Object.assign(baseUpdate, {
        contextRenderTotal: { increment: 1 },
        contextRenderCompleted: { increment: completedDelta },
        contextRenderFailed: { increment: failedDelta },
      });
      break;
  }

  await prisma.workspaceMetricsSummary.update({
    where: { workspaceId },
    data: baseUpdate,
  });
}

export async function recordRetrievalMetrics(
  prisma: PrismaClient,
  workspaceId: string,
  status: TerminalStatus,
  latencyMs?: number,
): Promise<void> {
  await applyOperationIncrement(
    prisma,
    workspaceId,
    "retrieval",
    status,
    latencyMs !== undefined ? { latencyMs } : undefined,
  );
}

export async function recordIngestionMetrics(
  prisma: PrismaClient,
  workspaceId: string,
  status: TerminalStatus,
): Promise<void> {
  await applyOperationIncrement(prisma, workspaceId, "ingestion", status);
}

export async function recordCompressionMetrics(
  prisma: PrismaClient,
  workspaceId: string,
  status: TerminalStatus,
): Promise<void> {
  await applyOperationIncrement(prisma, workspaceId, "compression", status);
}

export async function recordContextRenderMetrics(
  prisma: PrismaClient,
  workspaceId: string,
  status: TerminalStatus,
): Promise<void> {
  await applyOperationIncrement(prisma, workspaceId, "contextRender", status);
}

export async function adjustActiveMemories(
  prisma: PrismaClient,
  workspaceId: string,
  delta: number,
): Promise<void> {
  if (delta === 0) return;

  await prisma.workspaceMetricsSummary.upsert({
    where: { workspaceId },
    create: {
      ...emptyMetricsData(workspaceId),
      activeMemories: Math.max(0, delta),
    },
    update: {
      activeMemories: { increment: delta },
    },
  });
}

export async function resetWorkspaceMetrics(
  prisma: PrismaClient,
  workspaceId: string,
): Promise<void> {
  await prisma.workspaceMetricsSummary.deleteMany({ where: { workspaceId } });
}

export function isTerminalIngestionStatus(status: string): status is TerminalStatus | "stored" {
  return TERMINAL_INGESTION_STATUSES.has(status);
}

export function ingestionStatusToMetricsStatus(
  status: string,
): TerminalStatus | null {
  if (status === "completed" || status === "stored") return "completed";
  if (status === "failed") return "failed";
  return null;
}

/** O(1) metrics read — single row by workspace ID. */
export async function getWorkspaceMetricsSummary(
  prisma: PrismaClient,
  workspaceId: string,
): Promise<WorkspaceMetricsSummaryResponse> {
  const row = await prisma.workspaceMetricsSummary.findUnique({
    where: { workspaceId },
  });

  if (!row) {
    return toResponse({
      workspaceId,
      activeMemories: 0,
      retrievalTotal: 0,
      retrievalCompleted: 0,
      retrievalFailed: 0,
      retrieval24h: 0,
      retrievalFailed24h: 0,
      retrievalLatencySumMs: 0n,
      retrievalLatencyCount: 0,
      ingestionTotal: 0,
      ingestionCompleted: 0,
      ingestionFailed: 0,
      ingestion24h: 0,
      compressionTotal: 0,
      compressionCompleted: 0,
      compressionFailed: 0,
      contextRenderTotal: 0,
      contextRenderCompleted: 0,
      contextRenderFailed: 0,
      rollingWindowStartAt: new Date(),
      updatedAt: new Date(),
    });
  }

  const now = new Date();
  const windowReset = rollingWindowPatch(row, now);
  if (windowReset) {
    const refreshed = await prisma.workspaceMetricsSummary.update({
      where: { workspaceId },
      data: windowReset,
    });
    return toResponse(refreshed);
  }

  return toResponse(row);
}

export interface BackfillWorkspaceMetricsResult {
  workspaceId: string;
  activeMemories: number;
  retrievalTotal: number;
  ingestionTotal: number;
  compressionTotal: number;
  contextRenderTotal: number;
}

const twentyFourHoursAgo = (): Date => new Date(Date.now() - ROLLING_WINDOW_MS);

/** Rebuild aggregation row from existing operation tables (idempotent upsert). */
export async function backfillWorkspaceMetrics(
  prisma: PrismaClient,
  workspaceId: string,
): Promise<BackfillWorkspaceMetricsResult> {
  const since = twentyFourHoursAgo();

  const [
    activeMemories,
    retrievalTotal,
    retrievalCompleted,
    retrievalFailed,
    retrieval24h,
    retrievalFailed24h,
    retrievalLatencyAgg,
    ingestionTotal,
    ingestionCompleted,
    ingestionFailed,
    ingestion24h,
    compressionTotal,
    compressionCompleted,
    compressionFailed,
    contextRenderTotal,
    contextRenderCompleted,
    contextRenderFailed,
  ] = await Promise.all([
    prisma.memory.count({ where: { workspaceId, archived: false } }),
    prisma.retrievalOperation.count({ where: { workspaceId } }),
    prisma.retrievalOperation.count({ where: { workspaceId, status: "completed" } }),
    prisma.retrievalOperation.count({ where: { workspaceId, status: "failed" } }),
    prisma.retrievalOperation.count({ where: { workspaceId, createdAt: { gte: since } } }),
    prisma.retrievalOperation.count({
      where: { workspaceId, status: "failed", createdAt: { gte: since } },
    }),
    prisma.retrievalOperation.findMany({
      where: { workspaceId, status: "completed", completedAt: { not: null } },
      select: { createdAt: true, completedAt: true },
    }),
    prisma.ingestionTrace.count({ where: { workspaceId } }),
    prisma.ingestionTrace.count({
      where: { workspaceId, status: { in: ["completed", "stored"] } },
    }),
    prisma.ingestionTrace.count({ where: { workspaceId, status: "failed" } }),
    prisma.ingestionTrace.count({ where: { workspaceId, createdAt: { gte: since } } }),
    prisma.compressionOperation.count({ where: { workspaceId } }),
    prisma.compressionOperation.count({ where: { workspaceId, status: "completed" } }),
    prisma.compressionOperation.count({ where: { workspaceId, status: "failed" } }),
    prisma.contextRenderOperation.count({ where: { workspaceId } }),
    prisma.contextRenderOperation.count({ where: { workspaceId, status: "completed" } }),
    prisma.contextRenderOperation.count({ where: { workspaceId, status: "failed" } }),
  ]);

  let retrievalLatencySumMs = 0n;
  let retrievalLatencyCount = 0;
  for (const op of retrievalLatencyAgg) {
    if (!op.completedAt) continue;
    const latencyMs = op.completedAt.getTime() - op.createdAt.getTime();
    if (latencyMs <= 0) continue;
    retrievalLatencySumMs += BigInt(latencyMs);
    retrievalLatencyCount += 1;
  }

  await prisma.workspaceMetricsSummary.upsert({
    where: { workspaceId },
    create: {
      workspace: { connect: { id: workspaceId } },
      activeMemories,
      retrievalTotal,
      retrievalCompleted,
      retrievalFailed,
      retrieval24h,
      retrievalFailed24h,
      retrievalLatencySumMs,
      retrievalLatencyCount,
      ingestionTotal,
      ingestionCompleted,
      ingestionFailed,
      ingestion24h,
      compressionTotal,
      compressionCompleted,
      compressionFailed,
      contextRenderTotal,
      contextRenderCompleted,
      contextRenderFailed,
      rollingWindowStartAt: new Date(),
    },
    update: {
      activeMemories,
      retrievalTotal,
      retrievalCompleted,
      retrievalFailed,
      retrieval24h,
      retrievalFailed24h,
      retrievalLatencySumMs,
      retrievalLatencyCount,
      ingestionTotal,
      ingestionCompleted,
      ingestionFailed,
      ingestion24h,
      compressionTotal,
      compressionCompleted,
      compressionFailed,
      contextRenderTotal,
      contextRenderCompleted,
      contextRenderFailed,
      rollingWindowStartAt: new Date(),
    },
  });

  return {
    workspaceId,
    activeMemories,
    retrievalTotal,
    ingestionTotal,
    compressionTotal,
    contextRenderTotal,
  };
}

export async function backfillAllWorkspaceMetrics(
  prisma: PrismaClient,
): Promise<BackfillWorkspaceMetricsResult[]> {
  const workspaces = await prisma.workspace.findMany({
    where: { archived: false },
    select: { id: true },
  });

  const results: BackfillWorkspaceMetricsResult[] = [];
  for (const workspace of workspaces) {
    results.push(await backfillWorkspaceMetrics(prisma, workspace.id));
  }
  return results;
}
