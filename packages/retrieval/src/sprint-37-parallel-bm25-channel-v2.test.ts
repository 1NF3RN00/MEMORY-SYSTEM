import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createLogger,
  ExecutionTimingCollector,
  createLoggingEventEmitter,
} from "@memory-middleware/observability";
import { runRetrievalPipeline } from "./pipeline.js";
import { createInMemoryLexicalSearchStore } from "./lexical-search-store.js";
import { resetDefaultQueryEmbeddingCache } from "./query-embedding-cache.js";
import type { VectorSearchCandidate, VectorSearchStore } from "./vector-retrieval.js";

const mockCandidate: VectorSearchCandidate = {
  memoryId: "mem-1",
  chunkId: "chunk-vector",
  sequence: 0,
  content: "enterprise pricing policy for customers",
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

const lexicalCorpus = [
  {
    workspaceId: "ws-1",
    memoryId: "mem-1",
    chunkId: "chunk-vector",
    sequence: 0,
    content: "enterprise pricing policy for customers",
    tokenCount: 12,
    memoryType: "document",
    title: "Pricing",
  },
  {
    workspaceId: "ws-1",
    memoryId: "mem-2",
    chunkId: "chunk-lexical-only",
    sequence: 0,
    content: "pricing policy compliance guidelines",
    tokenCount: 8,
    memoryType: "document",
    title: "Compliance",
  },
];

describe("sprint-37 parallel BM25 channel v2", () => {
  it("leaves V1 output unchanged when flag is off", async () => {
    const events = createLoggingEventEmitter({
      logger: createLogger({ level: "silent" }),
    });

    const result = await runRetrievalPipeline({
      query: {
        workspaceId: "ws-1",
        query: "enterprise pricing policy",
        tokenBudget: 2000,
        retrievalMode: "precision",
      },
      vectorStore: createMockVectorStore(),
      embeddingClient: {
        async embed() {
          return [[0.1, 0.2, 0.3]];
        },
      },
      events,
    });

    assert.equal(result.contextPackage.memories[0]?.chunks[0]?.chunkId, "chunk-vector");
    assert.equal(result.contextPackage.retrievalMetadata.lexicalChannelV2Shadow, undefined);
    assert.ok(!result.stages.some((stage) => stage.stage === "lexical_channel_v2"));
  });

  it("runs shadow lexical channel when flag is on without changing V1 chunk selection", async () => {
    const events = createLoggingEventEmitter({
      logger: createLogger({ level: "silent" }),
    });
    const collector = new ExecutionTimingCollector("01BM25V2");

    const result = await runRetrievalPipeline({
      query: {
        workspaceId: "ws-1",
        query: "pricing policy",
        tokenBudget: 2000,
        retrievalMode: "precision",
      },
      vectorStore: createMockVectorStore(),
      embeddingClient: {
        async embed() {
          return [[0.1, 0.2, 0.3]];
        },
      },
      events,
      timingCollector: collector,
      parallelBm25V2: {
        enabled: true,
        lexicalStore: createInMemoryLexicalSearchStore(lexicalCorpus),
      },
    });

    assert.equal(result.contextPackage.memories[0]?.chunks[0]?.chunkId, "chunk-vector");
    const shadow = result.contextPackage.retrievalMetadata.lexicalChannelV2Shadow;
    assert.ok(shadow);
    assert.equal(shadow?.enabled, true);
    assert.equal(shadow?.mergePreview.strategy, "rrf_k60");

    const lexicalStage = result.stages.find((stage) => stage.stage === "lexical_channel_v2");
    assert.ok(lexicalStage);
    assert.equal(lexicalStage?.status, "completed");
    assert.equal(lexicalStage?.metadata?.shadow_only, true);

    const audit = collector.toAudit();
    assert.ok(audit.stages.some((stage) => stage.stage === "lexical_channel_v2"));
  });

  it("overlaps lexical search with vector embed path when flag is on", async () => {
    resetDefaultQueryEmbeddingCache();
    const events = createLoggingEventEmitter({
      logger: createLogger({ level: "silent" }),
    });

    let lexicalSearchStarted = 0;
    let embedStarted = 0;

    const lexicalStore = createInMemoryLexicalSearchStore(lexicalCorpus);
    const delayedLexicalStore = {
      async search(...args: Parameters<typeof lexicalStore.search>) {
        lexicalSearchStarted = Date.now();
        await new Promise((resolve) => setTimeout(resolve, 30));
        return lexicalStore.search(...args);
      },
    };

    await runRetrievalPipeline({
      query: {
        workspaceId: "ws-1",
        query: "pricing policy overlap probe unique",
        tokenBudget: 2000,
        retrievalMode: "precision",
      },
      vectorStore: createMockVectorStore(),
      embeddingClient: {
        async embed() {
          embedStarted = Date.now();
          await new Promise((resolve) => setTimeout(resolve, 30));
          return [[0.1, 0.2, 0.3]];
        },
      },
      events,
      parallelBm25V2: {
        enabled: true,
        lexicalStore: delayedLexicalStore,
      },
    });

    assert.ok(lexicalSearchStarted > 0);
    assert.ok(embedStarted > 0);
    const overlapMs = 30 - Math.abs(lexicalSearchStarted - embedStarted);
    assert.ok(overlapMs >= 0, "lexical channel should start alongside vector embed");
  });
});
