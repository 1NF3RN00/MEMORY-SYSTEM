import { Prisma, type PrismaClient } from "@prisma/client";
import type {
  ContextPackageInput,
  ContextRenderStageRecord,
  ContextRenderTraceView,
  DeliveryContext,
  DeliveryMode,
  RenderingDecisions,
} from "@memory-middleware/shared-types";
import { DEFAULT_DELIVERY_MODE } from "@memory-middleware/shared-types";
import { getCompressionTrace } from "./compression-store.js";
import { getRetrievalTrace } from "./retrieval-store.js";

export interface StoredContextRenderResult {
  retrievalTraceId: string;
  compressionTraceId?: string;
  mode: DeliveryMode;
  stages: ContextRenderStageRecord[];
  originalContextPackage?: ContextPackageInput;
  deliveryContext?: DeliveryContext;
  renderingDecisions?: RenderingDecisions;
  error?: string;
}

export interface ParsedContextRenderBody {
  workspaceId: string;
  retrievalTraceId?: string;
  compressionTraceId?: string;
  mode?: DeliveryMode;
}

export function parseContextRenderBody(body: unknown): ParsedContextRenderBody | { error: string } {
  if (!body || typeof body !== "object") {
    return { error: "Request body required" };
  }

  const record = body as Record<string, unknown>;
  const workspaceId = record.workspaceId;
  if (typeof workspaceId !== "string" || workspaceId.length === 0) {
    return { error: "workspaceId is required" };
  }

  const mode = record.mode;
  if (
    mode !== undefined &&
    mode !== "concise" &&
    mode !== "balanced" &&
    mode !== "detailed" &&
    mode !== "operational"
  ) {
    return { error: "mode must be concise, balanced, detailed, or operational" };
  }

  return {
    workspaceId,
    ...(typeof record.retrievalTraceId === "string"
      ? { retrievalTraceId: record.retrievalTraceId }
      : {}),
    ...(typeof record.compressionTraceId === "string"
      ? { compressionTraceId: record.compressionTraceId }
      : {}),
    ...(mode ? { mode } : {}),
  };
}

export async function createContextRenderOperation(
  prisma: PrismaClient,
  input: {
    workspaceId: string;
    deliveryId: string;
    retrievalTraceId: string;
    compressionTraceId?: string;
    mode: DeliveryMode;
  },
): Promise<void> {
  await prisma.contextRenderOperation.create({
    data: {
      workspaceId: input.workspaceId,
      deliveryId: input.deliveryId,
      retrievalTraceId: input.retrievalTraceId,
      ...(input.compressionTraceId ? { compressionTraceId: input.compressionTraceId } : {}),
      status: "processing",
      result: {
        retrievalTraceId: input.retrievalTraceId,
        compressionTraceId: input.compressionTraceId,
        mode: input.mode,
        stages: [],
      } as Prisma.InputJsonValue,
    },
  });
}

export async function completeContextRenderOperation(
  prisma: PrismaClient,
  deliveryId: string,
  stored: StoredContextRenderResult,
  status: "completed" | "failed",
): Promise<void> {
  await prisma.contextRenderOperation.updateMany({
    where: { deliveryId },
    data: {
      status,
      completedAt: new Date(),
      result: JSON.parse(JSON.stringify(stored)) as Prisma.InputJsonValue,
    },
  });
}

export async function resolveContextPackageForRender(
  prisma: PrismaClient,
  parsed: ParsedContextRenderBody,
): Promise<
  | {
      contextPackage: ContextPackageInput;
      retrievalTraceId: string;
      compressionTraceId?: string;
    }
  | { error: string }
> {
  if (parsed.compressionTraceId) {
    const compression = await getCompressionTrace(prisma, parsed.compressionTraceId);
    if (!compression) {
      return { error: "Compression trace not found" };
    }
    if (compression.status !== "completed" || !compression.optimizedContextPackage) {
      return { error: "Compression trace has no optimized context package" };
    }
    return {
      contextPackage: compression.optimizedContextPackage,
      retrievalTraceId: compression.retrievalTraceId,
      compressionTraceId: parsed.compressionTraceId,
    };
  }

  const retrievalTraceId = parsed.retrievalTraceId;
  if (!retrievalTraceId) {
    return { error: "retrievalTraceId or compressionTraceId is required" };
  }

  const retrieval = await getRetrievalTrace(prisma, retrievalTraceId);
  if (!retrieval) {
    return { error: "Retrieval trace not found" };
  }
  if (retrieval.status !== "completed" || !retrieval.contextPackage) {
    return { error: "Retrieval trace has no context package" };
  }

  return {
    contextPackage: retrieval.contextPackage,
    retrievalTraceId,
  };
}

