import type { PrismaClient } from "@prisma/client";
import { buildReplaySnapshot } from "@memory-middleware/historian";
import type { ContextPackage, ReplaySnapshot, WorkflowReplayPayload, WorkflowRunDetail } from "@memory-middleware/shared-types";
import { persistReplaySnapshot } from "./historian-store.js";

function emptyContextPackage(workspaceId: string, tokenBudget: number): ContextPackage {
  const now = new Date().toISOString();
  return {
    workspaceId,
    query: "",
    retrievalTraceId: "workflow-run-empty",
    tokenBudget: { maxTokens: tokenBudget, usedTokens: 0, trimmedTokens: 0 },
    retrievalMetadata: {
      retrievalLatencyMs: 0,
      retrievedChunkCount: 0,
      deduplicatedChunkCount: 0,
      finalChunkCount: 0,
    },
    memories: [],
    rejectedCandidates: [],
    rankingBreakdown: [],
    chunkTraces: [],
    generatedAt: now,
  };
}

export async function captureWorkflowRunReplaySnapshot(
  prisma: PrismaClient,
  detail: WorkflowRunDetail,
  query: string,
): Promise<ReplaySnapshot> {
  const primaryPackage =
    detail.executionContext.retrievedContext[0] ??
    emptyContextPackage(detail.workspaceId, 4000);

  const snapshot = buildReplaySnapshot({
    retrievalTraceId: detail.workflowRunId,
    workspaceId: detail.workspaceId,
    originalQuery: query,
    retrievalMode: "precision",
    tokenBudget: primaryPackage.tokenBudget.maxTokens,
    contextPackage: primaryPackage,
    retrievalStages: [],
  });

  const workflowReplay: WorkflowReplayPayload = {
    workflowId: detail.workflowId,
    workflowRunId: detail.workflowRunId,
    workspaceId: detail.workspaceId,
    executionContext: detail.executionContext,
    outputs: detail.outputs,
    generatedFactIds: detail.generatedFactIds,
    generatedMemoryIds: detail.generatedMemoryIds,
    generatedObjectIds: detail.generatedObjectIds,
  };

  const enriched = {
    ...snapshot,
    workflowReplay,
  } as ReplaySnapshot & { workflowReplay: WorkflowReplayPayload };

  await persistReplaySnapshot(prisma, enriched as ReplaySnapshot);
  return enriched as ReplaySnapshot;
}

export async function getWorkflowRunReplaySnapshot(
  prisma: PrismaClient,
  workflowRunId: string,
): Promise<(ReplaySnapshot & { workflowReplay?: WorkflowReplayPayload }) | null> {
  const row = await prisma.replaySnapshot.findFirst({
    where: { retrievalTraceId: workflowRunId },
    orderBy: { createdAt: "desc" },
  });
  if (!row) return null;
  const payload = row.payload as unknown as ReplaySnapshot & { workflowReplay?: WorkflowReplayPayload };
  return {
    ...payload,
    replayId: row.replayId,
    retrievalTraceId: row.retrievalTraceId,
    workspaceId: row.workspaceId,
    integrityHash: row.integrityHash,
  };
}
