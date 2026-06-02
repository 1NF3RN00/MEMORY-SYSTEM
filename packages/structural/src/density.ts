import type { SemanticDensityDetail } from "@memory-middleware/shared-types";

const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
  "being", "have", "has", "had", "do", "does", "did", "will", "would",
  "could", "should", "may", "might", "must", "shall", "can", "this",
  "that", "these", "those", "it", "its", "as", "if", "not", "no",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

/** Informational concentration: ratio of non-stopword unique tokens. */
export function computeInformationalConcentration(content: string): number {
  const tokens = tokenize(content);
  if (tokens.length === 0) return 0;

  const meaningful = tokens.filter((t) => !STOPWORDS.has(t));
  const uniqueMeaningful = new Set(meaningful);

  const concentration = uniqueMeaningful.size / Math.max(tokens.length, 1);
  return Math.min(1, concentration * 1.5);
}

/** Contextual uniqueness: inverse overlap with sibling chunks. */
export function computeContextualUniqueness(
  content: string,
  siblingContents: string[],
): number {
  const tokens = new Set(tokenize(content).filter((t) => !STOPWORDS.has(t)));
  if (tokens.size === 0) return 0.5;

  if (siblingContents.length === 0) return 1;

  let maxOverlap = 0;
  for (const sibling of siblingContents) {
    const siblingTokens = new Set(tokenize(sibling).filter((t) => !STOPWORDS.has(t)));
    if (siblingTokens.size === 0) continue;

    let overlap = 0;
    for (const t of tokens) {
      if (siblingTokens.has(t)) overlap++;
    }
    const ratio = overlap / tokens.size;
    maxOverlap = Math.max(maxOverlap, ratio);
  }

  return Math.max(0, 1 - maxOverlap);
}

/** Combined semantic density score (0–100) with ranking influence hint. */
export function computeSemanticDensity(
  content: string,
  siblingContents: string[],
  rankingWeight = 0.05,
): SemanticDensityDetail {
  const informationalConcentration = computeInformationalConcentration(content);
  const contextualUniqueness = computeContextualUniqueness(content, siblingContents);

  const combinedScore = Math.round(
    (informationalConcentration * 0.6 + contextualUniqueness * 0.4) * 100,
  );

  const rankingInfluence = (combinedScore / 100) * rankingWeight;

  return {
    informationalConcentration: Math.round(informationalConcentration * 1000) / 1000,
    contextualUniqueness: Math.round(contextualUniqueness * 1000) / 1000,
    combinedScore,
    rankingInfluence: Math.round(rankingInfluence * 10000) / 10000,
  };
}

/** Average density across all chunks for memory-level scoring. */
export function averageDensityScore(details: SemanticDensityDetail[]): number {
  if (details.length === 0) return 0;
  return details.reduce((sum, d) => sum + d.combinedScore, 0) / details.length;
}
