import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createLogger,
  createLoggingEventEmitter,
  ExecutionTimingCollector,
} from "@memory-middleware/observability";
import type { IngestionStageRecord } from "@memory-middleware/shared-types";
import {
  runIngestionPipeline,
  type PipelineJobInput,
  type PipelineStore,
} from "./pipeline.js";

function createMockStore(): {
  store: PipelineStore;
  getLastStages: () => IngestionStageRecord[];
} {
  let lastStages: IngestionStageRecord[] = [];

  const store: PipelineStore = {
    async updateTraceStatus(_traceId, _status, stages) {
      lastStages = [...stages];
    },
    async persistSourceTruth() {},
    async persistMemory() {},
    async updateChunkEmbeddings() {},
  };

  return {
    store,
    getLastStages: () => lastStages,
  };
}

function baseInput(traceId: string): PipelineJobInput {
  return {
    workspaceId: "ws-1",
    traceId,
    sourceType: "text",
    persistenceMode: "persistent",
    memoryType: "semantic",
    title: "Timing test",
    rawContent: "# Enterprise pricing\n\nPolicy details for enterprise customers.",
  };
}

describe("runIngestionPipeline timing", () => {
  it("records all ingestion pipeline stages when timingCollector is provided", async () => {
    const collector = new ExecutionTimingCollector("01INGEST");
    const { store } = createMockStore();
    const events = createLoggingEventEmitter({
      logger: createLogger({ level: "silent" }),
    });

    const result = await runIngestionPipeline(baseInput("01INGEST"), {
      events,
      store,
      embeddingClient: {
        async embed(texts: string[]) {
          await new Promise((resolve) => setTimeout(resolve, 2));
          return texts.map(() => [0.1, 0.2, 0.3]);
        },
      },
      timingCollector: collector,
    });

    assert.equal(result.status, "completed");

    const audit = collector.toAudit();
    const stageNames = audit.stages.map((stage) => stage.stage);

    for (const expected of [
      "ingestion",
      "normalization",
      "chunking",
      "embedding_generation",
    ]) {
      assert.ok(stageNames.includes(expected), `missing stage: ${expected} (${stageNames.join(", ")})`);
    }

    for (const stage of audit.stages) {
      assert.ok(stage.durationMs >= 0, `${stage.stage} duration invalid`);
      assert.ok(stage.startTime <= stage.endTime, `${stage.stage} time order invalid`);
    }

    const ingestion = audit.stages.find((stage) => stage.stage === "ingestion")!;
    const normalization = audit.stages.find((stage) => stage.stage === "normalization")!;
    const chunking = audit.stages.find((stage) => stage.stage === "chunking")!;
    const embedding = audit.stages.find((stage) => stage.stage === "embedding_generation")!;

    assert.ok(ingestion.durationMs >= normalization.durationMs);
    assert.ok(ingestion.durationMs >= chunking.durationMs);
    assert.ok(ingestion.durationMs >= embedding.durationMs);
  });

  it("preserves legacy IngestionStageRecord stages with Date.now() latencyMs", async () => {
    const { store, getLastStages } = createMockStore();
    const events = createLoggingEventEmitter({
      logger: createLogger({ level: "silent" }),
    });

    const result = await runIngestionPipeline(baseInput("01INGEST-LEGACY"), {
      events,
      store,
      embeddingClient: {
        async embed(texts: string[]) {
          return texts.map(() => [0.1, 0.2, 0.3]);
        },
      },
    });

    assert.equal(result.status, "completed");

    const legacyStages = getLastStages()
      .filter((stage) => stage.status === "completed")
      .map((stage) => stage.stage);

    for (const expected of ["normalized", "chunked", "embedded", "stored", "completed"] as const) {
      assert.ok(
        legacyStages.includes(expected),
        `missing legacy stage: ${expected} (${legacyStages.join(", ")})`,
      );
    }

    for (const stage of getLastStages()) {
      if (stage.latencyMs !== undefined) {
        assert.ok(stage.latencyMs >= 0, `${stage.stage} legacy latencyMs invalid`);
      }
      if (stage.startedAt && stage.completedAt) {
        assert.ok(stage.startedAt <= stage.completedAt, `${stage.stage} legacy time order invalid`);
      }
    }
  });

  it("produces identical memory output with or without timingCollector", async () => {
    const events = createLoggingEventEmitter({
      logger: createLogger({ level: "silent" }),
    });
    const embeddingClient = {
      async embed(texts: string[]) {
        return texts.map(() => [0.1, 0.2, 0.3]);
      },
    };

    const withoutTimingStore = createMockStore();
    const withTimingStore = createMockStore();

    const withoutTiming = await runIngestionPipeline(baseInput("01INGEST-A"), {
      events,
      store: withoutTimingStore.store,
      embeddingClient,
    });

    const withTiming = await runIngestionPipeline(baseInput("01INGEST-B"), {
      events,
      store: withTimingStore.store,
      embeddingClient,
      timingCollector: new ExecutionTimingCollector("01INGEST-B"),
    });

    assert.equal(withoutTiming.status, "completed");
    assert.equal(withTiming.status, "completed");

    assert.equal(withTiming.memory.normalizedContent, withoutTiming.memory.normalizedContent);
    assert.equal(withTiming.memory.title, withoutTiming.memory.title);
    assert.equal(withTiming.memory.chunks.length, withoutTiming.memory.chunks.length);
    assert.deepEqual(
      withTiming.memory.chunks.map((chunk) => chunk.content),
      withoutTiming.memory.chunks.map((chunk) => chunk.content),
    );
    assert.deepEqual(
      withTiming.memory.chunks.map((chunk) => chunk.embedding),
      withoutTiming.memory.chunks.map((chunk) => chunk.embedding),
    );
    assert.equal(
      withTiming.memory.metadata.structural?.chunkingStrategy,
      withoutTiming.memory.metadata.structural?.chunkingStrategy,
    );
  });
});
