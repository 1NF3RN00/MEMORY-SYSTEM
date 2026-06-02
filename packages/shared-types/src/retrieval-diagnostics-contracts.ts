/**
 * Retrieval diagnostics + system calibration contracts.
 * Deterministic signal engineering — no autonomous optimization.
 */

import type { BenchmarkComparisonResult } from "./historian-contracts.js";
import type { ReplaySnapshot } from "./historian-contracts.js";

export type DiagnosticSeverity = "low" | "medium" | "high";

/** Configurable threshold window modes — deterministic and replayable. */
export type CalibrationThresholdMode = "strict" | "balanced" | "exploratory" | "calibration";

export const DEFAULT_THRESHOLD_MODE_TOP_K: Record<CalibrationThresholdMode, number> = {
  strict: 15,
  balanced: 30,
  exploratory: 60,
  calibration: 120,
};

export const DEFAULT_THRESHOLD_MODE_DELTAS: Record<CalibrationThresholdMode, number> = {
  strict: 0.05,
  balanced: 0,
  exploratory: -0.05,
  calibration: -0.1,
};

export type PipelineStageName =
  | "query"
  | "preprocessing"
  | "decomposition"
  | "metadata_expansion"
  | "retrieval"
  | "ranking"
  | "relationships"
  | "compression"
  | "rendering"
  | "delivery";

export interface RetrievalQualityMetrics {
  retrievalPrecision: number;
  retrievalBreadth: number;
  semanticCohesion: number;
  contextualDensity: number;
  rankingStability: number;
  relationshipUsefulness: number;
  chunkQuality: number;
  tokenEfficiency: number;
  compressionIntegrity: number;
  renderingQuality: number;
}

export interface DetectedProblem {
  stage: PipelineStageName;
  severity: DiagnosticSeverity;
  issue: string;
  recommendation: string;
}

export interface RetrievalSystemReport {
  reportId: string;
  retrievalTraceId: string;
  query: string;
  metrics: RetrievalQualityMetrics;
  detectedProblems: DetectedProblem[];
  generatedAt: string;
}

export interface QueryDiagnostics {
  decompositionQuality: number;
  preprocessingEffectiveness: number;
  metadataExpansionQuality: number;
  keywordCount: number;
  normalizedQueryLength: number;
  issues: string[];
}

export interface RetrievalDiagnostics {
  candidateQuality: number;
  retrievalBreadth: number;
  thresholdImpact: number;
  missCount: number;
  rejectedBelowThreshold: number;
  includedCount: number;
  issues: string[];
}

export interface RankingDiagnostics {
  semanticSimilarityImpact: number;
  boostImpact: number;
  weightingBalance: number;
  instabilityScore: number;
  topScoreSpread: number;
  issues: string[];
}

export interface ChunkDiagnostics {
  averageChunkSize: number;
  semanticFragmentation: number;
  hierarchyPreservation: number;
  adjacencyEffectiveness: number;
  trimmedCount: number;
  issues: string[];
}

export interface RelationshipDiagnostics {
  neighborUsefulness: number;
  relationshipPollution: number;
  confidenceEffectiveness: number;
  augmentationApplied: boolean;
  neighborCount: number;
  positiveImpactCount: number;
  issues: string[];
}

export interface CompressionDiagnostics {
  mergeQuality: number;
  tokenSavings: number;
  fidelityPreservation: number;
  mergeCount: number;
  trimCount: number;
  issues: string[];
}

export interface RenderingDiagnostics {
  hierarchyPreservation: number;
  semanticCleanliness: number;
  contextualReadability: number;
  tokenDensityScore: number;
  issues: string[];
}

export interface TraceStageAnalysis {
  stage: PipelineStageName;
  latencyMs: number;
  status: "completed" | "failed" | "skipped" | "not_observed";
  score: number;
  summary: string;
  details: Record<string, unknown>;
}

export interface FullTraceAnalysis {
  retrievalTraceId: string;
  query: string;
  stages: TraceStageAnalysis[];
  queryDiagnostics: QueryDiagnostics;
  retrievalDiagnostics: RetrievalDiagnostics;
  rankingDiagnostics: RankingDiagnostics;
  chunkDiagnostics: ChunkDiagnostics;
  relationshipDiagnostics: RelationshipDiagnostics;
  compressionDiagnostics: CompressionDiagnostics;
  renderingDiagnostics: RenderingDiagnostics;
  generatedAt: string;
}

