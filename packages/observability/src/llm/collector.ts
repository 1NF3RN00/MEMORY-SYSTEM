import type { LlmCallAudit, LlmCallRecord } from "@memory-middleware/shared-types";
import { estimateLlmCostUsd } from "./pricing.js";
import { isoNow } from "../timing/hrtime.js";

export interface RecordLlmCallInput {
  operation: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
}

export class LlmCallCollector {
  private readonly requestId: string;
  private readonly calls: LlmCallRecord[] = [];

  constructor(requestId: string) {
    this.requestId = requestId;
  }

  record(input: RecordLlmCallInput): LlmCallRecord {
    const record: LlmCallRecord = {
      operation: input.operation,
      model: input.model,
      promptTokens: input.promptTokens,
      completionTokens: input.completionTokens,
      latencyMs: input.latencyMs,
      costUsd: estimateLlmCostUsd(input.model, input.promptTokens, input.completionTokens),
      timestamp: isoNow(),
    };
    this.calls.push(record);
    return record;
  }

  toAudit(): LlmCallAudit {
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let totalLatencyMs = 0;
    let totalCostUsd = 0;

    for (const call of this.calls) {
      totalPromptTokens += call.promptTokens;
      totalCompletionTokens += call.completionTokens;
      totalLatencyMs += call.latencyMs;
      totalCostUsd += call.costUsd;
    }

    return {
      requestId: this.requestId,
      totalPromptTokens,
      totalCompletionTokens,
      totalLatencyMs,
      totalCostUsd: Math.round(totalCostUsd * 1_000_000) / 1_000_000,
      calls: [...this.calls],
    };
  }
}
