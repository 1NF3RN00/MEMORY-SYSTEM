import type { LlmCallAudit } from "@memory-middleware/shared-types";
import type { Logger } from "../logger.js";
import type { EventEmitter } from "../events/event-emitter.js";

export async function emitLlmCallAudit(
  logger: Logger,
  events: EventEmitter | undefined,
  audit: LlmCallAudit,
  metadata?: Record<string, unknown>,
): Promise<void> {
  if (audit.calls.length === 0) return;

  logger.info(
    {
      event_type: "llm.audit.completed",
      request_id: audit.requestId,
      total_prompt_tokens: audit.totalPromptTokens,
      total_completion_tokens: audit.totalCompletionTokens,
      total_latency_ms: audit.totalLatencyMs,
      total_cost_usd: audit.totalCostUsd,
      call_count: audit.calls.length,
      calls: audit.calls,
      ...metadata,
    },
    "llm.audit.completed",
  );

  if (events) {
    await events.emit({
      event_type: "llm.audit.completed",
      trace_id: audit.requestId,
      metadata: {
        total_prompt_tokens: audit.totalPromptTokens,
        total_completion_tokens: audit.totalCompletionTokens,
        total_latency_ms: audit.totalLatencyMs,
        total_cost_usd: audit.totalCostUsd,
        call_count: audit.calls.length,
        calls: audit.calls,
        ...metadata,
      },
    });
  }
}
