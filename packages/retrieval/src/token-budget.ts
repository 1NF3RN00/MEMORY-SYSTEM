import type { RejectedCandidate, TokenBudgetDecision } from "@memory-middleware/shared-types";
import type { RankedChunk } from "./ranking.js";

export interface TokenBudgetInput {
  chunks: Array<RankedChunk & { tokenCount: number }>;
  maxTokens: number;
}

export interface TokenBudgetResult {
  included: TokenBudgetInput["chunks"];
  trimmed: TokenBudgetInput["chunks"];
  usedTokens: number;
  trimmedTokens: number;
}

/**
 * Trim-only budgeting: remove lowest-ranked chunks first until within budget.
 */
export function applyTokenBudget(input: TokenBudgetInput): TokenBudgetResult {
  const sorted = [...input.chunks].sort((a, b) => {
    if (a.finalScore !== b.finalScore) return a.finalScore - b.finalScore;
    return a.chunkId.localeCompare(b.chunkId);
  });

  let total = sorted.reduce((sum, c) => sum + c.tokenCount, 0);
  const trimmed: TokenBudgetInput["chunks"] = [];
  const working = [...sorted];

  while (total > input.maxTokens && working.length > 0) {
    const removed = working.shift();
    if (!removed) break;
    trimmed.push(removed);
    total -= removed.tokenCount;
  }

  const included = [...working].sort((a, b) => a.rankingRank - b.rankingRank);

  const trimmedTokens = trimmed.reduce((sum, c) => sum + c.tokenCount, 0);
  const usedTokens = included.reduce((sum, c) => sum + c.tokenCount, 0);

  return { included, trimmed, usedTokens, trimmedTokens };
}

export function tokenBudgetRejections(
  trimmed: Array<RankedChunk & { tokenCount: number }>,
): RejectedCandidate[] {
  return trimmed.map((c) => ({
    memoryId: c.memoryId,
    chunkId: c.chunkId,
    reason: "token_budget_trim",
    detail: `Removed by lowest-ranked trim (rank ${c.rankingRank}, score ${c.finalScore.toFixed(4)})`,
    semanticSimilarity: c.semanticSimilarity,
    finalScore: c.finalScore,
  }));
}

export function tokenBudgetDecision(
  chunkId: string,
  included: RankedChunk[],
  trimmed: RankedChunk[],
): TokenBudgetDecision {
  if (included.some((c) => c.chunkId === chunkId)) return "included";
  if (trimmed.some((c) => c.chunkId === chunkId)) return "trimmed";
  return "rejected_threshold";
}
