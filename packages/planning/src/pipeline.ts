import type { EventEmitter, ExecutionTimingCollector } from "@memory-middleware/observability";
import { measurePipelineStage, resolvePipelineCollector } from "@memory-middleware/observability";
import { preprocessQuery } from "@memory-middleware/retrieval";
import type {
  PlanningReplayInput,
  PlanningReplayResult,
  PlanningRequest,
  PlanningRetrievalMode,
  PlanningRuntimeConfig,
  PlanningStageRecord,
  RetrievalPlan,
} from "@memory-middleware/shared-types";
import { DEFAULT_PLANNING_RUNTIME_CONFIG, newUlid } from "@memory-middleware/shared-types";
import { computeContextualWeighting } from "./contextual-weighting.js";
import { decomposeQuery } from "./decomposition.js";
import {
  emitDecompositionCompleted,
  emitMetadataExpansionCompleted,
  emitPlanningFailed,
  emitRetrievalModeActivated,
  emitRetrievalPlanGenerated,
  emitWeightingApplied,
} from "./events.js";
import { expandMetadata, type WorkspaceMetadataContext } from "./metadata-expansion.js";
import { generateRetrievalHints } from "./retrieval-hints.js";
import { getModeImpacts } from "./retrieval-modes.js";

export interface RunPlanningInput {
  request: PlanningRequest;
  planId?: string;
  config?: PlanningRuntimeConfig;
  workspaceContext?: WorkspaceMetadataContext;
  events?: EventEmitter;
  onStage?: (stages: PlanningStageRecord[]) => void;
  timingCollector?: ExecutionTimingCollector;
}

export interface RunPlanningResult {
  plan: RetrievalPlan;
  stages: PlanningStageRecord[];
  replayInput: PlanningReplayInput;
}

function pushStage(
  stages: PlanningStageRecord[],
  stage: string,
  status: PlanningStageRecord["status"],
  startedAt: string,
  extra?: Partial<PlanningStageRecord>,
): void {
  const existing = stages.find((s) => s.stage === stage && s.status === "started");
  if (existing && status === "completed") {
    existing.status = "completed";
    existing.completedAt = new Date().toISOString();
    existing.latencyMs = Date.now() - new Date(existing.startedAt).getTime();
    if (extra?.metadata) existing.metadata = { ...existing.metadata, ...extra.metadata };
    return;
  }
  stages.push({ stage, status, startedAt, ...extra });
}

export function createFallbackPlan(input: {
  planId: string;
  workspaceId: string;
  query: string;
  retrievalMode: PlanningRetrievalMode;
  error: string;
}): RetrievalPlan {
  const preprocessed = preprocessQuery(input.query);
  return {
    planId: input.planId,
    workspaceId: input.workspaceId,
    query: input.query,
    retrievalMode: input.retrievalMode,
    decomposedConcepts: preprocessed.keywords,
    retrievalHints: preprocessed.keywords.map((k) => `keyword:${k}`),
    expansionTerms: [],
    weightingAdjustments: {
      operational: 1,
      recency: 1,
      semanticDensity: 1,
      reinforcement: 1,
    },
    metadataExpansion: { tags: [], relationships: [], operationalDomains: [] },
    generatedAt: new Date().toISOString(),
    decomposition: {
      operationalConcepts: preprocessed.keywords,
      entities: [],
      domains: [],
      timeReferences: [],
      contextualPriorities: [],
    },
    explainability: {
      decompositionReasons: [`Fallback plan — preprocessing error: ${input.error}`],
      expansionReasons: [],
      weightingReasons: ["Neutral weighting applied due to planning failure."],
      modeImpacts: getModeImpacts(input.retrievalMode),
    },
  };
}

