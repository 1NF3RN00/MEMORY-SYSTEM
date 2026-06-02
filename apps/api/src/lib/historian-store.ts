import { Prisma, type PrismaClient } from "@prisma/client";
import {
  buildReplaySnapshot,
  compressSnapshotPayload,
  executeReplay,
  mergeRetentionConfig,
  selectSnapshotsForArchival,
  type BuildSnapshotInput,
} from "@memory-middleware/historian";
import type {
  HistorianCompressionArtifact,
  HistorianRetentionConfig,
  MemoryHistoryTimeline,
  PermanentDeletionResult,
  ReplayMode,
  ReplayResult,
  ReplaySnapshot,
  RetentionMode,
  WorkspaceConfig,
} from "@memory-middleware/shared-types";
import { DEFAULT_HISTORIAN_RETENTION_CONFIG } from "@memory-middleware/shared-types";
import type { StoredCompressionResult } from "./compression-store.js";
import { getDeliveryArtifactsForTrace } from "./context-store.js";
import type { StoredRetrievalResult } from "./retrieval-store.js";

export function snapshotFromRow(row: {
  replayId: string;
  retrievalTraceId: string;
  workspaceId: string;
  integrityHash: string;
  payload: unknown;
  createdAt: Date;
}): ReplaySnapshot {
  const payload = row.payload as ReplaySnapshot;
  return {
    ...payload,
    replayId: row.replayId,
    retrievalTraceId: row.retrievalTraceId,
    workspaceId: row.workspaceId,
    integrityHash: row.integrityHash,
    replayTimestamp: payload.replayTimestamp ?? row.createdAt.toISOString(),
    compressionArtifacts: payload.compressionArtifacts ?? [],
    deliveryArtifacts: payload.deliveryArtifacts ?? [],
  };
}

export async function persistReplaySnapshot(
  prisma: PrismaClient,
  snapshot: ReplaySnapshot,
  retentionMode: RetentionMode = "operational",
): Promise<void> {
  await prisma.replaySnapshot.upsert({
    where: { replayId: snapshot.replayId },
    create: {
      replayId: snapshot.replayId,
      retrievalTraceId: snapshot.retrievalTraceId,
      workspaceId: snapshot.workspaceId,
      integrityHash: snapshot.integrityHash,
      payload: JSON.parse(JSON.stringify(snapshot)) as Prisma.InputJsonValue,
      retentionMode,
    },
    update: {
      integrityHash: snapshot.integrityHash,
      payload: JSON.parse(JSON.stringify(snapshot)) as Prisma.InputJsonValue,
    },
  });
}

export async function captureReplaySnapshotFromTrace(
  prisma: PrismaClient,
  retrievalTraceId: string,
): Promise<ReplaySnapshot | null> {
  const op = await prisma.retrievalOperation.findFirst({
    where: { traceId: retrievalTraceId },
    orderBy: { createdAt: "desc" },
  });

  if (!op || op.status !== "completed") return null;

  const result = (op.result ?? {}) as unknown as StoredRetrievalResult;
  if (!result.contextPackage) return null;

  const compressionOps = await prisma.compressionOperation.findMany({
    where: { retrievalTraceId, status: "completed" },
    orderBy: { createdAt: "asc" },
  });

  const compressionArtifacts: HistorianCompressionArtifact[] = compressionOps.map((cop) => {
    const stored = (cop.result ?? {}) as unknown as StoredCompressionResult;
    return {
      compressionTraceId: cop.traceId,
      retrievalTraceId: cop.retrievalTraceId,
      fidelityMode: stored.fidelityMode ?? "balanced",
      mergeDecisions: stored.mergeDecisions ?? [],
      trimmingDecisions: stored.trimmingDecisions ?? [],
      stageTraces: stored.stageTraces ?? [],
      ...(stored.fidelityReport ? { fidelityReport: stored.fidelityReport } : {}),
      ...(stored.optimizedContextPackage
        ? { optimizedContextPackage: stored.optimizedContextPackage }
        : {}),
    };
  });

  const deliveryArtifacts = await getDeliveryArtifactsForTrace(prisma, retrievalTraceId);

  const buildInput: BuildSnapshotInput = {
    retrievalTraceId,
    workspaceId: op.workspaceId,
    originalQuery: op.query,
    retrievalMode: result.retrievalMode ?? "precision",
    tokenBudget: result.tokenBudget ?? result.contextPackage.tokenBudget.maxTokens,
    contextPackage: result.contextPackage,
    retrievalStages: result.stages ?? [],
    ...(result.preprocessedQuery ? { preprocessedQuery: result.preprocessedQuery } : {}),
    compressionArtifacts,
    deliveryArtifacts,
  };

  const snapshot = buildReplaySnapshot(buildInput);
  await persistReplaySnapshot(prisma, snapshot);
  return snapshot;
}

