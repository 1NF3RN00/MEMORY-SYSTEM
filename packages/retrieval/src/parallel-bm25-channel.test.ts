import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildLexicalChannelShadow,
  buildRrfMergePreview,
  evaluateParallelBm25Channel,
  RRF_K,
} from "./parallel-bm25-channel.js";
import { createInMemoryLexicalSearchStore } from "./lexical-search-store.js";

const corpus = [
  {
    workspaceId: "ws-1",
    memoryId: "mem-1",
    chunkId: "chunk-vector",
    sequence: 0,
    content: "enterprise pricing policy details",
    tokenCount: 10,
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
  {
    workspaceId: "ws-1",
    memoryId: "mem-3",
    chunkId: "chunk-unrelated",
    sequence: 0,
    content: "infrastructure monitoring runbook",
    tokenCount: 6,
    memoryType: "document",
    title: "Ops",
  },
];

describe("parallel-bm25-channel", () => {
  it("buildRrfMergePreview uses documented k constant", () => {
    assert.equal(RRF_K, 60);
    const preview = buildRrfMergePreview(["a", "b"], ["b", "c"]);
    assert.equal(preview.strategy, "rrf_k60");
    assert.equal(preview.overlapWithVector, 1);
    assert.ok(preview.previewTopChunkIds.includes("b"));
  });

  it("evaluateParallelBm25Channel returns shadow metadata without vector mutation", async () => {
    const lexicalStore = createInMemoryLexicalSearchStore(corpus);
    const startedAt = Date.now();

    const { shadow, lexicalCandidates } = await evaluateParallelBm25Channel(
      {
        queryText: "pricing policy",
        queryTerms: ["pricing", "policy"],
        filter: { workspaceId: "ws-1" },
        topK: 5,
        lexicalStore,
        vectorCandidates: [{ chunkId: "chunk-vector", memoryId: "mem-1" }],
      },
      startedAt,
    );

    assert.equal(shadow.enabled, true);
    assert.ok(lexicalCandidates.length > 0);
    assert.ok(shadow.mergePreview.previewTopChunkIds.length > 0);
    assert.equal(shadow.mergePreview.strategy, "rrf_k60");
  });

  it("buildLexicalChannelShadow records overlap count", () => {
    const shadow = buildLexicalChannelShadow(
      [
        {
          chunkId: "chunk-vector",
          memoryId: "mem-1",
          sequence: 0,
          content: "enterprise pricing policy details",
          tokenCount: 10,
          lexicalScore: 2.1,
          memoryType: "document",
          title: "Pricing",
        },
        {
          chunkId: "chunk-lexical-only",
          memoryId: "mem-2",
          sequence: 0,
          content: "pricing policy compliance guidelines",
          tokenCount: 8,
          lexicalScore: 1.8,
          memoryType: "document",
          title: "Compliance",
        },
      ],
      [{ chunkId: "chunk-vector", memoryId: "mem-1" }],
      Date.now() - 5,
    );

    assert.equal(shadow.candidateCount, 2);
    assert.equal(shadow.mergePreview.overlapWithVector, 1);
    assert.equal(shadow.topCandidates[0]?.rank, 1);
  });
});
