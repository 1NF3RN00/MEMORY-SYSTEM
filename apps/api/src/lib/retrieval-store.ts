import { Prisma, type PrismaClient } from "@prisma/client";
import { mergeRetrievalConfig } from "@memory-middleware/retrieval";
import {
  DEFAULT_RETRIEVAL_RUNTIME_CONFIG,
  type ContextPackage,
  type RelationshipAugmentationResult,
  type RetrievalHeatmapEntry,
  type RetrievalMode,
  type RetrievalQuery,
  type RetrievalRuntimeConfig,
  type RetrievalStageRecord,
  type RetrievalTraceView,
  type WorkspaceConfig,
} from "@memory-middleware/shared-types";

export interface StoredRetrievalResult {
  contextPackage?: ContextPackage;
  stages: RetrievalStageRecord[];
  preprocessedQuery?: {
    normalizedQuery: string;
    keywords: string[];
    tokenCount: number;
  };
  retrievalMode: RetrievalMode;
  tokenBudget: number;
  relationshipAugmentation?: RelationshipAugmentationResult;
  error?: string;
}

export async function createRetrievalOperation(
  prisma: PrismaClient,
  input: {
    workspaceId: string;
    traceId: string;
    query: string;
    retrievalMode: RetrievalMode;
    tokenBudget: number;
  },
): Promise<void> {
  await prisma.retrievalOperation.create({
    data: {
      workspaceId: input.workspaceId,
      traceId: input.traceId,
      query: input.query,
      status: "processing",
      result: {
        retrievalMode: input.retrievalMode,
        tokenBudget: input.tokenBudget,
        stages: [],
      } as Prisma.InputJsonValue,
    },
  });
}

export async function completeRetrievalOperation(
  prisma: PrismaClient,
  traceId: string,
  stored: StoredRetrievalResult,
  status: "completed" | "failed",
  error?: string,
): Promise<void> {
  await prisma.retrievalOperation.updateMany({
    where: { traceId },
    data: {
      status,
      completedAt: new Date(),
      result: JSON.parse(
        JSON.stringify({ ...stored, ...(error ? { error } : {}) }),
      ) as Prisma.InputJsonValue,
    },
  });
}

export async function getRetrievalTrace(
  prisma: PrismaClient,
  traceId: string,
): Promise<RetrievalTraceView | null> {
  const op = await prisma.retrievalOperation.findFirst({
    where: { traceId },
    orderBy: { createdAt: "desc" },
  });

  if (!op) return null;

  const result = (op.result ?? {}) as unknown as StoredRetrievalResult;

  return {
    retrievalTraceId: op.traceId,
    workspaceId: op.workspaceId,
    query: op.query,
    status: op.status as RetrievalTraceView["status"],
    retrievalMode: result.retrievalMode ?? "precision",
    tokenBudget: result.tokenBudget ?? result.contextPackage?.tokenBudget?.maxTokens ?? 0,
    stages: result.stages ?? [],
    ...(result.contextPackage ? { contextPackage: result.contextPackage } : {}),
    ...(result.preprocessedQuery ? { preprocessedQuery: result.preprocessedQuery } : {}),
    createdAt: op.createdAt.toISOString(),
    ...(op.completedAt ? { completedAt: op.completedAt.toISOString() } : {}),
  };
}

export async function listRetrievalTraces(
  prisma: PrismaClient,
  workspaceId?: string,
  limit = 50,
): Promise<
  Array<{
    retrievalTraceId: string;
    workspaceId: string;
    query: string;
    status: string;
    createdAt: string;
    completedAt?: string;
  }>
> {
  const ops = await prisma.retrievalOperation.findMany({
    ...(workspaceId ? { where: { workspaceId } } : {}),
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 100),
  });

  return ops.map((op) => {
    const result = (op.result ?? {}) as unknown as StoredRetrievalResult;
    return {
      retrievalTraceId: op.traceId,
      workspaceId: op.workspaceId,
      query: op.query,
      status: op.status,
      hasContextPackage: Boolean(result.contextPackage),
      createdAt: op.createdAt.toISOString(),
      ...(op.completedAt ? { completedAt: op.completedAt.toISOString() } : {}),
    };
  });
}

export async function getWorkspaceRetrievalConfig(
  prisma: PrismaClient,
  workspaceId: string,
): Promise<WorkspaceConfig | null> {
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) return null;

  const config = workspace.config as unknown as WorkspaceConfig;
  return {
    workspace_id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    retrieval: config.retrieval ?? {
      default_strategy: "deterministic-v1",
      token_budget_default: 4096,
    },
    observability: config.observability ?? {
      trace_enabled: true,
      event_logging_enabled: true,
    },
  };
}

export interface WorkspaceRetrievalConfigView {
  workspaceId: string;
  runtime: RetrievalRuntimeConfig;
  defaults: RetrievalRuntimeConfig;
}

export async function getWorkspaceRetrievalRuntimeConfig(
  prisma: PrismaClient,
  workspaceId: string,
): Promise<WorkspaceRetrievalConfigView | null> {
  const workspace = await getWorkspaceRetrievalConfig(prisma, workspaceId);
  if (!workspace) return null;

  return {
    workspaceId: workspace.workspace_id,
    runtime: mergeRetrievalConfig(workspace),
    defaults: DEFAULT_RETRIEVAL_RUNTIME_CONFIG,
  };
}