export async function getReplaySnapshotByTraceId(
  prisma: PrismaClient,
  traceId: string,
): Promise<ReplaySnapshot | null> {
  const row = await prisma.replaySnapshot.findFirst({
    where: { retrievalTraceId: traceId },
    orderBy: { createdAt: "desc" },
  });

  if (row) return snapshotFromRow(row);

  return captureReplaySnapshotFromTrace(prisma, traceId);
}

export async function getReplaySnapshotByReplayId(
  prisma: PrismaClient,
  replayId: string,
): Promise<ReplaySnapshot | null> {
  const row = await prisma.replaySnapshot.findUnique({ where: { replayId } });
  if (!row) return null;
  return snapshotFromRow(row);
}

export async function runStoredReplay(
  prisma: PrismaClient,
  traceId: string,
  mode: ReplayMode = "exact",
  stage?: ReplaySnapshot["stages"][number]["stage"],
): Promise<ReplayResult | null> {
  const snapshot = await getReplaySnapshotByTraceId(prisma, traceId);
  if (!snapshot) return null;
  return executeReplay(snapshot, mode, stage);
}

export async function listReplaySnapshots(
  prisma: PrismaClient,
  workspaceId: string,
  limit = 50,
): Promise<ReplaySnapshot[]> {
  const rows = await prisma.replaySnapshot.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 100),
  });

  return rows.map(snapshotFromRow);
}

export async function getWorkspaceHistorianConfig(
  prisma: PrismaClient,
  workspaceId: string,
): Promise<HistorianRetentionConfig> {
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) return DEFAULT_HISTORIAN_RETENTION_CONFIG;

  const config = workspace.config as unknown as WorkspaceConfig;
  return mergeRetentionConfig(config.historian?.retention);
}

export async function applyRetentionArchival(
  prisma: PrismaClient,
  workspaceId: string,
): Promise<{ archivedCount: number; archivedReplayIds: string[]; retentionMode: RetentionMode }> {
  const config = await getWorkspaceHistorianConfig(prisma, workspaceId);
  if (!config.autoArchiveEnabled) {
    return { archivedCount: 0, archivedReplayIds: [], retentionMode: "operational" };
  }

  const rows = await prisma.replaySnapshot.findMany({
    where: { workspaceId, retentionMode: { not: "permanent_deletion" } },
    orderBy: { createdAt: "asc" },
  });

  const selection = selectSnapshotsForArchival(
    rows.map((r) => ({
      replayId: r.replayId,
      createdAt: r.createdAt,
      retentionMode: r.retentionMode as RetentionMode,
    })),
    config,
  );

  for (const replayId of selection.archivedReplayIds) {
    const row = rows.find((r) => r.replayId === replayId);
    if (!row) continue;

    const nextMode = selection.retentionMode;
    const payload: Prisma.InputJsonValue =
      nextMode === "compressed_archival"
        ? (JSON.parse(
            JSON.stringify(compressSnapshotPayload(row.payload as Record<string, unknown>)),
          ) as Prisma.InputJsonValue)
        : (row.payload as Prisma.InputJsonValue);

    await prisma.replaySnapshot.update({
      where: { replayId },
      data: {
        retentionMode: nextMode,
        archivedAt: new Date(),
        payload,
      },
    });
  }

  return selection;
}

