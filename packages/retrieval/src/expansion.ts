import type {
  ContextualNeighborHint,
  MemoryStructureView,
  QueryDecomposition,
  RetrievalExpansionResult,
  SemanticSurface,
} from "@memory-middleware/shared-types";

const TAG_SYNONYMS: Record<string, string[]> = {
  policy: ["policy", "policies", "rule", "rules", "guideline"],
  decision: ["decision", "decisions", "resolution", "determination"],
  meeting: ["meeting", "meetings", "standup", "sync", "discussion"],
  technical: ["technical", "engineering", "architecture", "implementation"],
  customer: ["customer", "client", "user", "stakeholder"],
};

export interface ChunkAdjacencyLookup {
  chunkId: string;
  memoryId: string;
  content: string;
  lineage?: {
    previousChunkId?: string;
    nextChunkId?: string;
    siblingChunkIds?: string[];
    sectionPath: string[];
    headingHierarchy: string[];
    semanticGroupId?: string;
  };
}

export interface MemoryMetadataLookup {
  memoryId: string;
  title: string;
  memoryType: string;
  tags?: string[];
  semanticSurface?: SemanticSurface;
}

function expandTags(keywords: string[]): string[] {
  const expanded = new Set<string>(keywords.map((k) => k.toLowerCase()));

  for (const keyword of keywords) {
    const lower = keyword.toLowerCase();
    for (const [root, synonyms] of Object.entries(TAG_SYNONYMS)) {
      if (synonyms.some((s) => lower.includes(s) || s.includes(lower))) {
        expanded.add(root);
        for (const syn of synonyms) expanded.add(syn);
      }
    }
  }

  return [...expanded].sort();
}

/** Deterministic metadata expansion for retrieval augmentation. */
export function expandRetrievalMetadata(
  query: string,
  keywords: string[],
  memories: MemoryMetadataLookup[],
  decomposition?: QueryDecomposition,
): RetrievalExpansionResult["metadataExpansion"] {
  const expandedTags = expandTags(keywords);
  const matchedMetadataKeys: string[] = [];
  const surfaceExpansionTerms: string[] = [];
  let enrichmentScore = 0;
  const queryLower = query.toLowerCase();

  if (decomposition) {
    for (const domain of decomposition.domains) {
      expandedTags.push(domain);
      surfaceExpansionTerms.push(domain);
      enrichmentScore += 0.06;
    }
    for (const concept of decomposition.operationalConcepts.slice(0, 8)) {
      if (!expandedTags.includes(concept)) expandedTags.push(concept);
      surfaceExpansionTerms.push(concept);
    }
  }

  for (const memory of memories) {
    const memoryType = memory.memoryType.toLowerCase();
    if (expandedTags.some((t) => memoryType.includes(t) || t.includes(memoryType))) {
      matchedMetadataKeys.push(`memoryType:${memory.memoryType}`);
      enrichmentScore += 0.1;
    }

    if (memory.title) {
      const titleLower = memory.title.toLowerCase();
      for (const tag of expandedTags) {
        if (titleLower.includes(tag)) {
          matchedMetadataKeys.push(`title:${memory.memoryId}`);
          enrichmentScore += 0.05;
        }
      }
    }

    for (const tag of memory.tags ?? []) {
      if (expandedTags.some((t) => tag.toLowerCase().includes(t))) {
        matchedMetadataKeys.push(`tag:${tag}`);
        enrichmentScore += 0.08;
      }
    }

    if (memory.semanticSurface) {
      const surface = memory.semanticSurface;
      for (const concept of surface.primaryConcepts) {
        if (queryLower.includes(concept.toLowerCase()) || expandedTags.some((t) => concept.includes(t))) {
          surfaceExpansionTerms.push(concept);
          matchedMetadataKeys.push(`concept:${memory.memoryId}:${concept}`);
          enrichmentScore += 0.07;
        }
      }
      for (const domain of surface.operationalDomains) {
        if (expandedTags.includes(domain) || decomposition?.domains.includes(domain)) {
          surfaceExpansionTerms.push(domain);
          matchedMetadataKeys.push(`domain:${memory.memoryId}:${domain}`);
          enrichmentScore += 0.06;
        }
      }
      if (surface.hierarchyPath?.length) {
        for (const segment of surface.hierarchyPath) {
          if (queryLower.includes(segment.toLowerCase())) {
            surfaceExpansionTerms.push(segment);
            matchedMetadataKeys.push(`hierarchy:${memory.memoryId}:${segment}`);
            enrichmentScore += 0.05;
          }
        }
      }
      for (const alias of surface.semanticAliases.slice(0, 4)) {
        if (expandedTags.some((t) => alias.includes(t) || t.includes(alias))) {
          surfaceExpansionTerms.push(alias);
          enrichmentScore += 0.04;
        }
      }
    }

    if (queryLower.includes(memory.title.toLowerCase().slice(0, 20))) {
      matchedMetadataKeys.push(`titleMatch:${memory.memoryId}`);
      enrichmentScore += 0.12;
    }
  }

  return {
    expandedTags: [...new Set(expandedTags)].sort(),
    matchedMetadataKeys: [...new Set(matchedMetadataKeys)],
    enrichmentScore: Math.min(1, enrichmentScore),
    surfaceExpansionTerms: [...new Set(surfaceExpansionTerms)].sort().slice(0, 24),
  };
}