export interface RetrievalCalibrationControls {
  semanticThreshold: number;
  retrievalBreadth: number;
  topK: number;
  precisionWeighting: number;
  /** Dynamic threshold window mode */
  thresholdMode: CalibrationThresholdMode;
  /** Mode-specific top-K overrides (0 = use computed default from thresholdMode) */
  topKStrict: number;
  topKBalanced: number;
  topKExploratory: number;
  topKCalibration: number;
  /** Breadth multiplier applied to mode top-K */
  breadthMultiplier: number;
}

export interface RankingCalibrationControls {
  recencyWeighting: number;
  semanticDensityWeighting: number;
  reinforcementWeighting: number;
  importanceWeighting: number;
}

export interface ChunkingCalibrationControls {
  chunkSize: number;
  hierarchySensitivity: number;
  adjacencyPreservation: number;
}

export interface RelationshipCalibrationControls {
  confidenceThreshold: number;
  neighborLimit: number;
  augmentationWeighting: number;
}

export interface CompressionCalibrationControls {
  fidelityAggressiveness: number;
  mergeSensitivity: number;
  summarizationThreshold: number;
}

export interface RenderingCalibrationControls {
  hierarchyPreservation: number;
  contextualGrouping: number;
  deliveryDensity: number;
}

export interface SystemCalibrationConfig {
  retrieval: RetrievalCalibrationControls;
  ranking: RankingCalibrationControls;
  chunking: ChunkingCalibrationControls;
  relationships: RelationshipCalibrationControls;
  compression: CompressionCalibrationControls;
  rendering: RenderingCalibrationControls;
}

export interface CalibrationChangeRecord {
  changeId: string;
  workspaceId: string;
  section: keyof SystemCalibrationConfig;
  field: string;
  previousValue: number;
  newValue: number;
  changedAt: string;
  changedBy?: string;
  benchmarkTraceId?: string;
  retrievalImpact?: Partial<RetrievalQualityMetrics>;
}

export interface CalibrationView {
  workspaceId: string;
  config: SystemCalibrationConfig;
  defaults: SystemCalibrationConfig;
  history: CalibrationChangeRecord[];
}

export interface CalibrationPatchRequest {
  workspaceId: string;
  section: keyof SystemCalibrationConfig;
  values: Partial<
    | RetrievalCalibrationControls
    | RankingCalibrationControls
    | ChunkingCalibrationControls
    | RelationshipCalibrationControls
    | CompressionCalibrationControls
    | RenderingCalibrationControls
  >;
  /** Optional trace to benchmark impact after applying calibration */
  benchmarkTraceId?: string;
}

export interface CalibrationBenchmarkRequest {
  workspaceId: string;
  retrievalTraceId: string;
  calibrationOverrides?: Partial<SystemCalibrationConfig>;
  rerunRetrieval?: boolean;
  rerunCompression?: boolean;
  rerunRendering?: boolean;
}

export interface CalibrationBenchmarkResult {
  benchmarkId: string;
  retrievalTraceId: string;
  workspaceId: string;
  beforeMetrics: RetrievalQualityMetrics;
  afterMetrics: RetrievalQualityMetrics;
  metricDeltas: Partial<RetrievalQualityMetrics>;
  comparison?: BenchmarkComparisonResult;
  calibrationApplied: Partial<SystemCalibrationConfig>;
  /** Calibration values before benchmark */
  previousCalibration?: Partial<SystemCalibrationConfig>;
  /** Retrieval benchmark evaluation when benchmark set provided */
  benchmarkEvaluation?: RetrievalBenchmarkEvaluation;
  executedAt: string;
}

export interface WorkspaceDiagnosticsSummary {
  workspaceId: string;
  traceCount: number;
  averageMetrics: RetrievalQualityMetrics;
  problemFrequency: Record<PipelineStageName, number>;
  recentReports: RetrievalSystemReport[];
  generatedAt: string;
}

export interface SignalQualityView {
  retrievalTraceId: string;
  query: string;
  contextualDensity: number;
  semanticCohesion: number;
  relationshipUsefulness: number;
  tokenEfficiency: number;
  signalToNoiseRatio: number;
  /** Deterministic signal enrichment scores */
  semanticRichness: number;
  operationalDensity: number;
  contextualSpecificity: number;
  retrievalAnchorQuality: number;
  generatedAt: string;
}