export async function permanentlyDeleteHistory(
  prisma: PrismaClient,
  id: string,
): Promise<PermanentDeletionResult | { error: string; status: number }> {
  const byReplay = await prisma.replaySnapshot.findUnique({ where: { replayId: id } });
  const retrievalTraceId = byReplay?.retrievalTraceId ?? id;
  const workspaceId =
    byReplay?.workspaceId ??
    (
      await prisma.retrievalOperation.findFirst({
        where: { traceId: retrievalTraceId },
      })
    )?.workspaceId;

  if (!workspaceId) {
    return { error: "History record not found", status: 404 };
  }

  const replayDelete = await prisma.replaySnapshot.deleteMany({
    where: {
      OR: [{ replayId: id }, { retrievalTraceId }],
    },
  });

  const retrievalDelete = await prisma.retrievalOperation.deleteMany({
    where: { traceId: retrievalTraceId },
  });

  const compressionDelete = await prisma.compressionOperation.deleteMany({
    where: { retrievalTraceId },
  });

  const eventDelete = await prisma.eventLog.deleteMany({
    where: { traceId: { in: [retrievalTraceId, id] } },
  });

  return {
    deletedId: id,
    idType: byReplay ? "replay" : "retrieval_trace",
    workspaceId,
    removedReplaySnapshots: replayDelete.count,
    removedRetrievalOperations: retrievalDelete.count,
    removedCompressionOperations: compressionDelete.count,
    removedEventLogs: eventDelete.count,
    deletedAt: new Date().toISOString(),
  };
}

export async function buildMemoryHistoryTimeline(
  prisma: PrismaClient,
  memoryId: string,
): Promise<MemoryHistoryTimeline | { error: string; status: number }> {
  const memory = await prisma.memory.findUnique({ where: { id: memoryId } });
  if (!memory) return { error: "Memory not found", status: 404 };

  const metadata = (memory.metadata ?? {}) as Record<string, unknown>;
  const scoring = (memory.scoring ?? {}) as Record<string, unknown>;
  const evolutionHistory =
    (metadata.evolutionHistory as Array<Record<string, unknown>> | undefined) ?? [];

  const reinforcementProgression = evolutionHistory
    .filter((e) => e.type === "reinforcement" || e.reinforcementScore !== undefined)
    .map((e) => ({
      timestamp: String(e.timestamp ?? e.updatedAt ?? memory.updatedAt.toISOString()),
      reinforcementScore: Number(e.reinforcementScore ?? scoring.reinforcementScore ?? 0),
      retrievalCount: Number(e.retrievalCount ?? scoring.retrievalCount ?? 0),
      ...(e.traceId ? { traceId: String(e.traceId) } : {}),
    }));

  const decayProgression = evolutionHistory
    .filter((e) => e.type === "decay" || e.recencyScore !== undefined)
    .map((e) => ({
      timestamp: String(e.timestamp ?? memory.updatedAt.toISOString()),
      recencyScore: Number(e.recencyScore ?? scoring.recencyScore ?? 0),
      relevanceScore: Number(e.relevanceScore ?? scoring.relevanceScore ?? 0),
    }));

  const archivalHistory: MemoryHistoryTimeline["archivalHistory"] = [];
  if (memory.archived && memory.archivedAt) {
    archivalHistory.push({
      timestamp: memory.archivedAt.toISOString(),
      action: "archived",
      detail: "Memory archived — removed from active retrieval",
    });
  }

  const ops = await prisma.retrievalOperation.findMany({
    where: { workspaceId: memory.workspaceId, status: "completed" },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const retrievalFrequency: MemoryHistoryTimeline["retrievalFrequency"] = [];

  for (const op of ops) {
    const result = (op.result ?? {}) as unknown as StoredRetrievalResult;
    const pkg = result.contextPackage;
    if (!pkg) continue;

    const trace = pkg.chunkTraces.find((t) => t.memoryId === memoryId);
    if (!trace) continue;

    retrievalFrequency.push({
      retrievalTraceId: op.traceId,
      query: op.query,
      rank: trace.rankingRank,
      timestamp: op.createdAt.toISOString(),
    });
  }

  return {
    memoryId,
    workspaceId: memory.workspaceId,
    reinforcementProgression,
    decayProgression,
    archivalHistory,
    retrievalFrequency,
  };
}
