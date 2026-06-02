import type { PrismaClient } from "@prisma/client";
import type { EventEmitter } from "@memory-middleware/observability";
import {
  buildAdjacencyView,
  type ChunkWithLineage,
} from "@memory-middleware/structural";
import { buildStructureView } from "@memory-middleware/retrieval";
import {
  buildEvolutionView,
  createInitialEvolution,
  evolutionFromScoring,
  prepareArchive,
  reinforceMemory,
  scoringFromEvolution,
  updateDecay,
  type EvolutionState,
} from "@memory-middleware/scoring";
import type {
  CanonicalMemoryScoring,
  MemoryAdjacencyView,
  MemoryEvolutionView,
  MemoryReinforceResponse,
  MemoryStructureView,
} from "@memory-middleware/shared-types";
import {
  DEFAULT_EVOLUTION_CONFIG,
  EVOLUTION_EVENT_TYPES,
} from "@memory-middleware/shared-types";
import { mapChunkRow, mapMemoryRow } from "./memory-mapper.js";
import {
  emitArchivalTransitioned,
  emitDecayUpdated,
  emitReinforcementUpdated,
} from "@memory-middleware/structural";

function loadEvolutionState(metadata: Record<string, unknown>, scoring: CanonicalMemoryScoring): EvolutionState {
  const stored = metadata.evolutionState as EvolutionState | undefined;
  if (stored) return stored;

  return {
    evolution: evolutionFromScoring(scoring, metadata),
    history: (metadata.evolutionHistory as EvolutionState["history"]) ?? [],
  };
}

async function persistEvolutionState(
  prisma: PrismaClient,
  memoryId: string,
  scoring: CanonicalMemoryScoring,
  state: EvolutionState,
): Promise<void> {
  const memory = await prisma.memory.findUnique({ where: { id: memoryId } });
  if (!memory) return;

  const metadata = (memory.metadata ?? {}) as Record<string, unknown>;

  await prisma.memory.update({
    where: { id: memoryId },
    data: {
      scoring: scoring as object,
      metadata: JSON.parse(
        JSON.stringify({
          ...metadata,
          evolution: state.evolution,
          evolutionState: state,
          evolutionHistory: state.history.slice(-50),
        }),
      ) as object,
      updatedAt: new Date(),
    },
  });
}

export async function getMemoryStructure(
  prisma: PrismaClient,
  memoryId: string,
): Promise<MemoryStructureView | { error: string; status: number }> {
  const memory = await prisma.memory.findUnique({
    where: { id: memoryId },
    include: { chunks: { orderBy: { sequence: "asc" } } },
  });

  if (!memory) return { error: "Memory not found", status: 404 };

  const mapped = mapMemoryRow(memory, memory.chunks);
  const structural = (memory.metadata as Record<string, unknown>).structural as
    | { fallbackUsed?: boolean; fallbackReason?: string }
    | undefined;

  return buildStructureView(
    memoryId,
    mapped.chunks.map((c) => ({
      id: c.id,
      chunkIndex: c.chunkIndex,
      content: c.content,
      tokenCount: c.tokenCount,
      ...(c.semanticDensityScore !== undefined
        ? { semanticDensityScore: c.semanticDensityScore }
        : {}),
      metadata: c.metadata as unknown as Record<string, unknown>,
    })),
    structural?.fallbackUsed,
    structural?.fallbackReason,
  );
}

export async function getMemoryEvolution(
  prisma: PrismaClient,
  memoryId: string,
): Promise<MemoryEvolutionView | { error: string; status: number }> {
  const memory = await prisma.memory.findUnique({ where: { id: memoryId } });
  if (!memory) return { error: "Memory not found", status: 404 };

  const scoring = memory.scoring as unknown as CanonicalMemoryScoring;
  const metadata = (memory.metadata ?? {}) as Record<string, unknown>;
  const state = loadEvolutionState(metadata, scoring);

  const decayed = updateDecay(state);
  if (decayed.evolution.recencyScore !== state.evolution.recencyScore) {
    const updatedScoring = scoringFromEvolution(scoring, decayed.evolution);
    await persistEvolutionState(prisma, memoryId, updatedScoring, decayed);
  }

  return buildEvolutionView(memoryId, scoring, decayed);
}

