import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createLogger,
  createLoggingEventEmitter,
  ExecutionTimingCollector,
} from "@memory-middleware/observability";
import { QueryEmbeddingCache } from "./query-embedding-cache.js";
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
      return [mockCandidate];
    },
  };
}

describe("runRetrievalPipeline query embedding cache", () => {
  it("skips embed client on identical query cache hit", async () => {
    const cache = new QueryEmbeddingCache();
    let embedCalls = 0;
    const events = createLoggingEventEmitter({
      logger: createLogger({ level: "silent" }),
    });

    const input = {
      query: {
        workspaceId: "ws-1",
        query: "Enterprise Pricing Policy",
        tokenBudget: 2000,
        retrievalMode: "precision" as const,
      },
      vectorStore: createMockVectorStore(),
      embeddingClient: {
        async embed() {
          embedCalls += 1;
          await new Promise((resolve) => setTimeout(resolve, 5));
          return [[0.1, 0.2, 0.3]];
        },
      },
      events,
      queryEmbeddingCache: cache,
    };

    const first = await runRetrievalPipeline(input);
    const second = await runRetrievalPipeline(input);

    assert.equal(embedCalls, 1);

    const firstStage = first.stages.find(
      (stage) => stage.stage === "vector_retrieval" && stage.status === "completed",
    );
    const secondStage = second.stages.find(
      (stage) => stage.stage === "vector_retrieval" && stage.status === "completed",
    );

    assert.equal(firstStage?.metadata?.embedding_cache_hit, false);
    assert.equal(secondStage?.metadata?.embedding_cache_hit, true);
  });

  it("does not share cache entries across workspaces", async () => {
    const cache = new QueryEmbeddingCache();
    let embedCalls = 0;
    const events = createLoggingEventEmitter({
      logger: createLogger({ level: "silent" }),
    });

    const base = {
      query: {
        query: "enterprise pricing policy",
        tokenBudget: 2000,
        retrievalMode: "precision" as const,
      },
      vectorStore: createMockVectorStore(),
      embeddingClient: {
        async embed() {
          embedCalls += 1;
          return [[0.4, 0.5]];
        },
      },
      events,
      queryEmbeddingCache: cache,
    };

    await runRetrievalPipeline({ ...base, query: { ...base.query, workspaceId: "ws-a" } });
    await runRetrievalPipeline({ ...base, query: { ...base.query, workspaceId: "ws-b" } });

    assert.equal(embedCalls, 2);
  });

  it("calls embed client on cache miss", async () => {
    const cache = new QueryEmbeddingCache();
    let embedCalls = 0;
    const events = createLoggingEventEmitter({
      logger: createLogger({ level: "silent" }),
    });

    await runRetrievalPipeline({
      query: {
        workspaceId: "ws-1",
        query: "unique miss query alpha",
        tokenBudget: 2000,
        retrievalMode: "precision",
      },
      vectorStore: createMockVectorStore(),
      embeddingClient: {
        async embed() {
          embedCalls += 1;
          return [[0.7, 0.8]];
        },
      },
      events,
      queryEmbeddingCache: cache,
    });

    assert.equal(embedCalls, 1);
  });

  it("omits vector_search:embedding timing on cache hit and second retrieve is faster", async () => {
    const cache = new QueryEmbeddingCache();
    const embedDelayMs = 20;
    const events = createLoggingEventEmitter({
      logger: createLogger({ level: "silent" }),
    });
    const base = {
      query: {
        workspaceId: "ws-1",
        query: "latency benchmark query",
        tokenBudget: 2000,
        retrievalMode: "precision" as const,
      },
      vectorStore: createMockVectorStore(),
      embeddingClient: {
        async embed() {
          await new Promise((resolve) => setTimeout(resolve, embedDelayMs));
          return [[0.1, 0.2, 0.3]];
        },
      },
      events,
      queryEmbeddingCache: cache,
    };

    const missCollector = new ExecutionTimingCollector("trace-miss");
    const hitCollector = new ExecutionTimingCollector("trace-hit");

    const missStarted = performance.now();
    await runRetrievalPipeline({
      ...base,
      traceId: "trace-miss",
      timingCollector: missCollector,
    });
    const missElapsedMs = performance.now() - missStarted;

    const hitStarted = performance.now();
    await runRetrievalPipeline({
      ...base,
      traceId: "trace-hit",
      timingCollector: hitCollector,
    });
    const hitElapsedMs = performance.now() - hitStarted;

    const missEmbedStage = missCollector
      .toAudit()
      .stages.find((stage) => stage.stage === "vector_search:embedding");
    const hitEmbedStage = hitCollector
      .toAudit()
      .stages.find((stage) => stage.stage === "vector_search:embedding");

    assert.ok(missEmbedStage, "cache miss should record vector_search:embedding");
    assert.equal(hitEmbedStage, undefined, "cache hit should omit vector_search:embedding");
    assert.ok(
      missEmbedStage!.durationMs >= embedDelayMs,
      `miss embed stage should include API delay (got ${missEmbedStage!.durationMs}ms)`,
    );
    assert.ok(
      hitElapsedMs < missElapsedMs - embedDelayMs / 2,
      `hit run (${hitElapsedMs.toFixed(1)}ms) should be faster than miss (${missElapsedMs.toFixed(1)}ms)`,
    );
  });
});
