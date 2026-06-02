import type {
  PlanningBenchmarkMetrics,
  PlanningModeBenchmarkEntry,
  PlanningReplayBenchmarkResult,
  PlanningRetrievalMode,
  PlanningRuntimeConfig,
  RetrievalPlan,
} from "@memory-middleware/shared-types";
import { DEFAULT_PLANNING_RUNTIME_CONFIG, newUlid } from "@memory-middleware/shared-types";
import { computeModeMetrics, tuneRetrievalModes } from "./mode-tuning.js";
import type { WorkspaceMetadataContext } from "./metadata-expansion.js";
import { replayPlanning, runPlanningPipelineSync } from "./pipeline.js";
import { getModeDefinition } from "./retrieval-modes.js";

function toBenchmarkMetrics(
  mode: PlanningRetrievalMode,
  plan: RetrievalPlan,
  precisionPlan: RetrievalPlan,
  precisionIntegrityOk: boolean,
  determinismMatch: boolean,
  config: PlanningRuntimeConfig,
): PlanningBenchmarkMetrics {
  const modeDef = getModeDefinition(mode, config);
  const modeMetrics = computeModeMetrics(plan, modeDef, precisionPlan, config);
  const precisionModeDef = getModeDefinition("precision", config);
  const precisionMetrics = computeModeMetrics(
    precisionPlan,
    precisionModeDef,
    precisionPlan,
    config,
  );

  const pollutionControlled =
    mode === "precision" ||
    (precisionIntegrityOk &&
      modeMetrics.pollutionScore <= (config.maxPollutionScore ?? 0.65) &&
      modeMetrics.precisionScore >=
        precisionMetrics.precisionScore * (config.minPrecisionRetention ?? 0.85));

  return {
    precisionScore: modeMetrics.precisionScore,
    pollutionScore: modeMetrics.pollutionScore,
    pollutionRisk: modeMetrics.pollutionRisk,
    expansionTermCount: modeMetrics.expansionTermCount,
    expansionTermDeltaVsPrecision: modeMetrics.expansionTermDeltaVsPrecision,
    weightingDeviation: modeMetrics.weightingDeviation,
    determinismMatch,
    pollutionControlled,
  };
}

export interface BenchmarkPlanningInput {
  workspaceId: string;
  query: string;
  retrievalMode?: PlanningRetrievalMode;
  storedPlan?: RetrievalPlan;
  workspaceContext?: WorkspaceMetadataContext;
  config?: PlanningRuntimeConfig;
}

