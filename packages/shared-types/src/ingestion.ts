import type {
  CanonicalMemoryObject,
  IngestionState,
  MemoryType,
  PersistenceMode,
  SourceType,
} from "./canonical-memory-object.js";

export const INGESTION_EVENT_TYPES = {
  INGESTION_STARTED: "ingestion.started",
  NORMALIZATION_COMPLETED: "ingestion.normalization.completed",
  CHUNKING_COMPLETED: "ingestion.chunking.completed",
  EMBEDDING_COMPLETED: "ingestion.embedding.completed",
  EMBEDDING_FAILED: "ingestion.embedding.failed",
  INGESTION_COMPLETED: "ingestion.completed",
  INGESTION_ARCHIVED: "ingestion.archived",
  TEMPORARY_MEMORY_EXPIRED: "ingestion.temporary.expired",
} as const;

export type IngestionEventType =
  (typeof INGESTION_EVENT_TYPES)[keyof typeof INGESTION_EVENT_TYPES];

export interface IngestionStageRecord {
  stage: IngestionState | "normalization" | "embedding";
  status: "pending" | "running" | "completed" | "failed";
  startedAt?: string;
  completedAt?: string;
  latencyMs?: number;
  error?: string;
}

export interface IngestionTraceView {
  traceId: string;
  workspaceId: string;
  memoryId?: string;
  status: IngestionState;
  sourceType: SourceType;
  persistenceMode: PersistenceMode;
  stages: IngestionStageRecord[];
  normalizationTrace?: NormalizationTraceView;
  createdAt: string;
  updatedAt: string;
}

export interface NormalizationTraceView {
  traceId: string;
  strategy: string;
  usedLlm: boolean;
  steps: Array<{
    step: string;
    timestamp: string;
    latencyMs?: number;
  }>;
}

export interface SourceTruthView {
  traceId: string;
  workspaceId: string;
  memoryId?: string;
  rawSource: string;
  crawlerOutput?: Record<string, unknown>;
  normalizationTransformations: Array<{
    step: string;
    inputPreview: string;
    outputPreview: string;
    timestamp: string;
  }>;
  createdAt: string;
}

export interface IngestRequestBody {
  workspaceId: string;
  sourceType: SourceType;
  persistenceMode?: PersistenceMode;
  memoryType?: MemoryType;
  title?: string;
  sourceUrl?: string;
  sourceLabel?: string;
  tags?: string[];
  /** Inline content for text, markdown, json */
  content?: string;
  /** Website URL when sourceType is website */
  url?: string;
  /** Enable optional LLM structuring (interface-based; default false) */
  useLlmStructuring?: boolean;
}

export interface IngestResponseBody {
  traceId: string;
  jobId: string;
  status: IngestionState;
  memoryId?: string;
}

export interface MemoryDetailResponse {
  memory: CanonicalMemoryObject;
}

export interface MemoryChunksResponse {
  memoryId: string;
  chunks: CanonicalMemoryObject["chunks"];
}

export interface IngestionEventsResponse {
  traceId: string;
  events: Array<{
    eventId: string;
    eventType: string;
    timestamp: string;
    severity: string;
    success: boolean;
    latencyMs?: number;
    memoryId?: string;
    metadata: Record<string, unknown>;
  }>;
}

export const DEFAULT_CHUNK_CONFIG = {
  maxTokens: 512,
  overlapTokens: 64,
  chunkingStrategy: "deterministic-fixed-v1",
} as const;

export const EMBEDDING_MODEL_V1 = "text-embedding-3-small";
export const EMBEDDING_VERSION_V1 = "openai-text-embedding-3-small-v1";
export const NORMALIZATION_VERSION_V1 = "deterministic-v1";