/** Build contextual neighbor hints from chunk adjacency (no graph traversal). */
export function buildContextualNeighborHints(
  retrievedChunkIds: string[],
  adjacencyByChunkId: Map<string, ChunkAdjacencyLookup>,
): ContextualNeighborHint[] {
  const hints: ContextualNeighborHint[] = [];
  const seen = new Set<string>();

  for (const chunkId of retrievedChunkIds) {
    const chunk = adjacencyByChunkId.get(chunkId);
    if (!chunk?.lineage) continue;

    const { lineage } = chunk;
    const neighbors: Array<{
      id?: string;
      relationship: ContextualNeighborHint["relationship"];
      weight: number;
    }> = [
      ...(lineage.previousChunkId
        ? [{ id: lineage.previousChunkId, relationship: "previous" as const, weight: 0.7 }]
        : []),
      ...(lineage.nextChunkId
        ? [{ id: lineage.nextChunkId, relationship: "next" as const, weight: 0.7 }]
        : []),
      ...(lineage.siblingChunkIds ?? []).map((id) => ({
        id,
        relationship: "sibling" as const,
        weight: 0.5,
      })),
    ];

    for (const neighbor of neighbors) {
      if (!neighbor.id || neighbor.id === chunkId) continue;
      const key = `${chunkId}:${neighbor.id}:${neighbor.relationship}`;
      if (seen.has(key)) continue;
      seen.add(key);

      hints.push({
        sourceChunkId: chunkId,
        neighborChunkId: neighbor.id,
        relationship: neighbor.relationship,
        hintWeight: neighbor.weight,
        sectionPath: lineage.sectionPath,
      });
    }
  }

  return hints.sort((a, b) => b.hintWeight - a.hintWeight);
}

/** Apply retrieval expansion — metadata + neighbor hints. */
export function applyRetrievalExpansion(input: {
  query: string;
  keywords: string[];
  retrievedChunkIds: string[];
  memories: MemoryMetadataLookup[];
  adjacencyByChunkId: Map<string, ChunkAdjacencyLookup>;
  decomposition?: QueryDecomposition;
}): RetrievalExpansionResult {
  const metadataExpansion = expandRetrievalMetadata(
    input.query,
    input.keywords,
    input.memories,
    input.decomposition,
  );

  const contextualNeighbors = buildContextualNeighborHints(
    input.retrievedChunkIds,
    input.adjacencyByChunkId,
  );

  return {
    metadataExpansion,
    contextualNeighbors,
    expansionApplied:
      metadataExpansion.matchedMetadataKeys.length > 0 ||
      (metadataExpansion.surfaceExpansionTerms?.length ?? 0) > 0 ||
      contextualNeighbors.length > 0,
  };
}

/** Build structure view from canonical memory chunks. */
export function buildStructureView(
  memoryId: string,
  chunks: Array<{
    id: string;
    chunkIndex: number;
    content: string;
    tokenCount: number;
    semanticDensityScore?: number;
    metadata: Record<string, unknown>;
  }>,
  fallbackUsed?: boolean,
  fallbackReason?: string,
): MemoryStructureView {
  const strategy =
    (chunks[0]?.metadata.chunkingStrategy as string | undefined) ?? "unknown";

  const headingSet = new Set<string>();
  const mappedChunks = chunks.map((chunk) => {
    const lineage = (chunk.metadata.lineage ?? {
      sectionPath: [],
      headingHierarchy: [],
    }) as MemoryStructureView["chunks"][0]["lineage"];

    for (const h of lineage.headingHierarchy) headingSet.add(h);

    const segmentationReason = (chunk.metadata.segmentationReason ?? {
      chunkIndex: chunk.chunkIndex,
      strategy,
      headingInheritance: lineage.headingHierarchy,
      boundaryReason: "unknown",
      preservedBulletGroup: false,
    }) as MemoryStructureView["chunks"][0]["segmentationReason"];

    const densityDetail = (chunk.metadata.densityDetail ?? {
      informationalConcentration: 0,
      contextualUniqueness: 0,
      combinedScore: chunk.semanticDensityScore ?? 0,
      rankingInfluence: 0,
    }) as MemoryStructureView["chunks"][0]["densityDetail"];

    return {
      chunkId: chunk.id,
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      tokenCount: chunk.tokenCount,
      semanticDensityScore: chunk.semanticDensityScore ?? densityDetail.combinedScore,
      densityDetail,
      lineage,
      segmentationReason,
    };
  });

  return {
    memoryId,
    chunkingStrategy: strategy,
    fallbackUsed: fallbackUsed ?? (strategy.includes("fallback") || strategy === "deterministic-fixed-v1"),
    ...(fallbackReason ? { fallbackReason } : {}),
    headingHierarchy: [...headingSet],
    chunks: mappedChunks,
    segmentationReasons: mappedChunks.map((c) => c.segmentationReason),
  };
}
