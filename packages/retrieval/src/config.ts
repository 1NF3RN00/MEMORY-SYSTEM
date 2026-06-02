import {
  DEFAULT_RETRIEVAL_RUNTIME_CONFIG,
  type RetrievalRuntimeConfig,
  type WorkspaceConfig,
} from "@memory-middleware/shared-types";

export function mergeRetrievalConfig(
  workspaceConfig?: WorkspaceConfig | null,
): RetrievalRuntimeConfig {
  const runtime = workspaceConfig?.retrieval?.runtime;
  if (!runtime) return { ...DEFAULT_RETRIEVAL_RUNTIME_CONFIG };

  return {
    ranking: { ...DEFAULT_RETRIEVAL_RUNTIME_CONFIG.ranking, ...runtime.ranking },
    vector: { ...DEFAULT_RETRIEVAL_RUNTIME_CONFIG.vector, ...runtime.vector },
    deduplication: {
      ...DEFAULT_RETRIEVAL_RUNTIME_CONFIG.deduplication,
      ...runtime.deduplication,
    },
  };
}
