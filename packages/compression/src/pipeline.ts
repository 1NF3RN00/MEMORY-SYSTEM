import type { EventEmitter, ExecutionTimingCollector } from "@memory-middleware/observability";
import { measurePipelineStage, resolvePipelineCollector } from "@memory-middleware/observability";
import type {
  CompressionMetadata,
  CompressionRequest,
  CompressionStageRecord,
  CompressionStageTrace,
  ContextPackage,
  FidelityMode,
  FidelityReport,
  MergeDecision,
  MemoryRelationship,
  OptimizedContextPackage,
  TrimmingDecision,
} from "@memory-middleware/shared-types";
import {
  DEFAULT_COMPRESSION_FIDELITY,
  DEFAULT_NUANCE_PRESERVATION,
  DEFAULT_TOKEN_OPTIMIZATION,
  newUlid,
} from "@memory-middleware/shared-types";
import type { AbstractionClient } from "./abstraction.js";
import { optionalAbstraction } from "./abstraction.js";
import { mergeCompressionConfig } from "./config.js";
import {
  emitAbstractionCompleted,
  emitCompressionCompleted,
  emitCompressionFailed,
  emitCompressionStarted,
  emitFidelityValidationCompleted,
  emitMergeCompleted,
  emitOverlapDetectionCompleted,
  emitTrimmingCompleted,
} from "./events.js";
import { rebuildContextPackage, validateFidelity } from "./fidelity.js";
import { semanticMerge } from "./merge.js";
import { detectOverlap, flattenContextPackage } from "./overlap.js";
import {
  applyPreprocessingEnhancements,
  deriveContextualWeights,
} from "./preprocessing.js";
import { deriveAllRelationships } from "./relationships.js";
import { rankingAwareTrim } from "./trim.js";

export interface RunCompressionInput {
  request: CompressionRequest;
  traceId?: string;
  events: EventEmitter;
  abstractionClient?: AbstractionClient | null;
  runtimeOverrides?: Parameters<typeof mergeCompressionConfig>[0];
  onStage?: (stages: CompressionStageRecord[]) => void;
  timingCollector?: ExecutionTimingCollector;
}

export interface RunCompressionResult {
  traceId: string;
  originalContextPackage: ContextPackage;
  optimizedContextPackage: OptimizedContextPackage;
  stages: CompressionStageRecord[];
  stageTraces: CompressionStageTrace[];
  fidelityReport: FidelityReport;
  mergeDecisions: MergeDecision[];
  trimmingDecisions: TrimmingDecision[];
  relationships: MemoryRelationship[];
  failed: boolean;
  error?: string;
}

