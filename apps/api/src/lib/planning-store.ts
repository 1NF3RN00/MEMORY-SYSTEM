import { Prisma, type PrismaClient } from "@prisma/client";
import type {
  PlanningBenchmarkRequest,
  PlanningReplayInput,
  PlanningRequest,
  PlanningRetrievalMode,
  PlanningStageRecord,
  PlanningTuningRequest,
  RetrievalPlan,
} from "@memory-middleware/shared-types";

const VALID_MODES: PlanningRetrievalMode[] = [
  "precision",
  "expanded",
  "exploratory",
  "incident-response",
];

export interface StoredRetrievalPlan {
  plan: RetrievalPlan;
  replayInput: PlanningReplayInput;
  stages: PlanningStageRecord[];
  status: string;
}

export function parsePlanningBody(body: unknown): PlanningRequest | { error: string } {
  if (!body || typeof body !== "object") {
    return { error: "Request body required" };
  }

  const b = body as Record<string, unknown>;
  const workspaceId = b.workspaceId ?? b.workspace_id;
  const query = b.query;
  const retrievalMode = (b.retrievalMode ?? b.retrieval_mode ?? "precision") as string;

  if (typeof workspaceId !== "string" || !workspaceId) {
    return { error: "workspaceId is required" };
  }
  if (typeof query !== "string" || !query.trim()) {
    return { error: "query is required" };
  }
  if (!VALID_MODES.includes(retrievalMode as PlanningRetrievalMode)) {
    return {
      error: `retrievalMode must be one of: ${VALID_MODES.join(", ")}`,
    };
  }

  return {
    workspaceId,
    query: query.trim(),
    retrievalMode: retrievalMode as PlanningRetrievalMode,
  };
}

export async function createRetrievalPlanRecord(
  prisma: PrismaClient,
  input: {
    planId: string;
    workspaceId: string;
    query: string;
    retrievalMode: PlanningRetrievalMode;
    plan: RetrievalPlan;
    replayInput: PlanningReplayInput;
    stages: PlanningStageRecord[];
    status?: string;
  },
): Promise<void> {
  await prisma.retrievalPlan.create({
    data: {
      planId: input.planId,
      workspaceId: input.workspaceId,
      query: input.query,
      retrievalMode: input.retrievalMode,
      status: input.status ?? "completed",
      plan: JSON.parse(JSON.stringify(input.plan)) as Prisma.InputJsonValue,
      replayInput: JSON.parse(JSON.stringify(input.replayInput)) as Prisma.InputJsonValue,
      stages: JSON.parse(JSON.stringify(input.stages)) as Prisma.InputJsonValue,
    },
  });
}

export async function getRetrievalPlan(
  prisma: PrismaClient,
  planId: string,
): Promise<StoredRetrievalPlan | null> {
  const record = await prisma.retrievalPlan.findUnique({
    where: { planId },
  });

  if (!record) return null;

  return {
    plan: record.plan as unknown as RetrievalPlan,
    replayInput: record.replayInput as unknown as PlanningReplayInput,
    stages: (record.stages ?? []) as unknown as PlanningStageRecord[],
    status: record.status,
  };
}

export async function listRetrievalPlans(
  prisma: PrismaClient,
  workspaceId: string,
  limit = 50,
): Promise<
  Array<{
    planId: string;
    workspaceId: string;
    query: string;
    retrievalMode: string;
    status: string;
    createdAt: string;
  }>
> {
  const records = await prisma.retrievalPlan.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 100),
    select: {
      planId: true,
      workspaceId: true,
      query: true,
      retrievalMode: true,
      status: true,
      createdAt: true,
    },
  });

  return records.map((r) => ({
    planId: r.planId,
    workspaceId: r.workspaceId,
    query: r.query,
    retrievalMode: r.retrievalMode,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function loadWorkspacePlanningContext(
  prisma: PrismaClient,
  workspaceId: string,
): Promise<{
  memoryTags: string[];
  memoryTypes: string[];
  relationships: Array<{
    sourceMemoryId: string;
    targetMemoryId: string;
    relationshipType: string;
    weight: number;
  }>;
}> {
  const [memories, relationships] = await Promise.all([
    prisma.memory.findMany({
      where: { workspaceId, archived: false, retrievalEligible: true },
      select: { memoryType: true, metadata: true },
      take: 500,
    }),
    prisma.memoryRelationship.findMany({
      where: { workspaceId },
      select: {
        sourceMemoryId: true,
        targetMemoryId: true,
        relationshipType: true,
        weight: true,
      },
      take: 500,
    }),
  ]);

  const tagSet = new Set<string>();
  const typeSet = new Set<string>();

  for (const memory of memories) {
    typeSet.add(memory.memoryType);
    const metadata = (memory.metadata ?? {}) as Record<string, unknown>;
    const tags = metadata.tags as string[] | undefined;
    if (tags) {
      for (const tag of tags) tagSet.add(tag);
    }
  }

  return {
    memoryTags: [...tagSet].sort(),
    memoryTypes: [...typeSet].sort(),
    relationships: relationships.map((r) => ({
      sourceMemoryId: r.sourceMemoryId,
      targetMemoryId: r.targetMemoryId,
      relationshipType: r.relationshipType,
      weight: r.weight,
    })),
  };
}

export function parsePlanningTuningBody(body: unknown): PlanningTuningRequest | { error: string } {
  const base = parsePlanningBody(body);
  if ("error" in base) return base;
  return { workspaceId: base.workspaceId, query: base.query };
}

export function parsePlanningBenchmarkBody(
  body: unknown,
): PlanningBenchmarkRequest | { error: string } {
  if (!body || typeof body !== "object") {
    return { error: "Request body required" };
  }

  const b = body as Record<string, unknown>;
  const workspaceId = b.workspaceId ?? b.workspace_id;
  const query = b.query;
  const retrievalMode = (b.retrievalMode ?? b.retrieval_mode) as string | undefined;
  const planId = (b.planId ?? b.plan_id) as string | undefined;

  if (typeof workspaceId !== "string" || !workspaceId) {
    return { error: "workspaceId is required" };
  }
  if (typeof query !== "string" || !query.trim()) {
    return { error: "query is required" };
  }

  const parsed: PlanningBenchmarkRequest = {
    workspaceId,
    query: query.trim(),
  };

  if (retrievalMode && VALID_MODES.includes(retrievalMode as PlanningRetrievalMode)) {
    parsed.retrievalMode = retrievalMode as PlanningRetrievalMode;
  }
  if (typeof planId === "string" && planId) {
    parsed.planId = planId;
  }

  return parsed;
}
