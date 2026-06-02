/** Rough token estimate: ~4 chars per token (matches ingestion). */
export function estimateTokens(text: string): number {
  if (text.length === 0) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}

function tokensToChars(tokens: number): number {
  return tokens * 4;
}

export { tokensToChars };
