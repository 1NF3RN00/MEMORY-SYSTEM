/**
 * Deterministic token estimation (V1): 4 characters per token, ceiling division.
 * Reproducible across runs without external tokenizer dependencies.
 */
export function estimateTokens(text: string): number {
  if (text.length === 0) return 0;
  return Math.ceil(text.length / 4);
}
