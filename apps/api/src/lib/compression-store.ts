import { Prisma, type PrismaClient } from "@prisma/client";
import type {
  CompressionContextResolveError,
  CompressionRequest,
  CompressionStageRecord,
  CompressionStageTrace,
  CompressionTraceSummaryView,
  CompressionTraceView,
  ContextPackage,
  FidelityMode,
  FidelityReport,
  MergeDecision,
  MemoryRelationship,
  MemoryRelationshipView,
  OptimizedContextPackage,
  TrimmingDecision,
  WorkspaceConfig,
} from "@memory-middleware/shared-types";
import {
  DEFAULT_COMPRESSION_FIDELITY,
  DEFAULT_NUANCE_PRESERVATION,
  DEFAULT_TOKEN_OPTIMIZATION,
} from "@memory-middleware/shared-types";
import { recordCompressionMetrics } from "./metrics-aggregation-store.js";
import { getRetrievalTrace } from "./retrieval-store.js";

export interface StoredCompressionResult {
  retrievalTraceId: string;
  fidelityMode: FidelityMode;
  nuancePreservation: number;
  tokenOptimization: number;
  targetTokenBudget?: number;
  stages: CompressionStageRecord[];
  stageTraces: CompressionStageTrace[];
  originalContextPackage?: ContextPackage;
  optimizedContextPackage?: OptimizedContextPackage;
  fidelityReport?: FidelityReport;
  mergeDecisions?: MergeDecision[];
  trimmingDecisions?: TrimmingDecision[];
  error?: string;
}

export async function createCompressionOperation(
  prisma: PrismaClient,
  input: {
    workspaceId: string;
    traceId: string;
    retrievalTraceId: string;
    fidelityMode: FidelityMode;
    nuancePreservation: number;
    tokenOptimization: number;
    targetTokenBudget?: number;
  },
): Promise<void> {
  await prisma.compressionOperation.create({
    data: {
      workspaceId: input.workspaceId,
      traceId: input.traceId,
      retrievalTraceId: input.retrievalTraceId,
      status: "processing",
      result: {
        retrievalTraceId: input.retrievalTraceId,
        fidelityMode: input.fidelityMode,
        nuancePreservation: input.nuancePreservation,
        tokenOptimization: input.tokenOptimization,
        targetTokenBudget: input.targetTokenBudget,
        stages: [],
        stageTraces: [],
      } as Prisma.InputJsonValue,
    },
  });
}

export async function completeCompressionOperation(
  prisma: PrismaClient,
  traceId: string,
  stored: StoredCompressionResult,
  status: "completed" | "failed",
): Promise<void> {
  const op = await prisma.compressionOperation.findFirst({
    where: { traceId },
    orderBy: { createdAt: "desc" },
    select: { workspaceId: true },
  });

  await prisma.compressionOperation.updateMany({
    where: { traceId },
    data: {
      status,
      completedAt: new Date(),
      result: JSON.parse(JSON.stringify(stored)) as Prisma.InputJsonValue,
    },
  });

  if (op) {
    await recordCompressionMetrics(prisma, op.workspaceId, status);
  }
}

