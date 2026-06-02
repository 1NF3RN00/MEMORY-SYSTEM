/**
 * Context delivery + rendering contracts — transforms operational middleware state
 * into clean, semantically optimized inference context for downstream LLMs.
 */

import type { OptimizedContextPackage } from "./compression-contracts.js";
import type { ContextPackage } from "./retrieval-contracts.js";

export type DeliveryMode = "concise" | "balanced" | "detailed" | "operational";

export type ContextPackageInput = ContextPackage | OptimizedContextPackage;

export interface RenderedSection {
  title?: string;
  content: string;
  sourceMemoryIds: string[];
}

export interface DeliveryContext {
  deliveryId: string;
  retrievalTraceId: string;
  mode: DeliveryMode;
  renderedContext: string;
  renderedSections: RenderedSection[];
  tokenCount: number;
  generatedAt: string;
}

export type ContextGroupingReason =
  | "topic"
  | "section_hierarchy"
  | "semantic_similarity"
  | "operational_domain";

export interface ContextGroupingDecision {
  groupId: string;
  groupLabel: string;
  groupingReason: ContextGroupingReason;
  memoryIds: string[];
  chunkIds: string[];
}

export interface HierarchyFormattingDecision {
  preservedHeadings: string[];
  bulletGroups: number;
  hierarchyDepth: number;
}

export interface TraceStrippingDecision {
  strippedFields: string[];
  removedTraceCount: number;
  removedDiagnosticCount: number;
}

export interface DeliveryOptimizationDecision {
  redundancyRemoved: number;
  tokenDensityScore: number;
  readabilityScore: number;
}

export interface RenderingDecisions {
  grouping: ContextGroupingDecision[];
  hierarchy: HierarchyFormattingDecision;
  traceStripping: TraceStrippingDecision;
  deliveryOptimization: DeliveryOptimizationDecision;
  deliveryMode: DeliveryMode;
}

export interface ContextRenderRelationshipHint {
  sourceMemoryId: string;
  targetMemoryId: string;
  weight: number;
}

export interface ContextRenderRequest {
  workspaceId: string;
  retrievalTraceId?: string;
  compressionTraceId?: string;
  contextPackage?: ContextPackageInput;
  mode?: DeliveryMode;
  /** Adjacency hints for grouping — never override semantic precision. */
  relationshipHints?: ContextRenderRelationshipHint[];
}

export interface ContextRenderStageRecord {
  stage: string;
  status: "started" | "completed" | "failed";
  startedAt: string;
  completedAt?: string;
  latencyMs?: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface ContextRenderTraceView {
  deliveryId: string;
  workspaceId: string;
  retrievalTraceId: string;
  compressionTraceId?: string;
  status: "pending" | "processing" | "completed" | "failed";
  mode: DeliveryMode;
  stages: ContextRenderStageRecord[];
  originalContextPackage?: ContextPackageInput;
  deliveryContext?: DeliveryContext;
  renderingDecisions?: RenderingDecisions;
  error?: string;
  createdAt: string;
  completedAt?: string;
}

export interface ContextDeliveryCompareRequest {
  deliveryIdA: string;
  deliveryIdB: string;
}

export interface ContextDeliveryCompareResult {
  deliveryIdA: string;
  deliveryIdB: string;
  modeA: DeliveryMode;
  modeB: DeliveryMode;
  tokenCountA: number;
  tokenCountB: number;
  tokenDelta: number;
  sectionCountA: number;
  sectionCountB: number;
  rawMiddlewareTokenEstimate: number;
  renderedTokenEstimate: number;
  strippedFields: string[];
  diffSummary: string;
}

export interface HistorianDeliveryArtifact {
  deliveryId: string;
  retrievalTraceId: string;
  compressionTraceId?: string;
  mode: DeliveryMode;
  deliveryContext: DeliveryContext;
  renderingDecisions: RenderingDecisions;
  stages: ContextRenderStageRecord[];
}

export const CONTEXT_DELIVERY_EVENT_TYPES = {
  RENDERING_STARTED: "rendering_started",
  GROUPING_COMPLETED: "grouping_completed",
  TRACE_STRIPPING_COMPLETED: "trace_stripping_completed",
  DELIVERY_GENERATED: "delivery_generated",
  TOKEN_OPTIMIZATION_COMPLETED: "token_optimization_completed",
  RENDERING_FAILED: "rendering_failed",
} as const;

export type ContextDeliveryEventType =
  (typeof CONTEXT_DELIVERY_EVENT_TYPES)[keyof typeof CONTEXT_DELIVERY_EVENT_TYPES];

export const DEFAULT_DELIVERY_MODE: DeliveryMode = "balanced";

export const STRIPPED_MIDDLEWARE_FIELDS = [
  "rankingBreakdown",
  "chunkTraces",
  "rejectedCandidates",
  "retrievalMetadata",
  "tokenBudget",
  "compressionMetadata",
  "compressionTraceId",
  "sourceRetrievalTraceId",
] as const;
