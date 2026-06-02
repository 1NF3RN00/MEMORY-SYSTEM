import type { BuildReportInput, ReplaySnapshot } from "@memory-middleware/shared-types";

/** Older replay snapshots may omit artifact arrays — normalize before analysis. */
export function normalizeReplaySnapshot(snapshot: ReplaySnapshot): ReplaySnapshot {
  const pkg = snapshot.contextPackage;
  return {
    ...snapshot,
    compressionArtifacts: snapshot.compressionArtifacts ?? [],
    deliveryArtifacts: snapshot.deliveryArtifacts ?? [],
    contextPackage: {
      ...pkg,
      chunkTraces: pkg.chunkTraces ?? [],
      rejectedCandidates: pkg.rejectedCandidates ?? [],
      memories: pkg.memories ?? [],
      rankingBreakdown: pkg.rankingBreakdown ?? [],
      tokenBudget: pkg.tokenBudget ?? { maxTokens: 0, usedTokens: 0, trimmedTokens: 0 },
      retrievalMetadata: pkg.retrievalMetadata ?? {
        retrievalLatencyMs: 0,
        retrievedChunkCount: 0,
        deduplicatedChunkCount: 0,
        finalChunkCount: 0,
      },
    },
  };
}

export function normalizeReportInput(input: BuildReportInput): BuildReportInput {
  return {
    ...input,
    snapshot: normalizeReplaySnapshot(input.snapshot),
  };
}
