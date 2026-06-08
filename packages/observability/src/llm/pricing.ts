export interface ModelPricing {
  inputPer1M: number;
  outputPer1M: number;
}

/** OpenAI list prices (USD per 1M tokens) — update when provider pricing changes. */
const MODEL_PRICING: Record<string, ModelPricing> = {
  "text-embedding-3-small": { inputPer1M: 0.02, outputPer1M: 0 },
  "text-embedding-3-large": { inputPer1M: 0.13, outputPer1M: 0 },
  "gpt-4o-mini": { inputPer1M: 0.15, outputPer1M: 0.6 },
  "gpt-4o": { inputPer1M: 2.5, outputPer1M: 10 },
  "gpt-4.1-mini": { inputPer1M: 0.4, outputPer1M: 1.6 },
  "gpt-4.1": { inputPer1M: 2, outputPer1M: 8 },
};

const DEFAULT_PRICING: ModelPricing = { inputPer1M: 0.15, outputPer1M: 0.6 };

export function resolveModelPricing(model: string): ModelPricing {
  return MODEL_PRICING[model] ?? DEFAULT_PRICING;
}

export function estimateLlmCostUsd(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const pricing = resolveModelPricing(model);
  const inputCost = (promptTokens / 1_000_000) * pricing.inputPer1M;
  const outputCost = (completionTokens / 1_000_000) * pricing.outputPer1M;
  return roundUsd(inputCost + outputCost);
}

function roundUsd(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
