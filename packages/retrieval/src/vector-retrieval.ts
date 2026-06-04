import type { RejectedCandidate, RetrievalRuntimeConfig } from "@memory-middleware/shared-types";
import type { RetrievalMode } from "@memory-middleware/shared-types";
export interface VectorSearchCandidate {
  memoryId: string;
  chunkId: string;
  sequence: number;
  content: string;
  tokenCount: number;
  semanticSimilarity: number;
  importanceScore: number;
  reinforcementScore: number;
  semanticDensityScore: number;
  memoryUpdatedAt: string;
  memoryType: string;
  title: string;
  version: number;
  summary: string | null;
  ingestionTraceId: string;
  normalizationTraceId: string;
}

import type { DomainVectorScope } from "./domain-scope.js";

export interface VectorSearchFilter {
  workspaceId: string;
  memoryTypes?: string[];
  timeframe?: { start?: string; end?: string };
  /** Domain Engine — metadata and rule predicates for task-scoped retrieval */
  domainScope?: DomainVectorScope;
}

export const MIN_SIMILARITY_THRESHOLD = 0.45;
export const THRESHOLD_RETRY_DELTA = 0.05;

export interface VectorSearchStore {
  search(
    queryEmbedding: number[],
    filter: VectorSearchFilter,
    limit: number,
    /** When omitted, returns top-K by similarity without a SQL threshold filter. */
    similarityThreshold?: number,
  ): Promise<VectorSearchCandidate[]>;
}

export interface SimilarityThresholdResult {
  candidates: VectorSearchCandidate[];
  effectiveThreshold: number;
  retried: boolean;
  rejected: RejectedCandidate[];
}

export function topKForMode(mode: RetrievalMode, config: RetrievalRuntimeConfig): number {
  switch (mode) {
    case "precision":
      return config.vector.topKPrecision;
    case "expanded":
      return config.vector.topKExpanded;
    case "exploratory":
      return config.vector.topKExploratory;
    case "incident-response":
      return config.vector.topKIncidentResponse;
    default:
      return config.vector.topKPrecision;
  }
}

export function similarityThresholdForMode(
  mode: RetrievalMode,
  baseThreshold: number,
): number {
  const deltas: Record<RetrievalMode, number> = {
    precision: 0,
    expanded: -0.03,
    exploratory: -0.02,
    "incident-response": -0.01,
  };
  const adjusted = baseThreshold + (deltas[mode] ?? 0);
  return Math.max(0.45, Math.min(baseThreshold, adjusted));
}

export function vectorRejections(
  candidates: VectorSearchCandidate[],
  threshold: number,
  allScanned?: VectorSearchCandidate[],
): RejectedCandidate[] {
  const rejected: RejectedCandidate[] = [];
  const below = (allScanned ?? candidates).filter((c) => c.semanticSimilarity < threshold);
  for (const c of below) {
    rejected.push({
      memoryId: c.memoryId,
      chunkId: c.chunkId,
      reason: "below_similarity_threshold",
      detail: `Similarity ${c.semanticSimilarity.toFixed(4)} below threshold ${threshold.toFixed(2)}`,
      semanticSimilarity: c.semanticSimilarity,
    });
  }
  return rejected;
}

export function applySimilarityThreshold(
  scanned: VectorSearchCandidate[],
  threshold: number,
): SimilarityThresholdResult {
  let effectiveThreshold = threshold;
  let candidates = scanned.filter((c) => c.semanticSimilarity >= effectiveThreshold);
  let retried = false;

  if (candidates.length === 0 && effectiveThreshold > MIN_SIMILARITY_THRESHOLD) {
    effectiveThreshold = Math.max(
      MIN_SIMILARITY_THRESHOLD,
      effectiveThreshold - THRESHOLD_RETRY_DELTA,
    );
    candidates = scanned.filter((c) => c.semanticSimilarity >= effectiveThreshold);
    retried = true;
  }

  const rejected =
    scanned.length === 0 ? [] : vectorRejections(scanned, effectiveThreshold);

  return { candidates, effectiveThreshold, retried, rejected };
}
