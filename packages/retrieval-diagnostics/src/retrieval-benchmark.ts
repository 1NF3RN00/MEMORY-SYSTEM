import type {
  ContextPackage,
  RetrievalBenchmarkEntry,
  RetrievalBenchmarkEvaluation,
  RetrievalBenchmarkSet,
} from "@memory-middleware/shared-types";
import { newUlid } from "@memory-middleware/shared-types";

/** Default known-good retrieval benchmark set for calibration foundation. */
export const DEFAULT_RETRIEVAL_BENCHMARK_SET: Omit<RetrievalBenchmarkSet, "workspaceId"> = {
  setId: "default-calibration-v1",
  label: "Default retrieval calibration benchmarks",
  entries: [
    {
      benchmarkId: "bench-operational-query",
      query: "What operational incidents occurred recently?",
      expectedMemoryIds: [],
      minimumPrecision: 0.5,
      minimumRecall: 0.3,
    },
    {
      benchmarkId: "bench-policy-query",
      query: "What are the compliance and policy decisions?",
      expectedMemoryIds: [],
      minimumPrecision: 0.55,
      minimumRecall: 0.35,
    },
    {
      benchmarkId: "bench-architecture-query",
      query: "Describe the system architecture and technical design",
      expectedMemoryIds: [],
      minimumPrecision: 0.5,
      minimumRecall: 0.3,
    },
  ],
  createdAt: new Date().toISOString(),
};

export function createWorkspaceBenchmarkSet(workspaceId: string): RetrievalBenchmarkSet {
  return {
    ...DEFAULT_RETRIEVAL_BENCHMARK_SET,
    workspaceId,
    setId: newUlid(),
    createdAt: new Date().toISOString(),
  };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Evaluate retrieval against a known-good benchmark entry. */
export function evaluateRetrievalBenchmark(
  entry: RetrievalBenchmarkEntry,
  contextPackage: ContextPackage,
  retrievalTraceId: string,
): RetrievalBenchmarkEvaluation {
  const retrievedMemoryIds = [...new Set(contextPackage.memories.map((m) => m.memoryId))];
  const retrievedChunkIds = contextPackage.memories.flatMap((m) =>
    m.chunks.map((c) => c.chunkId),
  );

  const expectedSet = new Set(entry.expectedMemoryIds);
  const retrievedSet = new Set(retrievedMemoryIds);

  const truePositives = entry.expectedMemoryIds.filter((id) => retrievedSet.has(id));
  const missedMemoryIds = entry.expectedMemoryIds.filter((id) => !retrievedSet.has(id));
  const unexpectedMemoryIds = retrievedMemoryIds.filter((id) => !expectedSet.has(id));

  const precision =
    expectedSet.size === 0
      ? retrievedMemoryIds.length > 0
        ? clamp01(
            contextPackage.chunkTraces
              .filter((c) => c.tokenBudgetDecision === "included")
              .reduce((sum, c) => sum + c.semanticSimilarity, 0) /
              Math.max(1, contextPackage.chunkTraces.filter((c) => c.tokenBudgetDecision === "included").length),
          )
        : 0
      : truePositives.length / Math.max(1, retrievedMemoryIds.length);

  const recall =
    expectedSet.size === 0
      ? retrievedMemoryIds.length > 0
        ? 0.5
        : 0
      : truePositives.length / expectedSet.size;

  const includedTraces = contextPackage.chunkTraces.filter(
    (c) => c.tokenBudgetDecision === "included",
  );
  const rankingScore =
    includedTraces.length > 0
      ? clamp01(
          includedTraces.reduce((sum, c) => sum + c.finalScore, 0) / includedTraces.length,
        )
      : 0;

  const usedTokens = contextPackage.tokenBudget.usedTokens;
  const maxTokens = contextPackage.tokenBudget.maxTokens;
  const deliveryScore = clamp01(
    usedTokens > 0 && maxTokens > 0 ? (usedTokens / maxTokens) * rankingScore : rankingScore,
  );

  if (entry.expectedChunkIds?.length) {
    const expectedChunks = new Set(entry.expectedChunkIds);
    const chunkHits = retrievedChunkIds.filter((id) => expectedChunks.has(id)).length;
    const chunkRecall = chunkHits / entry.expectedChunkIds.length;
    return {
      benchmarkId: entry.benchmarkId,
      query: entry.query,
      retrievalTraceId,
      precision: clamp01((precision + chunkRecall) / 2),
      recall: clamp01((recall + chunkRecall) / 2),
      rankingScore,
      deliveryScore,
      expectedMemoryIds: entry.expectedMemoryIds,
      retrievedMemoryIds,
      missedMemoryIds,
      unexpectedMemoryIds,
      executedAt: new Date().toISOString(),
    };
  }

  return {
    benchmarkId: entry.benchmarkId,
    query: entry.query,
    retrievalTraceId,
    precision: clamp01(precision),
    recall: clamp01(recall),
    rankingScore,
    deliveryScore,
    expectedMemoryIds: entry.expectedMemoryIds,
    retrievedMemoryIds,
    missedMemoryIds,
    unexpectedMemoryIds,
    executedAt: new Date().toISOString(),
  };
}

/** Evaluate full benchmark set against a context package. */
export function evaluateBenchmarkSet(
  benchmarkSet: RetrievalBenchmarkSet,
  query: string,
  contextPackage: ContextPackage,
  retrievalTraceId: string,
): RetrievalBenchmarkEvaluation | null {
  const entry = benchmarkSet.entries.find(
    (e) => e.query.toLowerCase() === query.toLowerCase(),
  );
  if (!entry) return null;
  return evaluateRetrievalBenchmark(entry, contextPackage, retrievalTraceId);
}