export async function runPlanningPipeline(input: RunPlanningInput): Promise<RunPlanningResult> {
  const planId = input.planId ?? newUlid();
  const timing = resolvePipelineCollector(planId, input.timingCollector);
  return measurePipelineStage(planId, "planning", timing, async () => {
  const config = input.config ?? DEFAULT_PLANNING_RUNTIME_CONFIG;
  const retrievalMode = input.request.retrievalMode ?? "precision";
  const stages: PlanningStageRecord[] = [];

  const notify = async () => {
    await input.onStage?.([...stages]);
  };

  const replayInput: PlanningReplayInput = {
    workspaceId: input.request.workspaceId,
    query: input.request.query,
    retrievalMode,
    capturedAt: new Date().toISOString(),
  };

  try {
    await emitRetrievalModeActivated(input.events, {
      planId,
      workspaceId: input.request.workspaceId,
      extra: { retrieval_mode: retrievalMode },
    });

    pushStage(stages, "decomposition", "started", new Date().toISOString());
    await notify();

    const decompStarted = Date.now();
    const { decomposition, decomposedConcepts, reasons: decompositionReasons } =
      await measurePipelineStage(planId, "intent_extraction", timing, async () =>
        decomposeQuery(input.request.query, config.maxDecomposedConcepts),
      );
    const preprocessed = preprocessQuery(input.request.query);

    pushStage(stages, "decomposition", "completed", new Date().toISOString(), {
      metadata: {
        concept_count: decomposedConcepts.length,
        domain_count: decomposition.domains.length,
      },
    });
    await emitDecompositionCompleted(input.events, {
      planId,
      workspaceId: input.request.workspaceId,
      latencyMs: Date.now() - decompStarted,
      extra: { concepts: decomposedConcepts },
    });
    await notify();

    pushStage(stages, "metadata_expansion", "started", new Date().toISOString());
    await notify();

    const expansionStarted = Date.now();
    const expansion = expandMetadata({
      keywords: preprocessed.keywords,
      decomposedConcepts,
      decomposition,
      ...(input.workspaceContext ? { workspaceContext: input.workspaceContext } : {}),
      maxTerms: config.maxExpansionTerms,
    });

    pushStage(stages, "metadata_expansion", "completed", new Date().toISOString(), {
      metadata: {
        expansion_term_count: expansion.expansionTerms.length,
        tag_count: expansion.metadataExpansion.tags.length,
      },
    });
    await emitMetadataExpansionCompleted(input.events, {
      planId,
      workspaceId: input.request.workspaceId,
      latencyMs: Date.now() - expansionStarted,
      extra: { expansion_terms: expansion.expansionTerms.length },
    });
    await notify();

    pushStage(stages, "contextual_weighting", "started", new Date().toISOString());
    await notify();

    const weightingStarted = Date.now();
    const weighting = computeContextualWeighting({
      retrievalMode,
      decomposition,
      expansionTerms: expansion.expansionTerms,
    });

    pushStage(stages, "contextual_weighting", "completed", new Date().toISOString(), {
      metadata: { weighting: weighting.weightingAdjustments },
    });
    await emitWeightingApplied(input.events, {
      planId,
      workspaceId: input.request.workspaceId,
      latencyMs: Date.now() - weightingStarted,
      extra: { weighting: weighting.weightingAdjustments },
    });
    await notify();

    pushStage(stages, "retrieval_planning", "started", new Date().toISOString());
    await notify();

    const retrievalHints = generateRetrievalHints({
      keywords: preprocessed.keywords,
      decomposedConcepts,
      decomposition,
      expansionTerms: expansion.expansionTerms,
    });

    const modeImpacts = getModeImpacts(retrievalMode);

    const plan: RetrievalPlan = {
      planId,
      workspaceId: input.request.workspaceId,
      query: input.request.query,
      retrievalMode,
      decomposedConcepts,
      retrievalHints,
      expansionTerms: expansion.expansionTerms,
      weightingAdjustments: weighting.weightingAdjustments,
      metadataExpansion: expansion.metadataExpansion,
      generatedAt: new Date().toISOString(),
      decomposition,
      explainability: {
        decompositionReasons,
        expansionReasons: expansion.expansionReasons,
        weightingReasons: weighting.weightingReasons,
        modeImpacts,
      },
    };

    pushStage(stages, "retrieval_planning", "completed", new Date().toISOString(), {
      metadata: { hint_count: retrievalHints.length },
    });
    await emitRetrievalPlanGenerated(input.events, {
      planId,
      workspaceId: input.request.workspaceId,
      extra: { hint_count: retrievalHints.length, retrieval_mode: retrievalMode },
    });
    await notify();

    return { plan, stages, replayInput };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    pushStage(stages, "planning", "failed", new Date().toISOString(), { error: message });
    await emitPlanningFailed(input.events, {
      planId,
      workspaceId: input.request.workspaceId,
      error: message,
    });
    await notify();

    const fallback = createFallbackPlan({
      planId,
      workspaceId: input.request.workspaceId,
      query: input.request.query,
      retrievalMode,
      error: message,
    });

    return { plan: fallback, stages, replayInput };
  }
  });
}

