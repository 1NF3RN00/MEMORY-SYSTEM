import type { CompressionRuntimeConfig, FidelityMode } from "./compression-contracts.js";
import type { HistorianRetentionConfig } from "./historian-contracts.js";
import type { RetrievalRuntimeConfig } from "./retrieval-contracts.js";

export interface WorkspaceRetrievalConfig {
  default_strategy: string;
  token_budget_default: number;
  /** Optional Sprint 2 ranking/vector/dedup overrides (merged with defaults). */
  runtime?: Partial<RetrievalRuntimeConfig>;
}

export interface WorkspaceCompressionConfig {
  default_fidelity_mode: FidelityMode;
  default_nuance_preservation: number;
  default_token_optimization: number;
  /** Optional Sprint 3 compression overrides (merged with defaults). */
  runtime?: Partial<CompressionRuntimeConfig>;
}

export interface WorkspaceObservabilityConfig {
  trace_enabled: boolean;
  event_logging_enabled: boolean;
}

export interface WorkspaceHistorianConfig {
  retention?: Partial<HistorianRetentionConfig>;
}

export interface WorkspaceConfig {
  workspace_id: string;
  name: string;
  slug: string;
  retrieval: WorkspaceRetrievalConfig;
  compression?: WorkspaceCompressionConfig;
  observability: WorkspaceObservabilityConfig;
  historian?: WorkspaceHistorianConfig;
}