export async function getMemoryAdjacency(
  prisma: PrismaClient,
  memoryId: string,
): Promise<MemoryAdjacencyView | { error: string; status: number }> {
  const memory = await prisma.memory.findUnique({
    where: { id: memoryId },
    include: { chunks: { orderBy: { sequence: "asc" } } },
  });

  if (!memory) return { error: "Memory not found", status: 404 };

  const chunks: ChunkWithLineage[] = memory.chunks.map((row) => {
    const mapped = mapChunkRow(row);
    const lineage = mapped.metadata.lineage ?? {
      sectionPath: [],
      headingHierarchy: [],
    };

    return {
      id: mapped.id,
      chunkIndex: mapped.chunkIndex,
      content: mapped.content,
      tokenCount: mapped.tokenCount,
      lineage,
      segmentationReason: mapped.metadata.segmentationReason ?? {
        chunkIndex: mapped.chunkIndex,
        strategy: mapped.metadata.chunkingStrategy,
        headingInheritance: lineage.headingHierarchy,
        boundaryReason: "unknown",
        preservedBulletGroup: false,
      },
    };
  });

  return buildAdjacencyView(memoryId, chunks);
}

export async function reinforceMemoryRecord(
  prisma: PrismaClient,
  events: EventEmitter,
  memoryId: string,
  contextualUsefulness?: number,
  reason = "explicit_reinforce",
): Promise<MemoryReinforceResponse | { error: string; status: number }> {
  const memory = await prisma.memory.findUnique({ where: { id: memoryId } });
  if (!memory) return { error: "Memory not found", status: 404 };
  if (memory.archived) return { error: "Cannot reinforce archived memory", status: 409 };

  const scoring = memory.scoring as unknown as CanonicalMemoryScoring;
  const metadata = (memory.metadata ?? {}) as Record<string, unknown>;
  const state = loadEvolutionState(metadata, scoring);

  const result = reinforceMemory(state, contextualUsefulness);
  const updatedScoring = scoringFromEvolution(scoring, result.state.evolution);

  await persistEvolutionState(prisma, memoryId, updatedScoring, result.state);

  await emitReinforcementUpdated(events, {
    traceId: memory.ingestionTraceId,
    workspaceId: memory.workspaceId,
    memoryId,
    delta: result.delta,
    reason: `${reason}: ${result.reason}`,
  });

  return {
    memoryId,
    evolution: result.state.evolution,
    reinforcementDelta: result.delta,
    message: result.reason,
  };
}

export async function recordRetrievalForMemories(
  prisma: PrismaClient,
  events: EventEmitter,
  memoryIds: string[],
  traceId: string,
  workspaceId: string,
): Promise<void> {
  for (const memoryId of [...new Set(memoryIds)]) {
    const memory = await prisma.memory.findUnique({ where: { id: memoryId } });
    if (!memory || memory.archived) continue;

    const scoring = memory.scoring as unknown as CanonicalMemoryScoring;
    const metadata = (memory.metadata ?? {}) as Record<string, unknown>;
    const state = loadEvolutionState(metadata, scoring);

    const updated = reinforceMemory(state, 0.5);
    const updatedScoring = scoringFromEvolution(scoring, updated.state.evolution);
    await persistEvolutionState(prisma, memoryId, updatedScoring, updated.state);

    await emitReinforcementUpdated(events, {
      traceId,
      workspaceId,
      memoryId,
      delta: updated.delta,
      reason: "successful retrieval reinforcement",
    });
  }
}

export async function evaluateAndArchiveEligible(
  prisma: PrismaClient,
  events: EventEmitter,
  memoryId: string,
  reason = "lifecycle_archive",
): Promise<{ archived: boolean; reason: string } | { error: string; status: number }> {
  const memory = await prisma.memory.findUnique({ where: { id: memoryId } });
  if (!memory) return { error: "Memory not found", status: 404 };

  const scoring = memory.scoring as unknown as CanonicalMemoryScoring;
  const metadata = (memory.metadata ?? {}) as Record<string, unknown>;
  let state = loadEvolutionState(metadata, scoring);
  state = updateDecay(state);

  if (!state.evolution.archivalEligible) {
    return { archived: false, reason: "memory not archival eligible" };
  }

  state = prepareArchive(state, reason);
  const updatedScoring = scoringFromEvolution(scoring, state.evolution);
  await persistEvolutionState(prisma, memoryId, updatedScoring, state);

  const archivedAt = new Date();
  await prisma.memory.update({
    where: { id: memoryId },
    data: {
      archived: true,
      archivedAt,
      retrievalEligible: false,
      ingestionStatus: "archived",
      observability: {
        ...(memory.observability as object),
        archived: true,
        retrievalEligible: false,
        archiveReason: reason,
      },
    },
  });

  await emitArchivalTransitioned(events, {
    traceId: memory.ingestionTraceId,
    workspaceId: memory.workspaceId,
    memoryId,
    reason,
  });

  await emitDecayUpdated(events, {
    traceId: memory.ingestionTraceId,
    workspaceId: memory.workspaceId,
    memoryId,
    extra: { archival_score: state.evolution.archivalScore },
  });

  return { archived: true, reason };
}

export { DEFAULT_EVOLUTION_CONFIG, EVOLUTION_EVENT_TYPES, createInitialEvolution };
