import type {
  ContextPackageInput,
  TraceStrippingDecision,
} from "@memory-middleware/shared-types";
import { STRIPPED_MIDDLEWARE_FIELDS } from "@memory-middleware/shared-types";
import { estimateTokens } from "./token-estimator.js";

/** Fields that must never appear in LLM-facing delivery context. */
const OPERATIONAL_FIELD_SET = new Set<string>(STRIPPED_MIDDLEWARE_FIELDS);

export function stripOperationalTraces(
  pkg: ContextPackageInput,
): TraceStrippingDecision {
  const strippedFields = [...OPERATIONAL_FIELD_SET];
  const removedTraceCount = pkg.chunkTraces?.length ?? 0;
  const removedDiagnosticCount =
    (pkg.rankingBreakdown?.length ?? 0) + (pkg.rejectedCandidates?.length ?? 0);

  return {
    strippedFields,
    removedTraceCount,
    removedDiagnosticCount,
  };
}

/** Estimate token weight of raw middleware payload (for diff/comparison only). */
export function estimateMiddlewarePayloadTokens(pkg: ContextPackageInput): number {
  const operationalJson = JSON.stringify({
    rankingBreakdown: pkg.rankingBreakdown,
    chunkTraces: pkg.chunkTraces,
    rejectedCandidates: pkg.rejectedCandidates,
    retrievalMetadata: pkg.retrievalMetadata,
    tokenBudget: pkg.tokenBudget,
    memories: pkg.memories,
  });
  return estimateTokens(operationalJson);
}

export function buildCleanMemorySnapshot(pkg: ContextPackageInput): {
  query: string;
  memories: Array<{
    memoryId: string;
    title: string;
    summary?: string;
    memoryType: string;
    chunks: Array<{ chunkId: string; content: string }>;
  }>;
} {
  return {
    query: pkg.query,
    memories: pkg.memories.map((m) => ({
      memoryId: m.memoryId,
      title: m.title,
      ...(m.summary ? { summary: m.summary } : {}),
      memoryType: m.memoryType,
      chunks: m.chunks.map((c) => ({
        chunkId: c.chunkId,
        content: c.content,
      })),
    })),
  };
}