export function replayPlanning(
  originalPlan: RetrievalPlan,
  replayInput: PlanningReplayInput,
  workspaceContext?: WorkspaceMetadataContext,
  config?: PlanningRuntimeConfig,
): PlanningReplayResult {
  const result = runPlanningPipelineSync({
    request: {
      workspaceId: replayInput.workspaceId,
      query: replayInput.query,
      retrievalMode: replayInput.retrievalMode,
    },
    planId: originalPlan.planId,
    ...(config ? { config } : {}),
    ...(workspaceContext ? { workspaceContext } : {}),
  });

  const differences: string[] = [];

  if (JSON.stringify(result.plan.decomposedConcepts) !== JSON.stringify(originalPlan.decomposedConcepts)) {
    differences.push("decomposedConcepts differ");
  }
  if (JSON.stringify(result.plan.expansionTerms) !== JSON.stringify(originalPlan.expansionTerms)) {
    differences.push("expansionTerms differ");
  }
  if (
    JSON.stringify(result.plan.weightingAdjustments) !==
    JSON.stringify(originalPlan.weightingAdjustments)
  ) {
    differences.push("weightingAdjustments differ");
  }
  if (JSON.stringify(result.plan.retrievalHints) !== JSON.stringify(originalPlan.retrievalHints)) {
    differences.push("retrievalHints differ");
  }

  return {
    planId: originalPlan.planId,
    originalPlan,
    replayedPlan: result.plan,
    matches: differences.length === 0,
    differences,
    replayedAt: new Date().toISOString(),
  };
}

/** Synchronous planning for replay comparison (no event emission). */
export function runPlanningPipelineSync(input: Omit<RunPlanningInput, "events" | "onStage">): {
  plan: RetrievalPlan;
} {
  const config = input.config ?? DEFAULT_PLANNING_RUNTIME_CONFIG;
  const retrievalMode = input.request.retrievalMode ?? "precision";
  const planId = input.planId ?? newUlid();

  const { decomposition, decomposedConcepts, reasons: decompositionReasons } = decomposeQuery(
    input.request.query,
    config.maxDecomposedConcepts,
  );
  const preprocessed = preprocessQuery(input.request.query);

  const expansion = expandMetadata({
    keywords: preprocessed.keywords,
    decomposedConcepts,
    decomposition,
    ...(input.workspaceContext ? { workspaceContext: input.workspaceContext } : {}),
    maxTerms: config.maxExpansionTerms,
  });

  const weighting = computeContextualWeighting({
    retrievalMode,
    decomposition,
    expansionTerms: expansion.expansionTerms,
  });

  const retrievalHints = generateRetrievalHints({
    keywords: preprocessed.keywords,
    decomposedConcepts,
    decomposition,
    expansionTerms: expansion.expansionTerms,
  });

  return {
    plan: {
      planId,
      workspaceId: input.request.workspaceId,
      query: input.request.query,
      retrievalMode,
      decomposedConcepts,
      retrievalHints,
      expansionTerms: expansion.expansionTerms,
      weightingAdjustments: weighting.weightingAdjustments,
      metadataExpansion: expansion.metadataExpansion,
      generatedAt: new Date().toISOString(),
      decomposition,
      explainability: {
        decompositionReasons,
        expansionReasons: expansion.expansionReasons,
        weightingReasons: weighting.weightingReasons,
        modeImpacts: getModeImpacts(retrievalMode),
      },
    },
  };
}
