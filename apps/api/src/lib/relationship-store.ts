import { Prisma, type PrismaClient } from "@prisma/client";
import type {
  AdjacencyHint,
  AugmentationTraceView,
  ClusterView,
  EnhancedMemoryRelationship,
  EnhancedMemoryRelationshipView,
  MemoryRelationship,
  NeighborhoodView,
  RelationshipGenerationRequest,
  RelationshipGenerationResult,
  RelationshipType,
} from "@memory-middleware/shared-types";
import {
  appendEvolutionHistory,
  buildContentTokens,
  buildNeighborhood,
  buildOperationalClusters,
  computeConfidenceReasoning,
  createEvolutionEntry,
  generateRelationships,
  scoreRelationshipConfidence,
  type CoOccurrencePair,
} from "@memory-middleware/relationship";
import type { StoredRetrievalResult } from "./retrieval-store.js";
import { getRetrievalTrace } from "./retrieval-store.js";

function deriveDomain(memoryType: string, sourceType: string): string {
  if (memoryType && memoryType !== "generic") return memoryType;
  if (sourceType && sourceType !== "unknown") return sourceType;
  return "operational";
}

function extractTags(metadata: Record<string, unknown>): string[] {
  const tags = metadata.tags;
  if (Array.isArray(tags)) return tags.map(String);
  return [];
}

function parseEvolutionHistory(metadata: Record<string, unknown>) {
  const history = metadata.evolutionHistory;
  if (Array.isArray(history)) {
    return history as EnhancedMemoryRelationship["evolutionHistory"];
  }
  return [];
}

