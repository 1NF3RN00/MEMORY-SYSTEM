import type { PrismaClient } from "@prisma/client";

export const CLEAR_DATA_CONFIRMATION = "clear all data";

export interface WorkspaceClearResult {
  workspaceId: string;
  clearedAt: string;
  deleted: Record<string, number>;
}

export async function clearWorkspaceData(
  prisma: PrismaClient,
  workspaceId: string,
): Promise<WorkspaceClearResult> {
  const deleted: Record<string, number> = {};

  await prisma.$transaction(async (tx) => {
    deleted.memoryRelationships = (
      await tx.memoryRelationship.deleteMany({ where: { workspaceId } })
    ).count;
    deleted.memories = (await tx.memory.deleteMany({ where: { workspaceId } })).count;
    deleted.sourceTruths = (await tx.sourceTruth.deleteMany({ where: { workspaceId } })).count;
    deleted.ingestionTraces = (
      await tx.ingestionTrace.deleteMany({ where: { workspaceId } })
    ).count;
    deleted.ingestionJobs = (await tx.ingestionJob.deleteMany({ where: { workspaceId } })).count;
    deleted.eventLogs = (await tx.eventLog.deleteMany({ where: { workspaceId } })).count;
    deleted.retrievalOperations = (
      await tx.retrievalOperation.deleteMany({ where: { workspaceId } })
    ).count;
    deleted.compressionOperations = (
      await tx.compressionOperation.deleteMany({ where: { workspaceId } })
    ).count;
    deleted.contextRenderOperations = (
      await tx.contextRenderOperation.deleteMany({ where: { workspaceId } })
    ).count;
    deleted.retrievalPlans = (await tx.retrievalPlan.deleteMany({ where: { workspaceId } })).count;
    deleted.replaySnapshots = (await tx.replaySnapshot.deleteMany({ where: { workspaceId } })).count;
    deleted.snapshots = (await tx.snapshot.deleteMany({ where: { workspaceId } })).count;
    deleted.compressionArtifacts = (
      await tx.compressionArtifact.deleteMany({ where: { workspaceId } })
    ).count;
    deleted.workspaceMetricsSummaries = (
      await tx.workspaceMetricsSummary.deleteMany({ where: { workspaceId } })
    ).count;
  });

  return {
    workspaceId,
    clearedAt: new Date().toISOString(),
    deleted,
  };
}
