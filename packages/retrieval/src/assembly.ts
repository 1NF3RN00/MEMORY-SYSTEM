import type {
  ChunkRetrievalTrace,
  ContextPackage,
  RetrievedChunk,
  RetrievedMemory,
} from "@memory-middleware/shared-types";
import type { DeduplicationResult } from "./deduplication.js";
import { deduplicationDecision } from "./deduplication.js";
import type { RankedChunk } from "./ranking.js";
import { tokenBudgetDecision } from "./token-budget.js";
import type { TokenBudgetResult } from "./token-budget.js";

export interface MemoryRowForAssembly {
  id: string;
  title: string;
  memoryType: string;
  version: number;
  summary: string | null;
  ingestionTraceId: string;
  normalizationTraceId: string;
}

export interface ChunkRowForAssembly {
  id: string;
  memoryId: string;
  sequence: number;
  content: string;
  tokenCount: number;
}

export function assembleContextPackage(input: {
  query: string;
  workspaceId: string;
  retrievalTraceId: string;
  tokenBudget: TokenBudgetResult;
  dedup: DeduplicationResult;
  allRanked: RankedChunk[];
  memories: Map<string, MemoryRowForAssembly>;
  chunkRows: Map<string, ChunkRowForAssembly>;
  rejectedCandidates: ContextPackage["rejectedCandidates"];
  rankingBreakdown: ContextPackage["rankingBreakdown"];
  retrievalLatencyMs: number;
  retrievedChunkCount: number;
  maxTokens: number;
}): ContextPackage {
  const chunkTraces: ChunkRetrievalTrace[] = input.allRanked.map((r) => ({
    memoryId: r.memoryId,
    chunkId: r.chunkId,
    semanticSimilarity: r.semanticSimilarity,
    importanceBoost: r.importanceBoost,
    recencyBoost: r.recencyBoost,
    reinforcementBoost: r.reinforcementBoost,
    semanticDensityBoost: r.semanticDensityBoost,
    finalScore: r.finalScore,
    retrievalReasons: r.retrievalReasons,
    deduplicationDecision: deduplicationDecision(
      r.chunkId,
      input.dedup.kept,
      input.dedup.removed,
    ),
    tokenBudgetDecision: tokenBudgetDecision(
      r.chunkId,
      input.tokenBudget.included,
      input.tokenBudget.trimmed,
    ),
    rankingRank: r.rankingRank,
  }));

  const byMemory = new Map<string, RetrievedMemory>();

  for (const ranked of input.tokenBudget.included) {
    const memory = input.memories.get(ranked.memoryId);
    const chunkRow = input.chunkRows.get(ranked.chunkId);
    if (!memory || !chunkRow) continue;

    const retrievedChunk: RetrievedChunk = {
      chunkId: ranked.chunkId,
      chunkIndex: chunkRow.sequence,
      content: chunkRow.content,
      tokenCount: chunkRow.tokenCount,
      finalScore: ranked.finalScore,
      rankingRank: ranked.rankingRank,
    };

    const existing = byMemory.get(ranked.memoryId);
    if (existing) {
      existing.chunks.push(retrievedChunk);
      existing.memoryScore = Math.max(existing.memoryScore, ranked.finalScore);
    } else {
      byMemory.set(ranked.memoryId, {
        memoryId: memory.id,
        title: memory.title,
        memoryType: memory.memoryType,
        version: memory.version,
        ...(memory.summary ? { summary: memory.summary } : {}),
        lineage: {
          ingestionTraceId: memory.ingestionTraceId,
          normalizationTraceId: memory.normalizationTraceId,
        },
        chunks: [retrievedChunk],
        memoryScore: ranked.finalScore,
      });
    }
  }

  const memories = [...byMemory.values()]
    .map((m) => ({
      ...m,
      chunks: [...m.chunks].sort((a, b) => a.chunkIndex - b.chunkIndex),
    }))
    .sort((a, b) => b.memoryScore - a.memoryScore);

  return {
    query: input.query,
    workspaceId: input.workspaceId,
    retrievalTraceId: input.retrievalTraceId,
    tokenBudget: {
      maxTokens: input.maxTokens,
      usedTokens: input.tokenBudget.usedTokens,
      trimmedTokens: input.tokenBudget.trimmedTokens,
    },
    retrievalMetadata: {
      retrievalLatencyMs: input.retrievalLatencyMs,
      retrievedChunkCount: input.retrievedChunkCount,
      deduplicatedChunkCount: input.dedup.kept.length,
      finalChunkCount: input.tokenBudget.included.length,
    },
    memories,
    rejectedCandidates: input.rejectedCandidates,
    rankingBreakdown: input.rankingBreakdown,
    chunkTraces,
    generatedAt: new Date().toISOString(),
  };
}
