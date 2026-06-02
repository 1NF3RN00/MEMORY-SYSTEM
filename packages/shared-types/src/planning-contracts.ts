/**
 * Sprint 6 — advanced preprocessing and retrieval planning contracts.
 */

export type PlanningRetrievalMode =
  | "precision"
  | "expanded"
  | "exploratory"
  | "incident-response";

export interface WeightingAdjustments {
  operational: number;
  recency: number;
  semanticDensity: number;
  reinforcement: number;
}

export interface PlanningMetadataExpansion {
  tags: string[];
  relationships: string[];
  operationalDomains: string[];
}

export interface QueryDecomposition {
  operationalConcepts: string[];
  entities: string[];
  domains: string[];
  timeReferences: string[];
  contextualPriorities: string[];
}

export interface ExpansionReason {
  term: string;
  source: "tag" | "relationship" | "semantic_neighbor" | "operational_domain";
  reason: string;
}

export interface PlanningExplainability {
  decompositionReasons: string[];
  expansionReasons: ExpansionReason[];
  weightingReasons: string[];
  modeImpacts: string[];
}

export interface RetrievalPlan {
  planId: string;
  workspaceId: string;
  query: string;
  retrievalMode: PlanningRetrievalMode;
  decomposedConcepts: string[];
  retrievalHints: string[];
  expansionTerms: string[];
  weightingAdjustments: WeightingAdjustments;
  metadataExpansion: PlanningMetadataExpansion;
  generatedAt: string;
  decomposition: QueryDecomposition;
  explainability: PlanningExplainability;
}