/** Full planning benchmark: replay determinism + cross-mode precision/pollution comparison. */
export function benchmarkPlanning(input: BenchmarkPlanningInput): PlanningReplayBenchmarkResult {
  const config = input.config ?? DEFAULT_PLANNING_RUNTIME_CONFIG;
  const selectedMode = input.retrievalMode ?? input.storedPlan?.retrievalMode ?? "precision";

  const tuning = tuneRetrievalModes({
    workspaceId: input.workspaceId,
    query: input.query,
    ...(input.workspaceContext ? { workspaceContext: input.workspaceContext } : {}),
    config,
  });

  const precisionPlan = tuning.entries.find((e) => e.mode === "precision")!.plan;

  let replayMatches = true;
  let replayDifferences: string[] = [];

  if (input.storedPlan) {
    const replay = replayPlanning(
      input.storedPlan,
      {
        workspaceId: input.workspaceId,
        query: input.query,
        retrievalMode: input.storedPlan.retrievalMode,
        capturedAt: input.storedPlan.generatedAt,
      },
      input.workspaceContext,
      config,
    );
    replayMatches = replay.matches;
    replayDifferences = replay.differences;
  } else {
    const generated = runPlanningPipelineSync({
      request: {
        workspaceId: input.workspaceId,
        query: input.query,
        retrievalMode: selectedMode,
      },
      ...(input.workspaceContext ? { workspaceContext: input.workspaceContext } : {}),
      config,
    });
    const replay = replayPlanning(
      generated.plan,
      {
        workspaceId: input.workspaceId,
        query: input.query,
        retrievalMode: selectedMode,
        capturedAt: generated.plan.generatedAt,
      },
      input.workspaceContext,
      config,
    );
    replayMatches = replay.matches;
    replayDifferences = replay.differences;
  }

  const modeBenchmarks: PlanningModeBenchmarkEntry[] = tuning.entries.map((entry) => ({
    mode: entry.mode,
    plan: entry.plan,
    metrics: toBenchmarkMetrics(
      entry.mode,
      entry.plan,
      precisionPlan,
      entry.precisionIntegrityOk,
      entry.mode === selectedMode ? replayMatches : true,
      config,
    ),
  }));

  const selectedEntry =
    modeBenchmarks.find((e) => e.mode === selectedMode) ?? modeBenchmarks[0]!;
  const precisionBaseline = modeBenchmarks.find((e) => e.mode === "precision")!.metrics;

  const precisionImprovedVsBaseline =
    selectedMode !== "precision" &&
    selectedEntry.metrics.precisionScore > precisionBaseline.precisionScore;

  const pollutionControlled = selectedEntry.metrics.pollutionControlled;

  const summaryParts = [
    replayMatches
      ? "Preprocessing replay is deterministic."
      : `Replay drift detected: ${replayDifferences.join(", ")}.`,
    pollutionControlled
      ? "Pollution remains controlled for the selected mode."
      : "Pollution controls triggered — precision mode recommended.",
    selectedMode === "precision"
      ? "Precision mode active as baseline."
      : `Selected mode "${selectedMode}" precision score ${selectedEntry.metrics.precisionScore.toFixed(3)} vs precision baseline ${precisionBaseline.precisionScore.toFixed(3)}.`,
  ];

  return {
    benchmarkId: newUlid(),
    workspaceId: input.workspaceId,
    query: input.query,
    ...(input.storedPlan ? { planId: input.storedPlan.planId } : {}),
    replayMatches,
    replayDifferences,
    modeBenchmarks,
    selectedMode,
    precisionBaseline,
    selectedModeMetrics: selectedEntry.metrics,
    precisionImprovedVsBaseline,
    pollutionControlled,
    summary: summaryParts.join(" "),
    executedAt: new Date().toISOString(),
  };
}

export interface BatchReplayBenchmarkInput {
  plans: Array<{ plan: RetrievalPlan; workspaceId: string }>;
  workspaceContext?: WorkspaceMetadataContext;
  config?: PlanningRuntimeConfig;
}

export interface BatchReplayBenchmarkResult {
  benchmarkId: string;
  totalPlans: number;
  deterministicMatches: number;
  determinismRate: number;
  averagePrecisionScore: number;
  averagePollutionScore: number;
  pollutionControlledCount: number;
  executedAt: string;
}

/** Batch replay benchmark across stored plans — measures determinism rate and average scores. */
export function batchReplayBenchmark(
  input: BatchReplayBenchmarkInput,
): BatchReplayBenchmarkResult {
  const config = input.config ?? DEFAULT_PLANNING_RUNTIME_CONFIG;
  let deterministicMatches = 0;
  let precisionSum = 0;
  let pollutionSum = 0;
  let pollutionControlledCount = 0;

  for (const item of input.plans) {
    const result = benchmarkPlanning({
      workspaceId: item.workspaceId,
      query: item.plan.query,
      retrievalMode: item.plan.retrievalMode,
      storedPlan: item.plan,
      ...(input.workspaceContext ? { workspaceContext: input.workspaceContext } : {}),
      config,
    });

    if (result.replayMatches) deterministicMatches += 1;
    precisionSum += result.selectedModeMetrics.precisionScore;
    pollutionSum += result.selectedModeMetrics.pollutionScore;
    if (result.pollutionControlled) pollutionControlledCount += 1;
  }

  const total = input.plans.length;

  return {
    benchmarkId: newUlid(),
    totalPlans: total,
    deterministicMatches,
    determinismRate: total > 0 ? deterministicMatches / total : 1,
    averagePrecisionScore: total > 0 ? precisionSum / total : 0,
    averagePollutionScore: total > 0 ? pollutionSum / total : 0,
    pollutionControlledCount,
    executedAt: new Date().toISOString(),
  };
}
