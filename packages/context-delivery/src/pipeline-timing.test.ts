import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createLogger,
  createLoggingEventEmitter,
  ExecutionTimingCollector,
} from "@memory-middleware/observability";
import type { ContextPackage, DomainExecutionContext } from "@memory-middleware/shared-types";
import { DEFAULT_RELATIONSHIP_NEIGHBORHOOD_CONSTRAINT } from "@memory-middleware/shared-types";
import { runContextRenderPipeline } from "./pipeline.js";

function basePackage(): ContextPackage {
  return {
    query: "enterprise pricing policy",
    workspaceId: "ws-1",
    retrievalTraceId: "01TRACE",
    tokenBudget: { maxTokens: 4096, usedTokens: 20, trimmedTokens: 0 },
    retrievalMetadata: {
      retrievalLatencyMs: 1,
      retrievedChunkCount: 1,
      deduplicatedChunkCount: 1,
      finalChunkCount: 1,
    },
    memories: [
      {
        memoryId: "mem-1",
        title: "Pricing",
        memoryType: "semantic",
        version: 1,
        lineage: { ingestionTraceId: "ing-1", normalizationTraceId: "norm-1" },
        memoryScore: 1,
        chunks: [
          {
            chunkId: "chunk-1",
            chunkIndex: 0,
            content: "Enterprise pricing policy details",
            tokenCount: 12,
            finalScore: 0.9,
            rankingRank: 1,
          },
        ],
      },
    ],
    rejectedCandidates: [],
    rankingBreakdown: [],
    chunkTraces: [],
    generatedAt: new Date().toISOString(),
  };
}

function executionContext(): DomainExecutionContext {
  return {
    workspaceId: "ws-1",
    globalFacts: [
      {
        factId: "01FACT",
        workspaceId: "ws-1",
        scope: "global",
        key: "pricing",
        title: "Pricing",
        content: "Enterprise pricing policy details (authoritative)",
        priority: 0,
        status: "active",
        appliesToMetadataKeys: [],
        version: 1,
        createdAt: "",
        updatedAt: "",
      },
    ],
    domainFacts: [],
    instructions: [
      {
        instructionId: "01INST",
        workspaceId: "ws-1",
        domainId: "01DOMAIN",
        actionKey: "render",
        title: "Render mode",
        content: "Prefer authoritative facts.",
        status: "active",
        version: 1,
        isActive: true,
        createdAt: "",
        updatedAt: "",
      },
    ],
    retrievalRules: [],
    metadataFilters: [],
    observationFilters: [],
    relationshipConstraints: DEFAULT_RELATIONSHIP_NEIGHBORHOOD_CONSTRAINT,
    resolvedAt: new Date().toISOString(),
  };
}

describe("runContextRenderPipeline timing", () => {
  it("records context_rendering stage when timingCollector is provided", async () => {
    const collector = new ExecutionTimingCollector("01DELIVERY");
    const events = createLoggingEventEmitter({
      logger: createLogger({ level: "silent" }),
    });

    const result = await runContextRenderPipeline({
      contextPackage: basePackage(),
      workspaceId: "ws-1",
      deliveryId: "01DELIVERY",
      events,
      timingCollector: collector,
    });

    assert.equal(result.failed, false);

    const audit = collector.toAudit();
    const stageNames = audit.stages.map((stage) => stage.stage);
    assert.ok(stageNames.includes("context_rendering"), `stages: ${stageNames.join(", ")}`);
    assert.ok(
      audit.stages.find((stage) => stage.stage === "context_rendering")!.durationMs >= 0,
    );
  });

  it("records fact_resolution when executionContext is provided", async () => {
    const collector = new ExecutionTimingCollector("01DELIVERY-FACT");
    const events = createLoggingEventEmitter({
      logger: createLogger({ level: "silent" }),
    });

    const result = await runContextRenderPipeline({
      contextPackage: basePackage(),
      workspaceId: "ws-1",
      deliveryId: "01DELIVERY-FACT",
      executionContext: executionContext(),
      events,
      timingCollector: collector,
    });

    assert.equal(result.failed, false);

    const audit = collector.toAudit();
    const stageNames = audit.stages.map((stage) => stage.stage);
    assert.ok(stageNames.includes("context_rendering"), `stages: ${stageNames.join(", ")}`);
    assert.ok(stageNames.includes("fact_resolution"), `stages: ${stageNames.join(", ")}`);

    const contextRendering = audit.stages.find((stage) => stage.stage === "context_rendering")!;
    const factResolution = audit.stages.find((stage) => stage.stage === "fact_resolution")!;
    assert.ok(contextRendering.durationMs >= factResolution.durationMs);
  });

  it("preserves legacy ContextRenderStageRecord stages including fact_precedence", async () => {
    const events = createLoggingEventEmitter({
      logger: createLogger({ level: "silent" }),
    });

    const result = await runContextRenderPipeline({
      contextPackage: basePackage(),
      workspaceId: "ws-1",
      deliveryId: "01DELIVERY-LEGACY",
      executionContext: executionContext(),
      events,
    });

    assert.equal(result.failed, false);

    const legacyStageNames = result.stages
      .filter((stage) => stage.status === "completed")
      .map((stage) => stage.stage);

    for (const expected of [
      "rendering",
      "fact_precedence",
      "contextual_grouping",
      "hierarchy_formatting",
      "trace_stripping",
      "delivery_optimization",
    ]) {
      assert.ok(
        legacyStageNames.includes(expected),
        `missing legacy stage: ${expected} (${legacyStageNames.join(", ")})`,
      );
    }

    const factStage = result.stages.find((stage) => stage.stage === "fact_precedence");
    assert.equal(factStage?.status, "completed");
    assert.ok((factStage?.metadata?.overrideCount ?? 0) >= 0);
  });

  it("produces identical delivery output with or without timingCollector", async () => {
    const events = createLoggingEventEmitter({
      logger: createLogger({ level: "silent" }),
    });
    const pkg = basePackage();
    const ctx = executionContext();

    const withoutTiming = await runContextRenderPipeline({
      contextPackage: pkg,
      workspaceId: "ws-1",
      deliveryId: "01DELIVERY-A",
      executionContext: ctx,
      events,
    });

    const withTiming = await runContextRenderPipeline({
      contextPackage: pkg,
      workspaceId: "ws-1",
      deliveryId: "01DELIVERY-B",
      executionContext: ctx,
      events,
      timingCollector: new ExecutionTimingCollector("01DELIVERY-B"),
    });

    assert.equal(withoutTiming.failed, false);
    assert.equal(withTiming.failed, false);

    assert.deepEqual(withTiming.deliveryContext.renderedContext, withoutTiming.deliveryContext.renderedContext);
    assert.deepEqual(withTiming.deliveryContext.renderedSections, withoutTiming.deliveryContext.renderedSections);
    assert.deepEqual(withTiming.deliveryContext.tokenCount, withoutTiming.deliveryContext.tokenCount);
    assert.deepEqual(withTiming.renderingDecisions, withoutTiming.renderingDecisions);
    assert.deepEqual(
      withTiming.preparedContextPackage.memories,
      withoutTiming.preparedContextPackage.memories,
    );
  });
});