export async function getCompressionTrace(
  prisma: PrismaClient,
  traceId: string,
): Promise<CompressionTraceView | null> {
  const op = await prisma.compressionOperation.findFirst({
    where: { traceId },
    orderBy: { createdAt: "desc" },
  });

  if (!op) return null;

  const result = (op.result ?? {}) as unknown as StoredCompressionResult;

  return {
    compressionTraceId: op.traceId,
    workspaceId: op.workspaceId,
    retrievalTraceId: op.retrievalTraceId,
    status: op.status as CompressionTraceView["status"],
    fidelityMode: result.fidelityMode ?? DEFAULT_COMPRESSION_FIDELITY,
    nuancePreservation: result.nuancePreservation ?? DEFAULT_NUANCE_PRESERVATION,
    tokenOptimization: result.tokenOptimization ?? DEFAULT_TOKEN_OPTIMIZATION,
    ...(result.targetTokenBudget !== undefined
      ? { targetTokenBudget: result.targetTokenBudget }
      : {}),
    stages: result.stages ?? [],
    stageTraces: result.stageTraces ?? [],
    ...(result.originalContextPackage
      ? { originalContextPackage: result.originalContextPackage }
      : {}),
    ...(result.optimizedContextPackage
      ? { optimizedContextPackage: result.optimizedContextPackage }
      : {}),
    ...(result.fidelityReport ? { fidelityReport: result.fidelityReport } : {}),
    ...(result.mergeDecisions ? { mergeDecisions: result.mergeDecisions } : {}),
    ...(result.trimmingDecisions ? { trimmingDecisions: result.trimmingDecisions } : {}),
    ...(result.error ? { error: result.error } : {}),
    createdAt: op.createdAt.toISOString(),
    ...(op.completedAt ? { completedAt: op.completedAt.toISOString() } : {}),
  };
}

export async function getCompressionTraceSummary(
  prisma: PrismaClient,
  traceId: string,
): Promise<CompressionTraceSummaryView | null> {
  const op = await prisma.compressionOperation.findFirst({
    where: { traceId },
    orderBy: { createdAt: "desc" },
  });

  if (!op) return null;

  const result = (op.result ?? {}) as unknown as StoredCompressionResult;
  const meta = result.optimizedContextPackage?.compressionMetadata;

  return {
    compressionTraceId: op.traceId,
    workspaceId: op.workspaceId,
    retrievalTraceId: op.retrievalTraceId,
    status: op.status as CompressionTraceSummaryView["status"],
    fidelityMode: result.fidelityMode ?? DEFAULT_COMPRESSION_FIDELITY,
    nuancePreservation: result.nuancePreservation ?? DEFAULT_NUANCE_PRESERVATION,
    tokenOptimization: result.tokenOptimization ?? DEFAULT_TOKEN_OPTIMIZATION,
    ...(result.targetTokenBudget !== undefined
      ? { targetTokenBudget: result.targetTokenBudget }
      : {}),
    createdAt: op.createdAt.toISOString(),
    ...(op.completedAt ? { completedAt: op.completedAt.toISOString() } : {}),
    ...(meta
      ? {
          compressionMetadata: {
            originalTokens: meta.originalTokens,
            optimizedTokens: meta.optimizedTokens,
            tokenSavings: meta.tokenSavings,
            fidelityScore: meta.fidelityScore,
          },
        }
      : {}),
    ...(result.fidelityReport
      ? { fidelityReport: { fidelityScore: result.fidelityReport.fidelityScore } }
      : {}),
    mergeCount: result.mergeDecisions?.length ?? 0,
    trimCount: result.trimmingDecisions?.length ?? 0,
    ...(result.error ? { error: result.error } : {}),
  };
}

export async function listCompressionTraces(
  prisma: PrismaClient,
  workspaceId?: string,
  limit = 50,
): Promise<
  Array<{
    compressionTraceId: string;
    workspaceId: string;
    retrievalTraceId: string;
    status: string;
    fidelityMode: FidelityMode;
    createdAt: string;
    completedAt?: string;
  }>
> {
  const ops = await prisma.compressionOperation.findMany({
    ...(workspaceId ? { where: { workspaceId } } : {}),
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 100),
  });

  return ops.map((op) => {
    const result = (op.result ?? {}) as unknown as StoredCompressionResult;
    return {
      compressionTraceId: op.traceId,
      workspaceId: op.workspaceId,
      retrievalTraceId: op.retrievalTraceId,
      status: op.status,
      fidelityMode: result.fidelityMode ?? DEFAULT_COMPRESSION_FIDELITY,
      createdAt: op.createdAt.toISOString(),
      ...(op.completedAt ? { completedAt: op.completedAt.toISOString() } : {}),
    };
  });
}

