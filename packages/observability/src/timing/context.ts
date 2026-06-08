import { AsyncLocalStorage } from "node:async_hooks";
import type { LlmCallCollector } from "../llm/collector.js";
import { runWithLlmCall, runWithLlmCallAsync } from "../llm/context.js";
import { ExecutionTimingCollector } from "./collector.js";

const timingStorage = new AsyncLocalStorage<ExecutionTimingCollector>();

export function runWithTiming<T>(
  collector: ExecutionTimingCollector,
  fn: () => T,
  llmCollector?: LlmCallCollector,
): T {
  return timingStorage.run(collector, () =>
    llmCollector ? runWithLlmCall(llmCollector, fn) : fn(),
  );
}

export async function runWithTimingAsync<T>(
  collector: ExecutionTimingCollector,
  fn: () => Promise<T>,
  llmCollector?: LlmCallCollector,
): Promise<T> {
  return timingStorage.run(collector, () =>
    llmCollector ? runWithLlmCallAsync(llmCollector, fn) : fn(),
  );
}

export function getTimingCollector(): ExecutionTimingCollector | undefined {
  return timingStorage.getStore();
}

export function getOrCreateTimingCollector(requestId: string): ExecutionTimingCollector {
  return timingStorage.getStore() ?? new ExecutionTimingCollector(requestId);
}