export function toEnhancedRelationship(row: {
  id: string;
  sourceMemoryId: string;
  targetMemoryId: string;
  relationshipType: string;
  weight: number;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
}): EnhancedMemoryRelationship {
  const metadata = (row.metadata ?? {}) as Record<string, unknown>;
  const relationshipType = row.relationshipType as RelationshipType;
  const confidenceReasoning = computeConfidenceReasoning({
    relationshipType,
    weight: row.weight,
    metadata,
  });
  const confidence = scoreRelationshipConfidence({
    relationshipType,
    weight: row.weight,
    metadata,
  });

  const generatedFrom = Array.isArray(metadata.generatedFrom)
    ? (metadata.generatedFrom as string[])
    : [relationshipType.replace(/_/g, " ")];

  return {
    relationshipId: row.id,
    sourceMemoryId: row.sourceMemoryId,
    targetMemoryId: row.targetMemoryId,
    relationshipType,
    confidence,
    weight: row.weight,
    generatedFrom,
    reinforcementScore: Number(metadata.reinforcementScore ?? 0),
    retrievalFrequency: Number(metadata.retrievalFrequency ?? 0),
    confidenceReasoning,
    evolutionHistory: parseEvolutionHistory(metadata),
    metadata,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getEnhancedMemoryRelationships(
  prisma: PrismaClient,
  memoryId: string,
  workspaceId?: string,
): Promise<EnhancedMemoryRelationshipView | null> {
  const memory = await prisma.memory.findUnique({
    where: { id: memoryId },
    include: { chunks: { orderBy: { sequence: "asc" } } },
  });

  if (!memory) return null;

  const stored = await prisma.memoryRelationship.findMany({
    where: {
      OR: [{ sourceMemoryId: memoryId }, { targetMemoryId: memoryId }],
      ...(workspaceId ? { workspaceId } : {}),
    },
    orderBy: { weight: "desc" },
  });

  const relationships = stored.map(toEnhancedRelationship);

  const adjacencyHints: AdjacencyHint[] = memory.chunks.flatMap((chunk, index) => {
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

  return {
    memoryId,
    workspaceId: memory.workspaceId,
    relationships,
    adjacencyHints,
  };
}

export async function getMemoryNeighborhood(
  prisma: PrismaClient,
  memoryId: string,
  workspaceId?: string,
  options?: { confidenceThreshold?: number; maxNeighbors?: number },
): Promise<NeighborhoodView | null> {
  const memory = await prisma.memory.findUnique({ where: { id: memoryId } });
  if (!memory) return null;

  const wsId = workspaceId ?? memory.workspaceId;

  const stored = await prisma.memoryRelationship.findMany({
    where: {
      workspaceId: wsId,
      OR: [{ sourceMemoryId: memoryId }, { targetMemoryId: memoryId }],
    },
    orderBy: { weight: "desc" },
  });

  const neighborIds = new Set<string>();
  for (const rel of stored) {
    if (rel.sourceMemoryId !== memoryId) neighborIds.add(rel.sourceMemoryId);
    if (rel.targetMemoryId !== memoryId) neighborIds.add(rel.targetMemoryId);
  }

  const neighborMemories = await prisma.memory.findMany({
    where: { id: { in: [...neighborIds] } },
    select: { id: true, title: true, memoryType: true, sourceType: true },
  });

  const lookup = new Map(
    neighborMemories.map((m) => [
      m.id,
      {
        memoryId: m.id,
        label: m.title ?? m.id.slice(0, 12),
        memoryType: m.memoryType,
        domain: deriveDomain(m.memoryType, m.sourceType),
      },
    ]),
  );

  lookup.set(memoryId, {
    memoryId,
    label: memory.title ?? memoryId.slice(0, 12),
    memoryType: memory.memoryType,
    domain: deriveDomain(memory.memoryType, memory.sourceType),
  });

  const rows = stored.map((r) => {
    const enhanced = toEnhancedRelationship(r);
    return {
      relationshipId: enhanced.relationshipId,
      sourceMemoryId: enhanced.sourceMemoryId,
      targetMemoryId: enhanced.targetMemoryId,
      relationshipType: enhanced.relationshipType,
      confidence: enhanced.confidence,
      weight: enhanced.weight,
      generatedFrom: enhanced.generatedFrom,
      ...(enhanced.metadata ? { metadata: enhanced.metadata } : {}),
    };
  });

  return buildNeighborhood(memoryId, wsId, rows, lookup, options);
}

export async function getWorkspaceClusters(
  prisma: PrismaClient,
  workspaceId: string,
): Promise<ClusterView | null> {
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) return null;

  const [memories, relationships] = await Promise.all([
    prisma.memory.findMany({
      where: { workspaceId, archived: false },
      select: { id: true, title: true, memoryType: true, sourceType: true },
      take: 200,
    }),
    prisma.memoryRelationship.findMany({
      where: { workspaceId },
      orderBy: { weight: "desc" },
    }),
  ]);

  const nodes = memories.map((m) => ({
    memoryId: m.id,
    label: m.title ?? m.id.slice(0, 12),
    memoryType: m.memoryType,
    sourceType: m.sourceType,
    domain: deriveDomain(m.memoryType, m.sourceType),
  }));

  const edges = relationships
    .filter((r) => r.sourceMemoryId !== r.targetMemoryId)
    .map((r) => {
      const enhanced = toEnhancedRelationship(r);
      return {
        source: r.sourceMemoryId,
        target: r.targetMemoryId,
        confidence: enhanced.confidence,
        weight: r.weight,
      };
    });

  return buildOperationalClusters(workspaceId, nodes, edges);
}

async function loadCoOccurrences(
  prisma: PrismaClient,
  workspaceId: string,
): Promise<CoOccurrencePair[]> {
  const ops = await prisma.retrievalOperation.findMany({
    where: { workspaceId, status: "completed" },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const pairCounts = new Map<string, number>();

  for (const op of ops) {
    const result = (op.result ?? {}) as unknown as StoredRetrievalResult;
    const memoryIds = result.contextPackage?.memories?.map((m) => m.memoryId) ?? [];
    for (let i = 0; i < memoryIds.length; i += 1) {
      for (let j = i + 1; j < memoryIds.length; j += 1) {
        const a = memoryIds[i]!;
        const b = memoryIds[j]!;
        const key = a < b ? `${a}:${b}` : `${b}:${a}`;
        pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
      }
    }
  }

  return [...pairCounts.entries()].map(([key, count]) => {
    const [memoryIdA, memoryIdB] = key.split(":");
    return { memoryIdA: memoryIdA!, memoryIdB: memoryIdB!, count };
  });
}

export async function runRelationshipGeneration(
  prisma: PrismaClient,
  request: RelationshipGenerationRequest,
): Promise<RelationshipGenerationResult | null> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: request.workspaceId },
  });
  if (!workspace) return null;

  const memories = await prisma.memory.findMany({
    where: {
      workspaceId: request.workspaceId,
      archived: false,
      ...(request.memoryId ? { id: request.memoryId } : {}),
    },
    include: { chunks: { select: { content: true }, orderBy: { sequence: "asc" } } },
    take: request.memoryId ? 1 : 200,
  });

  if (request.memoryId && memories.length === 0) return null;

  const allMemoriesForPairs = request.memoryId
    ? await prisma.memory.findMany({
        where: { workspaceId: request.workspaceId, archived: false },
        include: { chunks: { select: { content: true }, orderBy: { sequence: "asc" } } },
        take: 200,
      })
    : memories;

  const memoryInputs = allMemoriesForPairs.map((m) => {
    const metadata = (m.metadata ?? {}) as Record<string, unknown>;
    return {
      memoryId: m.id,
      title: m.title ?? "",
      memoryType: m.memoryType,
      sourceType: m.sourceType,
      ingestionTraceId: m.ingestionTraceId ?? undefined,
      tags: extractTags(metadata),
      contentTokens: buildContentTokens(m.chunks),
    };
  });

  const coOccurrences = await loadCoOccurrences(prisma, request.workspaceId);

  const candidates = generateRelationships(memoryInputs, coOccurrences, {
    ...(request.confidenceThreshold !== undefined
      ? { confidenceThreshold: request.confidenceThreshold }
      : {}),
    ...(request.sources ? { sources: request.sources } : {}),
    ...(request.memoryId ? { anchorMemoryId: request.memoryId } : {}),
  });

  let generated = 0;
  let updated = 0;
  const results: EnhancedMemoryRelationship[] = [];

  for (const candidate of candidates) {
    const confidence = scoreRelationshipConfidence({
      relationshipType: candidate.relationshipType,
      weight: candidate.weight,
      metadata: candidate.metadata,
    });

    const existing = await prisma.memoryRelationship.findUnique({
      where: {
        workspaceId_sourceMemoryId_targetMemoryId_relationshipType: {
          workspaceId: request.workspaceId,
          sourceMemoryId: candidate.sourceMemoryId,
          targetMemoryId: candidate.targetMemoryId,
          relationshipType: candidate.relationshipType,
        },
      },
    });

    const metadata: Record<string, unknown> = {
      ...candidate.metadata,
      generatedFrom: candidate.generatedFrom,
      confidence,
    };

    if (existing) {
      const prevMeta = (existing.metadata ?? {}) as Record<string, unknown>;
      const prevConfidence = scoreRelationshipConfidence({
        relationshipType: existing.relationshipType as RelationshipType,
        weight: existing.weight,
        metadata: prevMeta,
      });
      const evolution = createEvolutionEntry(
        "generated",
        { confidence: prevConfidence, weight: existing.weight },
        { confidence, weight: candidate.weight },
        "Relationship regenerated with updated signals",
      );
      metadata.evolutionHistory = appendEvolutionHistory(
        parseEvolutionHistory(prevMeta),
        evolution,
      );

      const row = await prisma.memoryRelationship.update({
        where: { id: existing.id },
        data: {
          weight: candidate.weight,
          metadata: metadata as Prisma.InputJsonValue,
        },
      });
      updated += 1;
      results.push(toEnhancedRelationship(row));
    } else {
      metadata.evolutionHistory = [
        createEvolutionEntry(
          "generated",
          { confidence: 0, weight: 0 },
          { confidence, weight: candidate.weight },
          `Generated from ${candidate.generatedFrom.join(", ")}`,
        ),
      ];

      const row = await prisma.memoryRelationship.create({
        data: {
          workspaceId: request.workspaceId,
          sourceMemoryId: candidate.sourceMemoryId,
          targetMemoryId: candidate.targetMemoryId,
          relationshipType: candidate.relationshipType,
          weight: candidate.weight,
          metadata: metadata as Prisma.InputJsonValue,
        },
      });
      generated += 1;
      results.push(toEnhancedRelationship(row));
    }
  }

  return {
    workspaceId: request.workspaceId,
    generated,
    updated,
    relationships: results,
    reasoning: [
      `Processed ${memoryInputs.length} memories`,
      `Generated ${generated} new, updated ${updated} existing relationships`,
      `Co-occurrence pairs analyzed: ${coOccurrences.length}`,
    ],
  };
}

export async function getAugmentationTrace(
  prisma: PrismaClient,
  traceId: string,
): Promise<AugmentationTraceView | null> {
  const trace = await getRetrievalTrace(prisma, traceId);
  if (!trace?.contextPackage) return null;

  const result = (await prisma.retrievalOperation.findFirst({
    where: { traceId },
    orderBy: { createdAt: "desc" },
  }))?.result as unknown as StoredRetrievalResult | undefined;

  const relationshipAugmentation = result?.relationshipAugmentation;
  if (!relationshipAugmentation) {
    const expansion = trace.contextPackage.retrievalMetadata.expansion;
    return {
      retrievalTraceId: traceId,
      workspaceId: trace.workspaceId,
      query: trace.query,
      augmentation: {
        neighborsExpanded: [],
        rankingImpacts: [],
        augmentationApplied: false,
        maxDepth: 1,
        neighborCount: 0,
        confidenceThreshold: 0.55,
        reasoning: ["No relationship augmentation recorded for this trace"],
      },
      ...(expansion
        ? {
            structuralExpansion: {
              metadataExpansion: expansion.metadataExpansion,
              contextualNeighborCount: expansion.contextualNeighbors.length,
            },
          }
        : {}),
      retrievedMemoryIds: trace.contextPackage.memories.map((m) => m.memoryId),
      augmentedMemoryIds: [],
      reasoning: ["Trace predates relationship augmentation or augmentation was not applied"],
      createdAt: trace.createdAt,
    };
  }

  const expansion = trace.contextPackage.retrievalMetadata.expansion;

  return {
    retrievalTraceId: traceId,
    workspaceId: trace.workspaceId,
    query: trace.query,
    augmentation: relationshipAugmentation,
    ...(expansion
      ? {
          structuralExpansion: {
            metadataExpansion: expansion.metadataExpansion,
            contextualNeighborCount: expansion.contextualNeighbors.length,
          },
        }
      : {}),
    retrievedMemoryIds: trace.contextPackage.memories.map((m) => m.memoryId),
    augmentedMemoryIds: relationshipAugmentation.neighborsExpanded.map((n) => n.memoryId),
    reasoning: relationshipAugmentation.reasoning,
    createdAt: trace.createdAt,
  };
}

export async function loadRelationshipsForMemories(
  prisma: PrismaClient,
  workspaceId: string,
  memoryIds: string[],
): Promise<EnhancedMemoryRelationship[]> {
  if (memoryIds.length === 0) return [];

  const stored = await prisma.memoryRelationship.findMany({
    where: {
      workspaceId,
      OR: [
        { sourceMemoryId: { in: memoryIds } },
        { targetMemoryId: { in: memoryIds } },
      ],
    },
    orderBy: { weight: "desc" },
    take: 500,
  });

  return stored.map(toEnhancedRelationship);
}

export async function reinforceCoOccurrenceRelationships(
  prisma: PrismaClient,
  workspaceId: string,
  memoryIds: string[],
): Promise<void> {
  if (memoryIds.length < 2) return;

  for (let i = 0; i < memoryIds.length; i += 1) {
    for (let j = i + 1; j < memoryIds.length; j += 1) {
      const a = memoryIds[i]!;
      const b = memoryIds[j]!;

      for (const [source, target] of [
        [a, b],
        [b, a],
      ] as const) {
        const existing = await prisma.memoryRelationship.findFirst({
          where: {
            workspaceId,
            sourceMemoryId: source,
            targetMemoryId: target,
            relationshipType: "retrieval_cooccurrence",
          },
        });

        if (existing) {
          const meta = (existing.metadata ?? {}) as Record<string, unknown>;
          const prevFreq = Number(meta.retrievalFrequency ?? meta.coOccurrenceCount ?? 0);
          const newWeight = Math.min(1, existing.weight + 0.05);
          const newFreq = prevFreq + 1;
          const evolution = createEvolutionEntry(
            "co_occurrence",
            {
              confidence: scoreRelationshipConfidence({
                relationshipType: "retrieval_cooccurrence",
                weight: existing.weight,
                metadata: meta,
              }),
              weight: existing.weight,
            },
            {
              confidence: scoreRelationshipConfidence({
                relationshipType: "retrieval_cooccurrence",
                weight: newWeight,
                metadata: { ...meta, coOccurrenceCount: newFreq },
              }),
              weight: newWeight,
            },
            "Retrieval co-occurrence reinforcement",
          );

          await prisma.memoryRelationship.update({
            where: { id: existing.id },
            data: {
              weight: newWeight,
              metadata: JSON.parse(
                JSON.stringify({
                  ...meta,
                  coOccurrenceCount: newFreq,
                  retrievalFrequency: newFreq,
                  evolutionHistory: appendEvolutionHistory(
                    parseEvolutionHistory(meta),
                    evolution,
                  ),
                }),
              ) as Prisma.InputJsonValue,
            },
          });
        }
      }
    }
  }
}

/** Legacy-compatible relationship list for compression integration. */
export function toLegacyRelationships(
  enhanced: EnhancedMemoryRelationship[],
): MemoryRelationship[] {
  return enhanced.map((r) => ({
    sourceMemoryId: r.sourceMemoryId,
    targetMemoryId: r.targetMemoryId,
    relationshipType: r.relationshipType as MemoryRelationship["relationshipType"],
    weight: r.weight,
    ...(r.metadata ? { metadata: r.metadata } : {}),
  }));
}