export async function getWorkspaceCompressionConfig(
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
    compression: config.compression ?? {
      default_fidelity_mode: DEFAULT_COMPRESSION_FIDELITY,
      default_nuance_preservation: DEFAULT_NUANCE_PRESERVATION,
      default_token_optimization: DEFAULT_TOKEN_OPTIMIZATION,
    },
    observability: config.observability ?? {
      trace_enabled: true,
      event_logging_enabled: true,
    },
  };
}

export async function persistRelationships(
  prisma: PrismaClient,
  workspaceId: string,
  compressionTraceId: string,
  relationships: MemoryRelationship[],
): Promise<void> {
  for (const rel of relationships) {
    await prisma.memoryRelationship.upsert({
      where: {
        workspaceId_sourceMemoryId_targetMemoryId_relationshipType: {
          workspaceId,
          sourceMemoryId: rel.sourceMemoryId,
          targetMemoryId: rel.targetMemoryId,
          relationshipType: rel.relationshipType,
        },
      },
      create: {
        workspaceId,
        sourceMemoryId: rel.sourceMemoryId,
        targetMemoryId: rel.targetMemoryId,
        relationshipType: rel.relationshipType,
        weight: rel.weight,
        metadata: (rel.metadata ?? {}) as Prisma.InputJsonValue,
        compressionTraceId,
      },
      update: {
        weight: rel.weight,
        metadata: (rel.metadata ?? {}) as Prisma.InputJsonValue,
        compressionTraceId,
      },
    });
  }
}

export async function getMemoryRelationships(
  prisma: PrismaClient,
  memoryId: string,
  workspaceId?: string,
): Promise<MemoryRelationshipView | null> {
  const memory = await prisma.memory.findUnique({
    where: { id: memoryId },
    include: {
      chunks: { orderBy: { sequence: "asc" } },
    },
  });

  if (!memory) return null;

  const stored = await prisma.memoryRelationship.findMany({
    where: {
      OR: [{ sourceMemoryId: memoryId }, { targetMemoryId: memoryId }],
      ...(workspaceId ? { workspaceId } : {}),
    },
    orderBy: { weight: "desc" },
  });

  const relationships: MemoryRelationship[] = stored.map((r) => ({
    sourceMemoryId: r.sourceMemoryId,
    targetMemoryId: r.targetMemoryId,
    relationshipType: r.relationshipType as MemoryRelationship["relationshipType"],
    weight: r.weight,
    metadata: r.metadata as Record<string, unknown>,
  }));

  const adjacencyHints = memory.chunks.flatMap((chunk, index) => {
    const next = memory.chunks[index + 1];
    if (!next) return [];
    return [
      {
        chunkId: chunk.id,
        adjacentChunkId: next.id,
        memoryId,
        weight: 0.9,
        hintType: "sequential" as const,
      },
    ];
  });

  if (relationships.length === 0) {
    return {
      memoryId,
      workspaceId: memory.workspaceId,
      relationships: [],
      adjacencyHints,
    };
  }

  return {
    memoryId,
    workspaceId: memory.workspaceId,
    relationships,
    adjacencyHints,
  };
}

