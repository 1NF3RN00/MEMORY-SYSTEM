/**
 * Deterministic Okapi BM25 scoring for the V2 lexical channel spike.
 * Pure in-memory implementation — no ML, no randomness.
 */

const DEFAULT_K1 = 1.2;
const DEFAULT_B = 0.75;

export interface Bm25Document {
  id: string;
  text: string;
}

export interface Bm25ScoredDocument {
  id: string;
  score: number;
}

export interface Bm25ScoreOptions {
  k1?: number;
  b?: number;
}

/** Tokenize deterministically: lowercase, split on non-alphanumeric, drop empties. */
export function tokenizeForBm25(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0);
}

function termFrequency(tokens: string[], term: string): number {
  let count = 0;
  for (const token of tokens) {
    if (token === term) count += 1;
  }
  return count;
}

/**
 * Score documents with Okapi BM25. Returns sorted descending by score, then id.
 */
export function scoreBm25Documents(
  queryTerms: string[],
  documents: Bm25Document[],
  options: Bm25ScoreOptions = {},
): Bm25ScoredDocument[] {
  const k1 = options.k1 ?? DEFAULT_K1;
  const b = options.b ?? DEFAULT_B;

  const normalizedTerms = [...new Set(queryTerms.map((t) => t.toLowerCase()).filter(Boolean))];
  if (normalizedTerms.length === 0 || documents.length === 0) {
    return documents.map((doc) => ({ id: doc.id, score: 0 }));
  }

  const docTokens = documents.map((doc) => ({
    id: doc.id,
    tokens: tokenizeForBm25(doc.text),
  }));

  const avgDocLength =
    docTokens.reduce((sum, doc) => sum + doc.tokens.length, 0) / docTokens.length || 1;

  const documentFrequency = new Map<string, number>();
  for (const term of normalizedTerms) {
    let df = 0;
    for (const doc of docTokens) {
      if (doc.tokens.includes(term)) df += 1;
    }
    documentFrequency.set(term, df);
  }

  const n = documents.length;
  const scored: Bm25ScoredDocument[] = [];

  for (const doc of docTokens) {
    const docLength = doc.tokens.length;
    let score = 0;

    for (const term of normalizedTerms) {
      const df = documentFrequency.get(term) ?? 0;
      if (df === 0) continue;

      const tf = termFrequency(doc.tokens, term);
      if (tf === 0) continue;

      const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5));
      const lengthNorm = 1 - b + b * (docLength / avgDocLength);
      const tfNorm = (tf * (k1 + 1)) / (tf + k1 * lengthNorm);
      score += idf * tfNorm;
    }

    scored.push({ id: doc.id, score });
  }

  return scored.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}
