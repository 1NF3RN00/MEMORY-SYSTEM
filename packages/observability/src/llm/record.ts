import type { LlmCallRecord } from "@memory-middleware/shared-types";
import type { LlmCallCollector, RecordLlmCallInput } from "./collector.js";
import { getLlmCallCollector } from "./context.js";

export function recordLlmCall(
  input: RecordLlmCallInput,
  collector?: LlmCallCollector,
): LlmCallRecord | undefined {
  const active = collector ?? getLlmCallCollector();
  if (!active) return undefined;
  return active.record(input);
}