export function parseCompressionBody(
  body: unknown,
): CompressionRequest | { error: string } {
  if (!body || typeof body !== "object") {
    return { error: "Request body required" };
  }

  const b = body as Record<string, unknown>;
  const workspaceId = b.workspaceId ?? b.workspace_id;
  const retrievalTraceId = b.retrievalTraceId ?? b.retrieval_trace_id;
  const contextPackage = b.contextPackage ?? b.context_package;
  const targetTokenBudget = b.targetTokenBudget ?? b.target_token_budget;
  const fidelityMode = b.fidelityMode ?? b.fidelity_mode ?? DEFAULT_COMPRESSION_FIDELITY;
  const nuancePreservation = b.nuancePreservation ?? b.nuance_preservation;
  const tokenOptimization = b.tokenOptimization ?? b.token_optimization;

  if (typeof workspaceId !== "string" || !workspaceId) {
    return { error: "workspaceId is required" };
  }

  if (
    fidelityMode !== "maximum_fidelity" &&
    fidelityMode !== "balanced" &&
    fidelityMode !== "aggressive"
  ) {
    return { error: 'fidelityMode must be "maximum_fidelity", "balanced", or "aggressive"' };
  }

  const parsed: CompressionRequest = {
    workspaceId,
    fidelityMode,
  };

  if (typeof retrievalTraceId === "string" && retrievalTraceId) {
    parsed.retrievalTraceId = retrievalTraceId;
  }

  if (contextPackage && typeof contextPackage === "object") {
    parsed.contextPackage = contextPackage as ContextPackage;
  }

  if (typeof targetTokenBudget === "number" && targetTokenBudget > 0) {
    parsed.targetTokenBudget = targetTokenBudget;
  }

  if (typeof nuancePreservation === "number") {
    parsed.nuancePreservation = Math.min(1, Math.max(0, nuancePreservation));
  }

  if (typeof tokenOptimization === "number") {
    parsed.tokenOptimization = Math.min(1, Math.max(0, tokenOptimization));
  }

  if (!parsed.contextPackage && !parsed.retrievalTraceId) {
    return { error: "contextPackage or retrievalTraceId is required" };
  }

  return parsed;
}

export function buildCompressionTraceIdMismatchError(
  compressionTraceId: string,
  retrievalTraceId: string,
): CompressionContextResolveError {
  return {
    error: `This is a compression trace ID, not a retrieval trace ID. Use retrieval trace ${retrievalTraceId} to compress again, or open /compression-traces/${compressionTraceId} to view the existing result.`,
    code: "compression_trace_id_provided",
    suppliedTraceId: compressionTraceId,
    compressionTraceId,
    retrievalTraceId,
  };
}

export async function resolveContextPackage(
  prisma: PrismaClient,
  request: CompressionRequest,
): Promise<ContextPackage | CompressionContextResolveError> {
  if (request.contextPackage) {
    return request.contextPackage;
  }

  if (!request.retrievalTraceId) {
    return {
      error: "contextPackage or retrievalTraceId is required",
      code: "retrieval_trace_not_found",
      suppliedTraceId: "",
    };
  }

  const traceId = request.retrievalTraceId.trim();
  const trace = await getRetrievalTrace(prisma, traceId);

  if (!trace?.contextPackage) {
    const compressionOp = await prisma.compressionOperation.findFirst({
      where: { traceId },
      orderBy: { createdAt: "desc" },
    });

    if (compressionOp) {
      return buildCompressionTraceIdMismatchError(traceId, compressionOp.retrievalTraceId);
    }

    if (trace && trace.status === "failed") {
      return {
        error:
          "Retrieval failed — no context package to compress. Run a successful retrieval first.",
        code: "retrieval_failed",
        suppliedTraceId: traceId,
        retrievalTraceId: traceId,
      };
    }

    if (trace && trace.status === "processing") {
      return {
        error:
          "Retrieval is still in progress. Wait for it to finish, then compress using the retrievalTraceId from the completed run.",
        code: "retrieval_incomplete",
        suppliedTraceId: traceId,
        retrievalTraceId: traceId,
      };
    }

    if (trace && !trace.contextPackage) {
      return {
        error:
          "Retrieval trace is marked completed but its context package was lost (known race condition in older runs). Re-run the retrieval query on Retrieval Traces, then compress the new trace.",
        code: "context_package_lost",
        suppliedTraceId: traceId,
        retrievalTraceId: traceId,
      };
    }

    return {
      error:
        "Retrieval trace not found. Run POST /retrieve first, then use the retrievalTraceId (not a compression trace ID).",
      code: "retrieval_trace_not_found",
      suppliedTraceId: traceId,
    };
  }

  if (trace.workspaceId !== request.workspaceId) {
    return {
      error: "Retrieval trace workspace mismatch",
      code: "workspace_mismatch",
      suppliedTraceId: traceId,
      retrievalTraceId: traceId,
    };
  }

  return trace.contextPackage;
}