function pushStage(
  stages: CompressionStageRecord[],
  stage: string,
  status: CompressionStageRecord["status"],
  startedAt: string,
  extra?: Partial<CompressionStageRecord>,
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

function extractKeywords(pkg: ContextPackage): string[] {
  return [
    ...new Set(
      pkg.query
        .toLowerCase()
        .split(/[^a-z0-9]+/i)
        .filter((t) => t.length > 2),
    ),
  ].sort();
}

export async function runCompressionPipeline(
  input: RunCompressionInput,
): Promise<RunCompressionResult> {
  const traceId = input.traceId ?? newUlid();
  const timing = resolvePipelineCollector(traceId, input.timingCollector);
  return measurePipelineStage(traceId, "compression", timing, async () => {
  const stages: CompressionStageRecord[] = [];
  const stageTraces: CompressionStageTrace[] = [];
  const pipelineStarted = Date.now();
  const notify = async () => {
    await input.onStage?.([...stages]);
  };

  const fidelityMode: FidelityMode =
    input.request.fidelityMode ?? DEFAULT_COMPRESSION_FIDELITY;
  const nuancePreservation =
    input.request.nuancePreservation ?? DEFAULT_NUANCE_PRESERVATION;
  const tokenOptimization =
    input.request.tokenOptimization ?? DEFAULT_TOKEN_OPTIMIZATION;

  const config = mergeCompressionConfig(
    input.runtimeOverrides,
    fidelityMode,
    nuancePreservation,
    tokenOptimization,
  );

  const sourcePackage = input.request.contextPackage;
  if (!sourcePackage) {
    throw new Error("contextPackage is required");
  }

  await emitCompressionStarted(input.events, {
    traceId,
    workspaceId: input.request.workspaceId,
    extra: { fidelity_mode: fidelityMode },
  });

  try {
    pushStage(stages, "preprocessing", "started", new Date().toISOString());
    await notify();

    const keywords = extractKeywords(sourcePackage);
    const preprocessing = applyPreprocessingEnhancements(sourcePackage, keywords);
    const contextualWeights = deriveContextualWeights(sourcePackage, preprocessing);
    const flatChunks = flattenContextPackage(sourcePackage, contextualWeights);
    const originalTokens = flatChunks.reduce((sum, c) => sum + c.tokenCount, 0);
    const computedTarget = Math.max(
      1,
      Math.floor(originalTokens * (1 - config.profile.trimAggressiveness * 0.35)),
    );
    // Compression only shrinks. A target above original used tokens is a no-op.
    const targetTokens =
      input.request.targetTokenBudget !== undefined &&
      input.request.targetTokenBudget < originalTokens
        ? input.request.targetTokenBudget
        : computedTarget;

    pushStage(stages, "preprocessing", "completed", new Date().toISOString(), {
      metadata: {
        hints: preprocessing.queryHints.retrievalHints.length,
        expanded_tags: preprocessing.metadataExpansion.expandedTags.length,
        original_tokens: originalTokens,
        target_tokens: targetTokens,
      },
    });
    await notify();

    pushStage(stages, "overlap_detection", "started", new Date().toISOString());
    await notify();

    const overlapStarted = Date.now();
    const overlap = detectOverlap(flatChunks, config);
    stageTraces.push(overlap.stageTrace);
    pushStage(stages, "overlap_detection", "completed", new Date().toISOString(), {
      ...(overlap.stageTrace.metadata ? { metadata: overlap.stageTrace.metadata } : {}),
    });
    await emitOverlapDetectionCompleted(input.events, {
      traceId,
      workspaceId: input.request.workspaceId,
      latencyMs: Date.now() - overlapStarted,
      ...(overlap.stageTrace.metadata ? { extra: overlap.stageTrace.metadata } : {}),
    });
    await notify();

    pushStage(stages, "semantic_merge", "started", new Date().toISOString());
    await notify();

    const mergeStarted = Date.now();
    const merge = semanticMerge(flatChunks, overlap.candidates, config);
    stageTraces.push(merge.stageTrace);
    pushStage(stages, "semantic_merge", "completed", new Date().toISOString(), {
      ...(merge.stageTrace.metadata ? { metadata: merge.stageTrace.metadata } : {}),
    });
    await emitMergeCompleted(input.events, {
      traceId,
      workspaceId: input.request.workspaceId,
      latencyMs: Date.now() - mergeStarted,
      extra: {
        merge_count: merge.decisions.length,
        token_savings: merge.tokenSavings,
      },
    });
    await notify();

    pushStage(stages, "ranking_trim", "started", new Date().toISOString());
    await notify();

    const trimStarted = Date.now();
    const trim = rankingAwareTrim(merge.chunks, targetTokens, config);
    stageTraces.push(trim.stageTrace);
    pushStage(stages, "ranking_trim", "completed", new Date().toISOString(), {
      ...(trim.stageTrace.metadata ? { metadata: trim.stageTrace.metadata } : {}),
    });
    await emitTrimmingCompleted(input.events, {
      traceId,
      workspaceId: input.request.workspaceId,
      latencyMs: Date.now() - trimStarted,
      extra: {
        trimmed_count: trim.trimmed.length,
        token_savings: trim.tokenSavings,
      },
    });
    await notify();

    pushStage(stages, "abstraction", "started", new Date().toISOString());
    await notify();

    const abstractStarted = Date.now();
    const abstract = await optionalAbstraction(
      trim.kept,
      targetTokens,
      config,
      input.abstractionClient ?? null,
    );
    stageTraces.push(abstract.stageTrace);
    pushStage(stages, "abstraction", "completed", new Date().toISOString(), {
      ...(abstract.stageTrace.metadata ? { metadata: abstract.stageTrace.metadata } : {}),
    });
    await emitAbstractionCompleted(input.events, {
      traceId,
      workspaceId: input.request.workspaceId,
      latencyMs: Date.now() - abstractStarted,
      extra: {
        llm_used: abstract.llmUsed,
        token_savings: abstract.tokenSavings,
      },
    });
    await notify();

    pushStage(stages, "fidelity_validation", "started", new Date().toISOString());
    await notify();

    const optimizedTokens = abstract.chunks.reduce((sum, c) => sum + c.tokenCount, 0);
    const fidelityStarted = Date.now();
    const fidelity = validateFidelity({
      originalChunks: flatChunks,
      optimizedChunks: abstract.chunks,
      originalTokens,
      optimizedTokens,
      config,
    });
    stageTraces.push(fidelity.stageTrace);
    pushStage(stages, "fidelity_validation", "completed", new Date().toISOString(), {
      ...(fidelity.stageTrace.metadata ? { metadata: fidelity.stageTrace.metadata } : {}),
    });
    await emitFidelityValidationCompleted(input.events, {
      traceId,
      workspaceId: input.request.workspaceId,
      latencyMs: Date.now() - fidelityStarted,
      extra: {
        fidelity_score: fidelity.report.fidelityScore,
        validation_passed: fidelity.report.validationPassed,
      },
    });
    await notify();

    const totalTokenSavings = Math.max(0, originalTokens - optimizedTokens);
    const metadata: CompressionMetadata = {
      fidelityMode,
      nuancePreservation: config.nuancePreservation,
      tokenOptimization: config.tokenOptimization,
      originalTokens,
      optimizedTokens,
      tokenSavings: totalTokenSavings,
      fidelityScore: fidelity.report.fidelityScore,
      abstractionUsed: abstract.llmUsed,
      preprocessingApplied: preprocessing,
      stages: stageTraces,
    };

    const optimizedContextPackage = rebuildContextPackage(
      sourcePackage,
      abstract.chunks,
      traceId,
      metadata,
    );

    const relationships = deriveAllRelationships(
      input.request.workspaceId,
      sourcePackage,
      flatChunks,
    );

    pushStage(stages, "compression_complete", "completed", new Date().toISOString(), {
      metadata: {
        token_savings: totalTokenSavings,
        fidelity_score: fidelity.report.fidelityScore,
      },
    });
    await notify();

    await emitCompressionCompleted(input.events, {
      traceId,
      workspaceId: input.request.workspaceId,
      latencyMs: Date.now() - pipelineStarted,
      extra: {
        token_savings: totalTokenSavings,
        fidelity_score: fidelity.report.fidelityScore,
      },
    });

    return {
      traceId,
      originalContextPackage: sourcePackage,
      optimizedContextPackage,
      stages,
      stageTraces,
      fidelityReport: fidelity.report,
      mergeDecisions: merge.decisions,
      trimmingDecisions: trim.decisions,
      relationships,
      failed: false,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    pushStage(stages, "compression_failed", "failed", new Date().toISOString(), {
      error: message,
    });
    await notify();

    await emitCompressionFailed(input.events, {
      traceId,
      workspaceId: input.request.workspaceId,
      error: message,
    });

    const fallbackMetadata: CompressionMetadata = {
      fidelityMode,
      nuancePreservation: config.nuancePreservation,
      tokenOptimization: config.tokenOptimization,
      originalTokens: sourcePackage.tokenBudget.usedTokens,
      optimizedTokens: sourcePackage.tokenBudget.usedTokens,
      tokenSavings: 0,
      fidelityScore: 1,
      abstractionUsed: false,
      preprocessingApplied: applyPreprocessingEnhancements(
        sourcePackage,
        extractKeywords(sourcePackage),
      ),
      stages: stageTraces,
    };

    return {
      traceId,
      originalContextPackage: sourcePackage,
      optimizedContextPackage: {
        ...sourcePackage,
        compressionTraceId: traceId,
        sourceRetrievalTraceId: sourcePackage.retrievalTraceId,
        compressionMetadata: fallbackMetadata,
      },
      stages,
      stageTraces,
      fidelityReport: {
        fidelityScore: 1,
        nuancePreservationScore: 1,
        compressionAggressiveness: 0,
        retrievalQualityScore: 1,
        contextualPreservationScore: 1,
        validationPassed: true,
        issues: [`Compression failed — original context preserved: ${message}`],
        rankingPreservationRatio: 1,
        chunkRetentionRatio: 1,
      },
      mergeDecisions: [],
      trimmingDecisions: [],
      relationships: [],
      failed: true,
      error: message,
    };
  }
  });
}

export { mergeCompressionConfig } from "./config.js";
export { createOpenAiAbstractionClient } from "./abstraction.js";
export { deriveRelationshipsFromPackage } from "./relationships.js";