export function parseRetrievalConfigPatch(
  body: unknown,
): { similarityThreshold: number } | { error: string } {
  if (!body || typeof body !== "object") {
    return { error: "Request body required" };
  }

  const value = (body as Record<string, unknown>).similarityThreshold;
  if (typeof value !== "number" || Number.isNaN(value)) {
    return { error: "similarityThreshold must be a number" };
  }
  if (value < 0.45 || value > 0.95) {
    return { error: "similarityThreshold must be between 0.45 and 0.95" };
  }

  return { similarityThreshold: Number(value.toFixed(2)) };
}

export async function updateWorkspaceRetrievalConfig(
  prisma: PrismaClient,
  workspaceId: string,
  patch: { similarityThreshold: number },
): Promise<WorkspaceRetrievalConfigView | null> {
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) return null;

  const config = workspace.config as Record<string, unknown>;
  const retrieval = (config.retrieval ?? {}) as Record<string, unknown>;
  const runtime = (retrieval.runtime ?? {}) as Record<string, unknown>;
  const vector = (runtime.vector ?? {}) as Record<string, unknown>;

  const nextConfig = {
    ...config,
    retrieval: {
      ...retrieval,
      runtime: {
        ...runtime,
        vector: {
          ...vector,
          similarityThreshold: patch.similarityThreshold,
        },
      },
    },
  };

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { config: nextConfig as Prisma.InputJsonValue },
  });

  return getWorkspaceRetrievalRuntimeConfig(prisma, workspaceId);
}

export async function buildRetrievalHeatmap(
  prisma: PrismaClient,
  workspaceId: string,
  limit = 100,
): Promise<RetrievalHeatmapEntry[]> {
  const ops = await prisma.retrievalOperation.findMany({
    where: { workspaceId, status: "completed" },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const stats = new Map<
    string,
    { count: number; rankSum: number; scoreSum: number }
  >();

  for (const op of ops) {
    const result = op.result as unknown as StoredRetrievalResult | null;
    const pkg = result?.contextPackage;
    if (!pkg) continue;

    for (const trace of pkg.chunkTraces ?? []) {
      if (trace.tokenBudgetDecision !== "included") continue;
      const existing = stats.get(trace.memoryId) ?? {
        count: 0,
        rankSum: 0,
        scoreSum: 0,
      };
      existing.count += 1;
      existing.rankSum += trace.rankingRank;
      existing.scoreSum += trace.finalScore;
      stats.set(trace.memoryId, existing);
    }
  }

  return [...stats.entries()]
    .map(([memoryId, s]) => ({
      memoryId,
      accessCount: s.count,
      averageRank: s.count > 0 ? s.rankSum / s.count : 0,
      averageScore: s.count > 0 ? s.scoreSum / s.count : 0,
    }))
    .sort((a, b) => b.accessCount - a.accessCount);
}

export function parseRetrievalBody(body: unknown): RetrievalQuery | { error: string } {
  if (!body || typeof body !== "object") {
    return { error: "Request body required" };
  }

  const b = body as Record<string, unknown>;
  const workspaceId = b.workspaceId ?? b.workspace_id;
  const query = b.query;
  const tokenBudget = b.tokenBudget ?? b.token_budget;
  const retrievalMode = b.retrievalMode ?? b.retrieval_mode ?? "precision";

  if (typeof workspaceId !== "string" || !workspaceId) {
    return { error: "workspaceId is required" };
  }
  if (typeof query !== "string" || !query.trim()) {
    return { error: "query is required" };
  }
  if (typeof tokenBudget !== "number" || tokenBudget <= 0) {
    return { error: "tokenBudget must be a positive number" };
  }
  if (
    retrievalMode !== "precision" &&
    retrievalMode !== "expanded" &&
    retrievalMode !== "exploratory" &&
    retrievalMode !== "incident-response"
  ) {
    return {
      error: 'retrievalMode must be "precision", "expanded", "exploratory", or "incident-response"',
    };
  }

  const parsed: RetrievalQuery = {
    workspaceId,
    query: query.trim(),
    tokenBudget,
    retrievalMode,
  };

  const planId = b.planId ?? b.plan_id;
  if (typeof planId === "string" && planId) {
    parsed.planId = planId;
  }

  if (Array.isArray(b.memoryTypes)) {
    parsed.memoryTypes = b.memoryTypes.filter((t): t is string => typeof t === "string");
  } else if (Array.isArray(b.memory_types)) {
    parsed.memoryTypes = b.memory_types.filter((t): t is string => typeof t === "string");
  }

  const timeframe = (b.timeframe ?? b.time_frame) as Record<string, unknown> | undefined;
  if (timeframe && typeof timeframe === "object") {
    parsed.timeframe = {
      ...(typeof timeframe.start === "string" ? { start: timeframe.start } : {}),
      ...(typeof timeframe.end === "string" ? { end: timeframe.end } : {}),
    };
  }

  return parsed;
}
