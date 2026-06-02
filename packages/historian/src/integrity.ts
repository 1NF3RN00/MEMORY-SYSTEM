import { createHash } from "node:crypto";
import type { ReplaySnapshot } from "@memory-middleware/shared-types";

/** Deterministic integrity hash over replay-critical fields (excludes replayId/timestamp). */
export function computeReplayIntegrityHash(
  snapshot: Omit<ReplaySnapshot, "integrityHash" | "replayId" | "replayTimestamp">,
): string {
  const canonical = JSON.stringify({
    retrievalTraceId: snapshot.retrievalTraceId,
    workspaceId: snapshot.workspaceId,
    originalQuery: snapshot.originalQuery,
    retrievalMode: snapshot.retrievalMode,
    tokenBudget: snapshot.tokenBudget,
    stages: snapshot.stages,
    contextPackage: snapshot.contextPackage,
    compressionArtifacts: snapshot.compressionArtifacts,
    deliveryArtifacts: snapshot.deliveryArtifacts,
    rankingBreakdowns: snapshot.rankingBreakdowns,
    preprocessedQuery: snapshot.preprocessedQuery,
  });

  return createHash("sha256").update(canonical).digest("hex");
}

export function validateReplayIntegrity(snapshot: ReplaySnapshot): boolean {
  const { integrityHash, replayId, replayTimestamp, ...rest } = snapshot;
  const expected = computeReplayIntegrityHash(rest);
  return expected === integrityHash;
}
