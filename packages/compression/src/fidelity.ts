import type {
  CompressionStageTrace,
  ContextPackage,
  FidelityReport,
  OptimizedContextPackage,
  CompressionMetadata,
} from "@memory-middleware/shared-types";
import type { ResolvedCompressionConfig } from "./config.js";
import type { FlatChunk } from "./overlap.js";
import type { MergedChunk } from "./merge.js";

export interface FidelityValidationInput {
  originalChunks: FlatChunk[];
  optimizedChunks: MergedChunk[];
  originalTokens: number;
  optimizedTokens: number;
  config: ResolvedCompressionConfig;
}

export interface FidelityValidationResult {
  report: FidelityReport;
  stageTrace: CompressionStageTrace;
}

export function validateFidelity(input: FidelityValidationInput): FidelityValidationResult {
  const originalIds = new Set(input.originalChunks.map((c) => c.chunkId));
  const retainedOriginals = input.optimizedChunks.filter((c) =>
    c.mergedFrom.some((id) => originalIds.has(id)),
  );

  const chunkRetentionRatio =
    input.originalChunks.length > 0
      ? retainedOriginals.length / input.originalChunks.length
      : 1;

  const originalRankSum = input.originalChunks.reduce((s, c) => s + c.rankingRank, 0);
  const optimizedRankSum = input.optimizedChunks.reduce((s, c) => s + c.rankingRank, 0);
  const rankingPreservationRatio =
    originalRankSum > 0 ? Math.min(1, originalRankSum / optimizedRankSum) : 1;

  const tokenReductionRatio =
    input.originalTokens > 0
      ? 1 - input.optimizedTokens / input.originalTokens
      : 0;

  const nuancePreservationScore = clamp(
    chunkRetentionRatio * 0.5 +
      rankingPreservationRatio * 0.3 +
      input.config.nuancePreservation * 0.2,
    0,
    1,
  );

  const compressionAggressiveness = clamp(
    tokenReductionRatio * 0.6 + input.config.tokenOptimization * 0.4,
    0,
    1,
  );

  const retrievalQualityScore = clamp(
    rankingPreservationRatio * 0.45 +
      chunkRetentionRatio * 0.35 +
      (1 - compressionAggressiveness * 0.3) * 0.2,
    0,
    1,
  );

  const contextualPreservationScore = clamp(
    (chunkRetentionRatio + rankingPreservationRatio) / 2,
    0,
    1,
  );

  const fidelityScore = clamp(
    nuancePreservationScore * 0.35 +
      retrievalQualityScore * 0.35 +
      contextualPreservationScore * 0.3,
    0,
    1,
  );

  const issues: string[] = [];

  if (chunkRetentionRatio < input.config.runtime.trim.minRetentionRatio) {
    issues.push(
      `Chunk retention ${(chunkRetentionRatio * 100).toFixed(0)}% below minimum ${(input.config.runtime.trim.minRetentionRatio * 100).toFixed(0)}%`,
    );
  }
  if (rankingPreservationRatio < 0.7) {
    issues.push("Ranking order significantly altered during compression");
  }
  if (fidelityScore < 0.55 && input.config.fidelityMode === "maximum_fidelity") {
    issues.push("Fidelity score below threshold for maximum fidelity mode");
  }

  const validationPassed =
    input.config.fidelityMode === "aggressive"
      ? fidelityScore >= 0.45
      : input.config.fidelityMode === "balanced"
        ? fidelityScore >= 0.55
        : fidelityScore >= 0.65 && issues.length === 0;

  const report: FidelityReport = {
    fidelityScore,
    nuancePreservationScore,
    compressionAggressiveness,
    retrievalQualityScore,
    contextualPreservationScore,
    validationPassed,
    issues,
    rankingPreservationRatio,
    chunkRetentionRatio,
  };

  return {
    report,
    stageTrace: {
      compressionStage: "fidelity_validation",
      affectedChunks: input.optimizedChunks.map((c) => c.chunkId),
      tokenSavings: Math.max(0, input.originalTokens - input.optimizedTokens),
      fidelityImpact: validationPassed ? "low" : "medium",
      compressionReason: validationPassed
        ? `Fidelity validation passed (score ${fidelityScore.toFixed(3)})`
        : `Fidelity validation flagged ${issues.length} issue(s)`,
      rankingPreservation: rankingPreservationRatio >= 0.85,
      llmUsed: false,
      metadata: {
        fidelity_score: fidelityScore,
        validation_passed: validationPassed,
      },
    },
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function rebuildContextPackage(
  source: ContextPackage,
  optimizedChunks: MergedChunk[],
  compressionTraceId: string,
  metadata: CompressionMetadata,
): OptimizedContextPackage {
  const chunkByMemory = new Map<string, MergedChunk[]>();
  for (const chunk of optimizedChunks) {
    const list = chunkByMemory.get(chunk.memoryId) ?? [];
    list.push(chunk);
    chunkByMemory.set(chunk.memoryId, list);
  }

  const memories = source.memories
    .map((memory) => {
      const chunks = chunkByMemory.get(memory.memoryId);
      if (!chunks || chunks.length === 0) return null;

      return {
        ...memory,
        chunks: chunks
          .sort((a, b) => a.rankingRank - b.rankingRank)
          .map((c, index) => ({
            chunkId: c.chunkId,
            chunkIndex: index,
            content: c.content,
            tokenCount: c.tokenCount,
            finalScore: c.finalScore,
            rankingRank: c.rankingRank,
          })),
      };
    })
    .filter((m): m is NonNullable<typeof m> => m !== null);

  const usedTokens = optimizedChunks.reduce((sum, c) => sum + c.tokenCount, 0);
  const originalTokens = metadata.originalTokens;

  return {
    ...source,
    compressionTraceId,
    sourceRetrievalTraceId: source.retrievalTraceId,
    memories,
    tokenBudget: {
      ...source.tokenBudget,
      usedTokens,
      trimmedTokens: Math.max(0, originalTokens - usedTokens),
    },
    retrievalMetadata: {
      ...source.retrievalMetadata,
      finalChunkCount: optimizedChunks.length,
      deduplicatedChunkCount: optimizedChunks.length,
    },
    compressionMetadata: metadata,
    generatedAt: new Date().toISOString(),
  };
}
