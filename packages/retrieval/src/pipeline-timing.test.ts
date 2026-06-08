import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createLogger,
  ExecutionTimingCollector,
  createLoggingEventEmitter,
} from "@memory-middleware/observability";
import { runRetrievalPipeline } from "./pipeline.js";
import type { VectorSearchCandidate, VectorSearchStore } from "./vector-retrieval.js";

const mockCandidate: VectorSearchCandidate = {
  memoryId: "mem-1",
  chunkId: "chunk-1",
  sequence: 0,
  content: "pricing policy for enterprise customers",
  tokenCount: 12,
  semanticSimilarity: 0.92,
  importanceScore: 1,
  reinforcementScore: 0.1,
  semanticDensityScore: 50,
  memoryUpdatedAt: new Date().toISOString(),
  memoryType: "document",
  title: "Pricing",
  version: 1,
  summary: "Enterprise pricing",
  ingestionTraceId: "ing-1",
  normalizationTraceId: "norm-1",
};

function createMockVectorStore(): VectorSearchStore {
  return {
    async search() {
      await new Promise((r) => setTimeout(r, 2));
      return [mockCandidate];
    },
  };
}

describe("runRetrievalPipeline timing", () => {
  it("records all measured pipeline stages", async () => {
    const collector = new ExecutionTimingCollector("01RETRIEVAL");
    const events = createLoggingEventEmitter({
      logger: createLogger({ level: "silent" }),
    });

    await runRetrievalPipeline({
      query: {
        workspaceId: "ws-1",
        query: "enterprise pricing policy",
        tokenBudget: 2000,
        retrievalMode: "precision",
      },
      vectorStore: createMockVectorStore(),
      embeddingClient: {
        async embed() {
          await new Promise((r) => setTimeout(r, 3));
          return [[0.1, 0.2, 0.3]];
        },
      },
      events,
      timingCollector: collector,
      loadAdjacencyForChunks: async () => new Map(),
      loadMemoryMetadata: async () => [
        { memoryId: "mem-1", title: "Pricing", memoryType: "document", tags: ["pricing"] },
      ],
    });

    const audit = collector.toAudit();
    const stageNames = audit.stages.map((s) => s.stage);

    for (const expected of [
      "retrieval",
      "metadata_filtering",
      "intent_extraction",
      "vector_search",
      "reranking",
      "keyword_search",
      "context_assembly",
    ]) {
      assert.ok(stageNames.includes(expected), `missing stage: ${expected}`);
    }

    for (const stage of audit.stages) {
      assert.ok(stage.durationMs >= 0, `${stage.stage} duration invalid`);
      assert.ok(stage.startTime <= stage.endTime, `${stage.stage} time order invalid`);
    }

    console.log("PIPELINE_TIMING_AUDIT", JSON.stringify(audit, null, 2));
  });
});
