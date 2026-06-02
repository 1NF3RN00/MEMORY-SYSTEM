export type {
  BatchReplayBenchmarkInput,
  BatchReplayBenchmarkResult,
  BenchmarkPlanningInput,
} from "./benchmark.js";
export {
  benchmarkPlanning,
  batchReplayBenchmark,
} from "./benchmark.js";
export { computeContextualWeighting, applyWeightingToRanking } from "./contextual-weighting.js";
export { decomposeQuery } from "./decomposition.js";
export {
  emitBenchmarkCompleted,
  emitDecompositionCompleted,
  emitMetadataExpansionCompleted,
  emitModeTuningCompleted,
  emitPlanningFailed,
  emitRetrievalModeActivated,
  emitRetrievalPlanGenerated,
  emitWeightingApplied,
} from "./events.js";
export { expandMetadata, type WorkspaceMetadataContext } from "./metadata-expansion.js";
export { computeModeMetrics, tuneRetrievalModes, type TuneRetrievalModesInput } from "./mode-tuning.js";
export {
  createFallbackPlan,
  replayPlanning,
  runPlanningPipeline,
  runPlanningPipelineSync,
  type RunPlanningInput,
  type RunPlanningResult,
} from "./pipeline.js";
export { generateRetrievalHints } from "./retrieval-hints.js";
export {
  getModeDefinition,
  getModeImpacts,
  listRetrievalModes,
  similarityThresholdForPlanningMode,
  topKForPlanningMode,
} from "./retrieval-modes.js";
