import type { EventEmitter } from "@memory-middleware/observability";
import type {
  ContextPackageInput,
  ContextRenderRelationshipHint,
  ContextRenderStageRecord,
  DeliveryContext,
  DeliveryMode,
  RenderingDecisions,
} from "@memory-middleware/shared-types";
import { DEFAULT_DELIVERY_MODE, newUlid } from "@memory-middleware/shared-types";
import { optimizeDelivery } from "./delivery-optimizer.js";
import {
  emitDeliveryGenerated,
  emitGroupingCompleted,
  emitRenderingFailed,
  emitRenderingStarted,
  emitTokenOptimizationCompleted,
  emitTraceStrippingCompleted,
} from "./events.js";
import { groupContext } from "./grouping.js";
import { formatHierarchy } from "./hierarchy.js";
import {
  estimateMiddlewarePayloadTokens,
  stripOperationalTraces,
} from "./trace-stripping.js";

export interface RunContextRenderInput {
  contextPackage: ContextPackageInput;
  workspaceId: string;
  deliveryId?: string;
  mode?: DeliveryMode;
  /** Calibration delivery density (0–1) — higher = more compact output */
  deliveryDensity?: number;
  relationshipHints?: ContextRenderRelationshipHint[];
  events: EventEmitter;
  onStage?: (stages: ContextRenderStageRecord[]) => void;
}

export interface RunContextRenderResult {
  deliveryId: string;
  deliveryContext: DeliveryContext;
  renderingDecisions: RenderingDecisions;
  stages: ContextRenderStageRecord[];
  failed: boolean;
  error?: string;
}

function pushStage(
  stages: ContextRenderStageRecord[],
  stage: string,
  status: ContextRenderStageRecord["status"],
  startedAt: string,
  extra?: Partial<ContextRenderStageRecord>,
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

export async function runContextRenderPipeline(
  input: RunContextRenderInput,
): Promise<RunContextRenderResult> {
  const deliveryId = input.deliveryId ?? newUlid();
  const mode = input.mode ?? DEFAULT_DELIVERY_MODE;
  const stages: ContextRenderStageRecord[] = [];
  const pipelineStarted = Date.now();
  const retrievalTraceId = input.contextPackage.retrievalTraceId;

  const eventCtx = {
    deliveryId,
    workspaceId: input.workspaceId,
    retrievalTraceId,
  };

  const notify = async () => {
    await input.onStage?.([...stages]);
  };

  try {
    pushStage(stages, "rendering", "started", new Date().toISOString());
    await notify();
    await emitRenderingStarted(input.events, eventCtx);

    pushStage(stages, "contextual_grouping", "started", new Date().toISOString());
    await notify();

    const { groups, decisions: groupingDecisions } = groupContext(
      input.contextPackage,
      mode,
      input.relationshipHints,
    );

    pushStage(stages, "contextual_grouping", "completed", new Date().toISOString(), {
      metadata: { groupCount: groups.length },
    });
    await notify();
    await emitGroupingCompleted(input.events, {
      ...eventCtx,
      extra: { groupCount: groups.length },
    });

    pushStage(stages, "hierarchy_formatting", "started", new Date().toISOString());
    await notify();

    const { sections, decision: hierarchyDecision } = formatHierarchy(groups, mode);

    pushStage(stages, "hierarchy_formatting", "completed", new Date().toISOString(), {
      metadata: { sectionCount: sections.length },
    });
    await notify();

    pushStage(stages, "trace_stripping", "started", new Date().toISOString());
    await notify();

    const traceStrippingDecision = stripOperationalTraces(input.contextPackage);

    pushStage(stages, "trace_stripping", "completed", new Date().toISOString(), {
      metadata: {
        removedTraceCount: traceStrippingDecision.removedTraceCount,
        strippedFields: traceStrippingDecision.strippedFields,
      },
    });
    await notify();
    await emitTraceStrippingCompleted(input.events, {
      ...eventCtx,
      extra: {
        removedTraceCount: traceStrippingDecision.removedTraceCount,
      },
    });

    pushStage(stages, "delivery_optimization", "started", new Date().toISOString());
    await notify();

    const rawTokenEstimate = estimateMiddlewarePayloadTokens(input.contextPackage);
    const optimized = optimizeDelivery(sections, mode, rawTokenEstimate, input.deliveryDensity ?? 0.6);

    pushStage(stages, "delivery_optimization", "completed", new Date().toISOString(), {
      metadata: {
        tokenCount: optimized.tokenCount,
        tokenDensityScore: optimized.decision.tokenDensityScore,
      },
    });
    await notify();
    await emitTokenOptimizationCompleted(input.events, {
      ...eventCtx,
      extra: {
        tokenCount: optimized.tokenCount,
        tokenDensityScore: optimized.decision.tokenDensityScore,
      },
    });

    const generatedAt = new Date().toISOString();
    const deliveryContext: DeliveryContext = {
      deliveryId,
      retrievalTraceId,
      mode,
      renderedContext: optimized.renderedContext,
      renderedSections: optimized.sections,
      tokenCount: optimized.tokenCount,
      generatedAt,
    };

    const renderingDecisions: RenderingDecisions = {
      grouping: groupingDecisions,
      hierarchy: hierarchyDecision,
      traceStripping: traceStrippingDecision,
      deliveryOptimization: optimized.decision,
      deliveryMode: mode,
    };

    pushStage(stages, "rendering", "completed", new Date().toISOString(), {
      metadata: { tokenCount: optimized.tokenCount },
    });
    await notify();

    await emitDeliveryGenerated(input.events, {
      ...eventCtx,
      latencyMs: Date.now() - pipelineStarted,
      extra: { mode, tokenCount: optimized.tokenCount },
    });

    return {
      deliveryId,
      deliveryContext,
      renderingDecisions,
      stages,
      failed: false,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    pushStage(stages, "rendering", "failed", new Date().toISOString(), { error: message });
    await notify();
    await emitRenderingFailed(input.events, {
      ...eventCtx,
      error: message,
    });

    const generatedAt = new Date().toISOString();
    return {
      deliveryId,
      deliveryContext: {
        deliveryId,
        retrievalTraceId,
        mode,
        renderedContext: "",
        renderedSections: [],
        tokenCount: 0,
        generatedAt,
      },
      renderingDecisions: {
        grouping: [],
        hierarchy: { preservedHeadings: [], bulletGroups: 0, hierarchyDepth: 0 },
        traceStripping: stripOperationalTraces(input.contextPackage),
        deliveryOptimization: {
          redundancyRemoved: 0,
          tokenDensityScore: 0,
          readabilityScore: 0,
        },
        deliveryMode: mode,
      },
      stages,
      failed: true,
      error: message,
    };
  }
}