/** Score distribution bucket for retrieval breadth analysis. */
export interface ScoreHistogramBucket {
  minScore: number;
  maxScore: number;
  count: number;
  rejectedCount: number;
  acceptedCount: number;
}

/** Retrieval breadth and rejection distribution analysis. */
export interface RetrievalBreadthAnalysis {
  retrievalTraceId: string;
  candidateCount: number;
  acceptedCount: number;
  rejectedCount: number;
  thresholdCutoff: number;
  breadthScore: number;
  rejectionConcentration: number;
  scoreHistogram: ScoreHistogramBucket[];
  semanticClusters: Array<{ label: string; chunkCount: number; avgScore: number }>;
  collapseDetected: boolean;
  generatedAt: string;
}

/** Candidate rejection analysis for calibration dashboard. */
export interface CandidateRejectionAnalysis {
  rejectedBelowThreshold: number;
  rejectedTokenBudget: number;
  rejectedDeduplication: number;
  thresholdDistribution: ScoreHistogramBucket[];
  similarityCurve: Array<{ score: number; cumulativeAccepted: number; cumulativeRejected: number }>;
}

/** Metadata expansion quality analysis. */
export interface MetadataExpansionAnalysis {
  enrichmentQuality: number;
  metadataUsefulness: number;
  expansionContribution: number;
  surfaceTermCount: number;
  hierarchyTermCount: number;
  domainTermCount: number;
}

/** Known-good retrieval benchmark entry. */
export interface RetrievalBenchmarkEntry {
  benchmarkId: string;
  query: string;
  expectedMemoryIds: string[];
  expectedChunkIds?: string[];
  minimumPrecision?: number;
  minimumRecall?: number;
}

/** Retrieval benchmark evaluation result. */
export interface RetrievalBenchmarkEvaluation {
  benchmarkId: string;
  query: string;
  retrievalTraceId: string;
  precision: number;
  recall: number;
  rankingScore: number;
  deliveryScore: number;
  expectedMemoryIds: string[];
  retrievedMemoryIds: string[];
  missedMemoryIds: string[];
  unexpectedMemoryIds: string[];
  executedAt: string;
}

export interface RetrievalBenchmarkSet {
  setId: string;
  workspaceId: string;
  label: string;
  entries: RetrievalBenchmarkEntry[];
  createdAt: string;
}

export interface BuildReportInput {
  snapshot: ReplaySnapshot;
  relationshipAugmentation?: {
    augmentationApplied: boolean;
    neighborCount: number;
    rankingImpacts: Array<{ previousScore: number; augmentedScore: number }>;
  };
  rankingComparison?: BenchmarkComparisonResult;
}

export const DEFAULT_SYSTEM_CALIBRATION: SystemCalibrationConfig = {
  retrieval: {
    semanticThreshold: 0.55,
    retrievalBreadth: 1.0,
    topK: 24,
    precisionWeighting: 1.0,
    thresholdMode: "balanced",
    topKStrict: 15,
    topKBalanced: 30,
    topKExploratory: 60,
    topKCalibration: 120,
    breadthMultiplier: 1.0,
  },
  ranking: {
    recencyWeighting: 0.08,
    semanticDensityWeighting: 0.05,
    reinforcementWeighting: 0.06,
    importanceWeighting: 0.12,
  },
  chunking: {
    chunkSize: 512,
    hierarchySensitivity: 0.75,
    adjacencyPreservation: 0.8,
  },
  relationships: {
    confidenceThreshold: 0.55,
    neighborLimit: 8,
    augmentationWeighting: 0.04,
  },
  compression: {
    fidelityAggressiveness: 0.3,
    mergeSensitivity: 0.75,
    summarizationThreshold: 0.85,
  },
  rendering: {
    hierarchyPreservation: 0.85,
    contextualGrouping: 0.7,
    deliveryDensity: 0.6,
  },
};

export const RETRIEVAL_DIAGNOSTICS_EVENT_TYPES = {
  REPORT_GENERATED: "diagnostics.report.generated",
  CALIBRATION_CHANGED: "diagnostics.calibration.changed",
  CALIBRATION_BENCHMARK_EXECUTED: "diagnostics.calibration.benchmark.executed",
  TRACE_ANALYSIS_COMPLETED: "diagnostics.trace.analysis.completed",
} as const;

export type RetrievalDiagnosticsEventType =
  (typeof RETRIEVAL_DIAGNOSTICS_EVENT_TYPES)[keyof typeof RETRIEVAL_DIAGNOSTICS_EVENT_TYPES];