export async function getContextRenderTrace(
  prisma: PrismaClient,
  deliveryId: string,
): Promise<ContextRenderTraceView | null> {
  const op = await prisma.contextRenderOperation.findFirst({
    where: { deliveryId },
    orderBy: { createdAt: "desc" },
  });

  if (!op) return null;

  const result = (op.result ?? {}) as unknown as StoredContextRenderResult;

  return {
    deliveryId: op.deliveryId,
    workspaceId: op.workspaceId,
    retrievalTraceId: op.retrievalTraceId,
    ...(op.compressionTraceId ? { compressionTraceId: op.compressionTraceId } : {}),
    status: op.status as ContextRenderTraceView["status"],
    mode: result.mode ?? DEFAULT_DELIVERY_MODE,
    stages: result.stages ?? [],
    ...(result.originalContextPackage
      ? { originalContextPackage: result.originalContextPackage }
      : {}),
    ...(result.deliveryContext ? { deliveryContext: result.deliveryContext } : {}),
    ...(result.renderingDecisions ? { renderingDecisions: result.renderingDecisions } : {}),
    ...(result.error ? { error: result.error } : {}),
    createdAt: op.createdAt.toISOString(),
    ...(op.completedAt ? { completedAt: op.completedAt.toISOString() } : {}),
  };
}

export async function listContextRenderTraces(
  prisma: PrismaClient,
  workspaceId?: string,
  limit = 50,
): Promise<
  Array<{
    deliveryId: string;
    workspaceId: string;
    retrievalTraceId: string;
    compressionTraceId?: string;
    status: string;
    mode: DeliveryMode;
    tokenCount?: number;
    createdAt: string;
    completedAt?: string;
  }>
> {
  const ops = await prisma.contextRenderOperation.findMany({
    ...(workspaceId ? { where: { workspaceId } } : {}),
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 100),
  });

  return ops.map((op) => {
    const result = (op.result ?? {}) as unknown as StoredContextRenderResult;
    return {
      deliveryId: op.deliveryId,
      workspaceId: op.workspaceId,
      retrievalTraceId: op.retrievalTraceId,
      ...(op.compressionTraceId ? { compressionTraceId: op.compressionTraceId } : {}),
      status: op.status,
      mode: result.mode ?? DEFAULT_DELIVERY_MODE,
      ...(result.deliveryContext ? { tokenCount: result.deliveryContext.tokenCount } : {}),
      createdAt: op.createdAt.toISOString(),
      ...(op.completedAt ? { completedAt: op.completedAt.toISOString() } : {}),
    };
  });
}

export async function getDeliveryArtifactsForTrace(
  prisma: PrismaClient,
  retrievalTraceId: string,
): Promise<
  Array<{
    deliveryId: string;
    retrievalTraceId: string;
    compressionTraceId?: string;
    mode: DeliveryMode;
    deliveryContext: DeliveryContext;
    renderingDecisions: RenderingDecisions;
    stages: ContextRenderStageRecord[];
  }>
> {
  const ops = await prisma.contextRenderOperation.findMany({
    where: { retrievalTraceId, status: "completed" },
    orderBy: { createdAt: "asc" },
  });

  return ops
    .map((op) => {
      const result = (op.result ?? {}) as unknown as StoredContextRenderResult;
      if (!result.deliveryContext || !result.renderingDecisions) return null;
      return {
        deliveryId: op.deliveryId,
        retrievalTraceId: op.retrievalTraceId,
        ...(op.compressionTraceId ? { compressionTraceId: op.compressionTraceId } : {}),
        mode: result.mode ?? DEFAULT_DELIVERY_MODE,
        deliveryContext: result.deliveryContext,
        renderingDecisions: result.renderingDecisions,
        stages: result.stages ?? [],
      };
    })
    .filter((a): a is NonNullable<typeof a> => a !== null);
}
