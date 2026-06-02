import { estimateTokens } from "@memory-middleware/ingestion";
import type { PreprocessedQuery } from "@memory-middleware/shared-types";

const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "in",
  "on",
  "at",
  "to",
  "for",
  "of",
  "with",
  "by",
  "from",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "must",
  "can",
  "this",
  "that",
  "these",
  "those",
  "it",
  "its",
  "as",
  "about",
  "into",
  "through",
  "during",
  "before",
  "after",
  "above",
  "below",
  "between",
  "under",
  "over",
  "what",
  "which",
  "who",
  "whom",
  "how",
  "when",
  "where",
  "why",
]);

export interface ScopeValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateRetrievalScope(input: {
  workspaceId: string;
  query: string;
  tokenBudget: number;
}): ScopeValidationResult {
  const errors: string[] = [];
  if (!input.workspaceId?.trim()) errors.push("workspaceId is required");
  if (!input.query?.trim()) errors.push("query is required");
  if (!Number.isFinite(input.tokenBudget) || input.tokenBudget <= 0) {
    errors.push("tokenBudget must be a positive number");
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Deterministic query preprocessing — normalization, cleanup, keyword extraction.
 */
export function preprocessQuery(query: string): PreprocessedQuery {
  const normalized = query
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  const tokens = normalized
    .split(/[^a-z0-9]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));

  const keywords = [...new Set(tokens)].sort();

  return {
    normalizedQuery: normalized,
    keywords,
    tokenCount: estimateTokens(normalized),
  };
}
