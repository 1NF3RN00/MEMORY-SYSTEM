import type {
  RelationshipAugmentationConfig,
  RelationshipAugmentationResult,
  RelationshipNeighborSuggestion,
  RelationshipType,
} from "@memory-middleware/shared-types";
import { DEFAULT_RELATIONSHIP_AUGMENTATION_CONFIG } from "@memory-middleware/shared-types";

export interface AugmentationRelationship {
  sourceMemoryId: string;
  targetMemoryId: string;
  relationshipType: RelationshipType;
  confidence: number;
  weight: number;
  generatedFrom: string[];
}

export interface RankedCandidate {
  memoryId: string;
  chunkId: string;
  finalScore: number;
  semanticSimilarity: number;
}

/**
 * Bounded depth-1 relationship augmentation.
 * Semantic precision remains dominant — augmentation nudge is capped.
 */
export function applyRelationshipAugmentation(input: {
  retrievedMemoryIds: string[];
  relationships: AugmentationRelationship[];
  rankedCandidates: RankedCandidate[];
  config?: Partial<RelationshipAugmentationConfig>;
}): {
  result: RelationshipAugmentationResult;
  adjustedCandidates: RankedCandidate[];
} {
  const config: RelationshipAugmentationConfig = {
    ...DEFAULT_RELATIONSHIP_AUGMENTATION_CONFIG,
    ...input.config,
  };

  const candidateMemoryIds = new Set(input.rankedCandidates.map((c) => c.memoryId));
  const retrievedSet = new Set(input.retrievedMemoryIds);
  const reasoning: string[] = [];
  const neighborsExpanded: RelationshipNeighborSuggestion[] = [];
  const rankingImpacts: RelationshipAugmentationResult["rankingImpacts"] = [];

  const neighborRels = input.relationships
    .filter(
      (r) =>
        r.confidence >= config.confidenceThreshold &&
        r.sourceMemoryId !== r.targetMemoryId &&
        (retrievedSet.has(r.sourceMemoryId) || retrievedSet.has(r.targetMemoryId)),
    )
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, config.maxNeighbors);

  for (const rel of neighborRels) {
    const anchorId = retrievedSet.has(rel.sourceMemoryId)
      ? rel.sourceMemoryId
      : rel.targetMemoryId;
    const neighborId =
      rel.sourceMemoryId === anchorId ? rel.targetMemoryId : rel.sourceMemoryId;
    const inCandidateSet = candidateMemoryIds.has(neighborId);

    let rankingImpact = 0;
    if (inCandidateSet) {
      rankingImpact = Math.min(
        config.augmentationWeight,
        rel.confidence * config.augmentationWeight,
      );
    }

    neighborsExpanded.push({
      memoryId: neighborId,
      relationshipType: rel.relationshipType,
      confidence: rel.confidence,
      generatedFrom: rel.generatedFrom,
      inCandidateSet,
      rankingImpact,
    });

    reasoning.push(
      inCandidateSet
        ? `Neighbor ${neighborId.slice(0, 8)} via ${rel.relationshipType} — ranking nudge +${rankingImpact.toFixed(3)}`
        : `Neighbor ${neighborId.slice(0, 8)} via ${rel.relationshipType} — suggested (not in candidate set)`,
    );
  }

  const adjustedCandidates = input.rankedCandidates.map((c) => {
    const neighbor = neighborsExpanded.find(
      (n) => n.memoryId === c.memoryId && n.inCandidateSet,
    );
    if (!neighbor || neighbor.rankingImpact <= 0) return c;

    const augmentedScore = c.finalScore + neighbor.rankingImpact;
    rankingImpacts.push({
      memoryId: c.memoryId,
      chunkId: c.chunkId,
      previousScore: c.finalScore,
      augmentedScore,
      relationshipType: neighbor.relationshipType,
      confidence: neighbor.confidence,
    });

    return { ...c, finalScore: augmentedScore };
  });

  if (neighborsExpanded.length === 0) {
    reasoning.push("No relationship neighbors above confidence threshold");
  } else {
    reasoning.unshift(
      `Bounded expansion: depth=${config.maxDepth}, neighbors=${neighborsExpanded.length}, threshold=${config.confidenceThreshold}`,
    );
  }

  const result: RelationshipAugmentationResult = {
    neighborsExpanded,
    rankingImpacts,
    augmentationApplied: neighborsExpanded.length > 0,
    maxDepth: 1,
    neighborCount: neighborsExpanded.length,
    confidenceThreshold: config.confidenceThreshold,
    reasoning,
  };

  return { result, adjustedCandidates };
}
