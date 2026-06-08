import { AsyncLocalStorage } from "node:async_hooks";
import { LlmCallCollector } from "./collector.js";

const llmStorage = new AsyncLocalStorage<LlmCallCollector>();

export function runWithLlmCallAsync<T>(
  collector: LlmCallCollector,
  fn: () => Promise<T>,
): Promise<T> {
  return llmStorage.run(collector, fn);
}

export function runWithLlmCall<T>(collector: LlmCallCollector, fn: () => T): T {
  return llmStorage.run(collector, fn);
}

export function getLlmCallCollector(): LlmCallCollector | undefined {
  return llmStorage.getStore();
}

export function getOrCreateLlmCallCollector(requestId: string): LlmCallCollector {
  return llmStorage.getStore() ?? new LlmCallCollector(requestId);
}
