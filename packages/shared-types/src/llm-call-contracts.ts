export type LlmOperation =
  | "embedding"
  | "compression_abstraction"
  | "workflow_analysis";

export interface LlmCallRecord {
  operation: LlmOperation | string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  costUsd: number;
  timestamp: string;
}

export interface LlmCallAudit {
  requestId: string;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalLatencyMs: number;
  totalCostUsd: number;
  calls: LlmCallRecord[];
}