export interface PlanningStageRecord {
  stage: string;
  status: "started" | "completed" | "failed";
  startedAt: string;
  completedAt?: string;
  latencyMs?: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface PlanningRequest {
  workspaceId: string;
  query: string;
  retrievalMode?: PlanningRetrievalMode;
}

export interface PlanningReplayInput {
  workspaceId: string;
  query: string;
  retrievalMode: PlanningRetrievalMode;
  capturedAt: string;
}

export interface PlanningReplayResult {
  planId: string;
  originalPlan: RetrievalPlan;
  replayedPlan: RetrievalPlan;
  matches: boolean;
  differences: string[];
  replayedAt: string;
}

export interface RetrievalModeDefinition {
  mode: PlanningRetrievalMode;
  label: string;
  description: string;
  optimizesFor: string[];
  topKMultiplier: number;
  similarityThresholdDelta: number;
  weightingProfile: WeightingAdjustments;
  breadthDescription: string;
  precisionProtection: string;
}

export interface PlanningRuntimeConfig {
  modes: Record<PlanningRetrievalMode, RetrievalModeDefinition>;
  maxExpansionTerms: number;
  maxDecomposedConcepts: number;
  /** Max pollution score before non-precision modes are rejected in tuning. */
  maxPollutionScore?: number;
  /** Min precision retention ratio vs precision baseline for alternate modes. */
  minPrecisionRetention?: number;
}

export type PollutionRisk = "low" | "moderate" | "elevated";

export interface ModeTuningMetrics {
  precisionScore: number;
  pollutionScore: number;
  pollutionRisk: PollutionRisk;
  breadthScore: number;
  expansionTermCount: number;
  expansionTermDeltaVsPrecision: number;
  hintCount: number;
  weightingDeviation: number;
}

export interface ModeTuningEntry {
  mode: PlanningRetrievalMode;
  plan: RetrievalPlan;
  metrics: ModeTuningMetrics;
  precisionIntegrityOk: boolean;
}

export interface ModeTuningResult {
  tuningId: string;
  workspaceId: string;
  query: string;
  recommendedMode: PlanningRetrievalMode;
  recommendationReason: string;
  precisionBaselineMode: PlanningRetrievalMode;
  entries: ModeTuningEntry[];
  precisionIntegrityProtected: boolean;
  generatedAt: string;
}

export interface PlanningBenchmarkMetrics {
  precisionScore: number;
  pollutionScore: number;
  pollutionRisk: PollutionRisk;
  expansionTermCount: number;
  expansionTermDeltaVsPrecision: number;
  weightingDeviation: number;
  determinismMatch: boolean;
  pollutionControlled: boolean;
}

export interface PlanningModeBenchmarkEntry {
  mode: PlanningRetrievalMode;
  metrics: PlanningBenchmarkMetrics;
  plan: RetrievalPlan;
}

export interface PlanningReplayBenchmarkResult {
  benchmarkId: string;
  workspaceId: string;
  query: string;
  planId?: string;
  replayMatches: boolean;
  replayDifferences: string[];
  modeBenchmarks: PlanningModeBenchmarkEntry[];
  selectedMode: PlanningRetrievalMode;
  precisionBaseline: PlanningBenchmarkMetrics;
  selectedModeMetrics: PlanningBenchmarkMetrics;
  precisionImprovedVsBaseline: boolean;
  pollutionControlled: boolean;
  summary: string;
  executedAt: string;
}

export interface PlanningTuningRequest {
  workspaceId: string;
  query: string;
}

export interface PlanningBenchmarkRequest {
  workspaceId: string;
  query: string;
  retrievalMode?: PlanningRetrievalMode;
  planId?: string;
}

export const PLANNING_EVENT_TYPES = {
  DECOMPOSITION_COMPLETED: "planning.decomposition.completed",
  METADATA_EXPANSION_COMPLETED: "planning.metadata_expansion.completed",
  RETRIEVAL_PLAN_GENERATED: "planning.retrieval_plan.generated",
  WEIGHTING_APPLIED: "planning.weighting.applied",
  RETRIEVAL_MODE_ACTIVATED: "planning.retrieval_mode.activated",
  PLANNING_FAILED: "planning.failed",
  MODE_TUNING_COMPLETED: "planning.mode_tuning.completed",
  BENCHMARK_COMPLETED: "planning.benchmark.completed",
} as const;

export type PlanningEventType =
  (typeof PLANNING_EVENT_TYPES)[keyof typeof PLANNING_EVENT_TYPES];

export const DEFAULT_PLANNING_RUNTIME_CONFIG: PlanningRuntimeConfig = {
  maxExpansionTerms: 24,
  maxDecomposedConcepts: 12,
  maxPollutionScore: 0.65,
  minPrecisionRetention: 0.85,
  modes: {
    precision: {
      mode: "precision",
      label: "Precision",
      description: "Highest semantic relevance with minimal retrieval pollution.",
      optimizesFor: ["semantic relevance", "low pollution", "minimal irrelevant context"],
      topKMultiplier: 1,
      similarityThresholdDelta: 0,
      weightingProfile: { operational: 1, recency: 1, semanticDensity: 1, reinforcement: 1 },
      breadthDescription: "Minimal breadth — strict similarity threshold, smallest candidate pool.",
      precisionProtection: "Baseline mode — no threshold reduction or aggressive expansion.",
    },
    expanded: {
      mode: "expanded",
      label: "Expanded",
      description: "Broader contextual recall with controlled breadth increase.",
      optimizesFor: ["contextual recall", "coverage", "adjacent context"],
      topKMultiplier: 2,
      similarityThresholdDelta: -0.03,
      weightingProfile: { operational: 1.05, recency: 1.1, semanticDensity: 0.95, reinforcement: 1.05 },
      breadthDescription: "Moderate breadth increase — expanded top-K with slight threshold relaxation.",
      precisionProtection: "Threshold delta capped at -0.03; semantic similarity remains primary rank driver.",
    },
    exploratory: {
      mode: "exploratory",
      label: "Exploratory",
      description: "Relationship discovery and semantic neighborhood exploration.",
      optimizesFor: ["relationship discovery", "contextual adjacency", "semantic neighborhoods"],
      topKMultiplier: 1.75,
      similarityThresholdDelta: -0.02,
      weightingProfile: { operational: 1, recency: 1, semanticDensity: 1.15, reinforcement: 1.1 },
      breadthDescription: "Relationship-assisted expansion enabled; neighbor hints prioritized in planning.",
      precisionProtection: "Expansion limited to metadata-grounded terms; no speculative branches.",
    },
    "incident-response": {
      mode: "incident-response",
      label: "Incident Response",
      description: "Operational priority with retrieval urgency and recency emphasis.",
      optimizesFor: ["operational relevance", "retrieval speed", "high-priority context"],
      topKMultiplier: 1.25,
      similarityThresholdDelta: -0.01,
      weightingProfile: { operational: 1.25, recency: 1.3, semanticDensity: 1, reinforcement: 1.15 },
      breadthDescription: "Focused pool with operational and recency weighting boosts.",
      precisionProtection: "Smaller candidate pool than expanded; operational boost does not override similarity ranking.",
    },
  },
};
