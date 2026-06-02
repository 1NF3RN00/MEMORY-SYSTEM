/**
 * Canonical memory object contract.
 * Memory is append-only and versioned — updates create new versions via lineage_id.
 */
export interface MemoryObjectMetadata {
  source_url?: string;
  content_type?: string;
  created_at: string;
  updated_at?: string;
  importance_score?: number;
  freshness_score?: number;
}

export interface MemoryObjectLifecycle {
  archived: boolean;
  stale: boolean;
  decay_score?: number;
}

export interface MemoryObject {
  id: string;
  workspace_id: string;
  lineage_id: string;
  version: number;
  content: string;
  summary?: string;
  metadata: MemoryObjectMetadata;
  lifecycle: MemoryObjectLifecycle;
}
