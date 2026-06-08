import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ContextPackage } from "@memory-middleware/shared-types";
import {
  getCompressionTrace,
  getCompressionTraceSummary,
  type StoredCompressionResult,
} from "./compression-store.js";

const traceId = "01JCOMPRESSIONSUMMARYTEST000001";
const workspaceId = "ws-compression-summary";

function buildLargeContextPackage(): ContextPackage {
  const memories = Array.from({ length: 80 }, (_, index) => ({
    memoryId: `mem-${index}`,
    title: `Memory title ${index}`,
    memoryType: "strategic" as const,
    sourceType: "ingestion" as const,
    version: 1,
    lineage: { sourceMemoryId: `mem-${index}`, parentMemoryIds: [] },
    memoryScore: 0.88,
    chunks: Array.from({ length: 4 }, (__, chunkIndex) => ({
      chunkId: `chunk-${index}-${chunkIndex}`,
      content: "x".repeat(2048),
      tokenCount: 512,
      sequence: chunkIndex,
      metadata: { tags: ["alpha", "beta", "gamma"], density: 0.72 },
    })),
    finalScore: 0.88,
    rankingRank: index + 1,
  }));

  return {
    query: "What changed in pipeline throughput last quarter?",
    workspaceId,
    retrievalTraceId: "01JRETRIEVALSUMMARYTEST000001",
    tokenBudget: { maxTokens: 8192, usedTokens: 6400, trimmedTokens: 0 },
    retrievalMetadata: {
      retrievalLatencyMs: 120,
      retrievedChunkCount: 320,
      deduplicatedChunkCount: 300,
      finalChunkCount: 280,
    },
    memories,
    rejectedCandidates: [],
    rankingBreakdown: [],
    chunkTraces: [],
    generatedAt: "2026-06-08T12:00:00.000Z",
  } as unknown as ContextPackage;
}

function buildStoredResult(): StoredCompressionResult {
  const originalContextPackage = buildLargeContextPackage();
  const optimizedContextPackage = {
    ...originalContextPackage,
    compressionTraceId: traceId,
    sourceRetrievalTraceId: originalContextPackage.retrievalTraceId,
    tokenBudget: { ...originalContextPackage.tokenBudget, usedTokens: 4200 },
    compressionMetadata: {
      fidelityMode: "balanced" as const,
      nuancePreservation: 0.85,
      tokenOptimization: 0.3,
      originalTokens: 6400,
      optimizedTokens: 4200,
      tokenSavings: 2200,
      fidelityScore: 0.94,
      abstractionUsed: false,
      preprocessingApplied: {
        queryHints: { retrievalHints: [], contextualWeights: {}, metadataTags: [] },
        metadataExpansion: {
          expandedTags: [],
          matchedMetadataKeys: [],
          enrichmentScore: 0,
        },
      },
      stages: [],
    },
  };

  return {
    retrievalTraceId: originalContextPackage.retrievalTraceId,
    fidelityMode: "balanced",
    nuancePreservation: 0.85,
    tokenOptimization: 0.3,
    stages: [{ stage: "overlap_detection", status: "completed", startedAt: "2026-06-08T12:00:01.000Z" }],
    stageTraces: [
      {
        compressionStage: "overlap_detection",
        affectedChunks: ["chunk-0-0", "chunk-0-1"],
        tokenSavings: 120,
        fidelityImpact: "low",
        compressionReason: "overlap merge",
        rankingPreservation: true,
        llmUsed: false,
      },
    ],
    originalContextPackage,
    optimizedContextPackage,
    fidelityReport: {
      fidelityScore: 0.94,
      nuancePreservationScore: 0.91,
      compressionAggressiveness: 0.34,
      retrievalQualityScore: 0.96,
      contextualPreservationScore: 0.93,
      validationPassed: true,
      issues: [],
      rankingPreservationRatio: 0.98,
      chunkRetentionRatio: 0.87,
    },
    mergeDecisions: [{ mergedChunkIds: ["a", "b"], resultChunkId: "c", overlapScore: 0.8, preservedRank: 1, reason: "overlap" }],
    trimmingDecisions: [{ chunkId: "d", memoryId: "mem-1", rankingRank: 4, finalScore: 0.4, tokenCount: 90, reason: "trim" }],
  };
}

function createMockPrisma(stored: StoredCompressionResult) {
  const op = {
    traceId,
    workspaceId,
    retrievalTraceId: stored.retrievalTraceId,
    status: "completed",
    createdAt: new Date("2026-06-08T12:00:00.000Z"),
    completedAt: new Date("2026-06-08T12:00:05.000Z"),
    result: stored,
  };

  return {
    compressionOperation: {
      async findFirst() {
        return op;
      },
    },
  };
}

describe("getCompressionTraceSummary", () => {
  it("returns metadata fields without context packages", async () => {
    const stored = buildStoredResult();
    const prisma = createMockPrisma(stored);

    const summary = await getCompressionTraceSummary(prisma as never, traceId);
    assert.ok(summary);
    assert.equal(summary.compressionTraceId, traceId);
    assert.equal(summary.compressionMetadata?.originalTokens, 6400);
    assert.equal(summary.compressionMetadata?.optimizedTokens, 4200);
    assert.equal(summary.compressionMetadata?.tokenSavings, 2200);
    assert.equal(summary.fidelityReport?.fidelityScore, 0.94);
    assert.equal(summary.mergeCount, 1);
    assert.equal(summary.trimCount, 1);
    assert.equal("originalContextPackage" in summary, false);
    assert.equal("optimizedContextPackage" in summary, false);
    assert.equal("stageTraces" in summary, false);
  });

  it("reduces serialized payload versus full trace for large context packages", async () => {
    const stored = buildStoredResult();
    const prisma = createMockPrisma(stored);

    const [full, summary] = await Promise.all([
      getCompressionTrace(prisma as never, traceId),
      getCompressionTraceSummary(prisma as never, traceId),
    ]);

    assert.ok(full);
    assert.ok(summary);

    const fullBytes = Buffer.byteLength(JSON.stringify({ trace: full }), "utf8");
    const summaryBytes = Buffer.byteLength(JSON.stringify({ trace: summary }), "utf8");

    assert.ok(fullBytes > 500_000, `expected large full payload, got ${fullBytes} bytes`);
    assert.ok(summaryBytes < 2_000, `expected small summary payload, got ${summaryBytes} bytes`);
    assert.ok(summaryBytes / fullBytes < 0.01, "summary should be <1% of full payload");
  });
});
