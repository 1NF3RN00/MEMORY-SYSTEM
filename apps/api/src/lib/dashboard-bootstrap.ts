import type { PrismaClient } from "@prisma/client";
import type { DashboardBootstrapResponse } from "@memory-middleware/shared-types";
import { listRetrievalTraces } from "./retrieval-store.js";

const SUMMARY_LIMITS = {
  memories: 100,
  retrievalTraces: 50,
  ingestionTraces: 30,
} as const;

async function probeDatabaseHealth(
  prisma: PrismaClient,
): Promise<DashboardBootstrapResponse["health"]["status"]> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return "ok";
  } catch {
    return "degraded";
  }
}

/**
 * Loads summary-tier dashboard bootstrap data with batched parallel DB reads.
 * Slim rows only — no full trace bodies, ranking breakdowns, or context packages.
 */
export async function loadDashboardBootstrapSummary(
  prisma: PrismaClient,
  workspaceId: string,
  traceId?: string,
): Promise<DashboardBootstrapResponse> {
  const [memories, retrievalTraces, ingestionTraces, healthStatus] = await Promise.all([
    prisma.memory.findMany({
      where: { workspaceId, archived: false },
      orderBy: { createdAt: "desc" },
      take: SUMMARY_LIMITS.memories,
      select: {
        id: true,
        title: true,
        memoryType: true,
        persistenceMode: true,
        archived: true,
      },
    }),
    listRetrievalTraces(prisma, workspaceId, SUMMARY_LIMITS.retrievalTraces),
    prisma.ingestionTrace.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: SUMMARY_LIMITS.ingestionTraces,
      select: {
        traceId: true,
        workspaceId: true,
        memoryId: true,
        status: true,
        sourceType: true,
        createdAt: true,
      },
    }),
    probeDatabaseHealth(prisma),
  ]);

  return {
    workspaceId,
    tier: "summary",
    memories: memories.map((memory) => ({
      id: memory.id,
      title: memory.title,
      memoryType: memory.memoryType,
      persistenceMode: memory.persistenceMode,
      archived: memory.archived,
    })),
    retrievalTraces: retrievalTraces.map((trace) => ({
      retrievalTraceId: trace.retrievalTraceId,
      workspaceId: trace.workspaceId,
      query: trace.query,
      status: trace.status,
      createdAt: trace.createdAt,
      ...(trace.completedAt ? { completedAt: trace.completedAt } : {}),
    })),
    ingestionTraces: ingestionTraces.map((trace) => ({
      traceId: trace.traceId,
      workspaceId: trace.workspaceId,
      memoryId: trace.memoryId,
      status: trace.status,
      sourceType: trace.sourceType,
      createdAt: trace.createdAt.toISOString(),
    })),
    health: {
      status: healthStatus,
      timestamp: new Date().toISOString(),
      ...(traceId ? { trace_id: traceId } : {}),
    },
  };
}
