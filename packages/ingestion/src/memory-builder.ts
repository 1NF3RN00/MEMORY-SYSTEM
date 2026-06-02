import {
  EMBEDDING_VERSION_V1,
  NORMALIZATION_VERSION_V1,
  newUlid,
  type CanonicalMemoryChunk,
  type CanonicalMemoryObject,
  type MemoryType,
  type PersistenceMode,
  type SourceType,
} from "@memory-middleware/shared-types";
import { estimateTokens } from "./token-estimator.js";

export interface BuildMemoryInput {
  workspaceId: string;
  /** Shared across append-only versions */
  lineageId: string;
  version: number;
  memoryType: MemoryType;
  persistenceMode: PersistenceMode;
  sourceType: SourceType;
  title: string;
  normalizedContent: string;
  summary?: string;
  ingestionTraceId: string;
  normalizationTraceId: string;
  chunks: CanonicalMemoryChunk[];
  sourceUrl?: string;
  sourceLabel?: string;
  tags?: string[];
  parentMemoryId?: string;
  ingestionLatencyMs?: number;
  normalizationLatencyMs?: number;
  semanticDensityScore?: number;
  structuralMeta?: {
    chunkingStrategy: string;
    fallbackUsed: boolean;
    fallbackReason?: string;
  };
}

export function buildCanonicalMemory(input: BuildMemoryInput): CanonicalMemoryObject {
  const now = new Date().toISOString();
  const memoryId = newUlid();
  const tokenCount = estimateTokens(input.normalizedContent);

  const chunks = input.chunks.map((chunk, index) => ({
    ...chunk,
    id: chunk.id || newUlid(),
    memoryId,
    chunkIndex: index,
  }));

  const avgChunkDensity =
    input.semanticDensityScore ??
    (chunks.length > 0
      ? chunks.reduce((sum, c) => sum + (c.semanticDensityScore ?? 0), 0) / chunks.length
      : 0);

  return {
    id: memoryId,
    workspaceId: input.workspaceId,
    version: input.version,
    ...(input.parentMemoryId ? { parentMemoryId: input.parentMemoryId } : {}),
    memoryType: input.memoryType,
    persistenceMode: input.persistenceMode,
    sourceType: input.sourceType,
    title: input.title,
    normalizedContent: input.normalizedContent,
    ...(input.summary ? { summary: input.summary } : {}),
    chunks,
    metadata: {
      ...(input.sourceUrl ? { sourceUrl: input.sourceUrl } : {}),
      ...(input.sourceLabel ? { sourceLabel: input.sourceLabel } : {}),
      ...(input.tags?.length ? { tags: input.tags } : {}),
      ingestionTimestamp: now,
      embeddingVersion: EMBEDDING_VERSION_V1,
      normalizationVersion: NORMALIZATION_VERSION_V1,
      ...(input.structuralMeta
        ? {
            structural: input.structuralMeta,
          }
        : {}),
    },
    scoring: {
      importanceScore: 1,
      reinforcementScore: 0,
      semanticDensityScore: avgChunkDensity,
      retrievalCount: 0,
      archivalScore: 0,
    },
    lineage: {
      ingestionTraceId: input.ingestionTraceId,
      normalizationTraceId: input.normalizationTraceId,
    },
    observability: {
      ...(input.ingestionLatencyMs !== undefined
        ? { ingestionLatencyMs: input.ingestionLatencyMs }
        : {}),
      ...(input.normalizationLatencyMs !== undefined
        ? { normalizationLatencyMs: input.normalizationLatencyMs }
        : {}),
      chunkCount: chunks.length,
      tokenCount,
      retrievalEligible: input.persistenceMode === "persistent",
      archived: false,
    },
    createdAt: now,
    updatedAt: now,
  };
}
