import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ReplaySnapshot } from "@memory-middleware/shared-types";
import {
  buildFullOperationalDiagnosticsReport,
  enrichTracesForOperationalDiagnostics,
  type RetrievalTraceSummary,
} from "./operational-diagnostics.js";
import {
  getRetrievalResultsByTraceIds,
  type StoredRetrievalResult,
} from "./retrieval-store.js";

type TraceSummary = RetrievalTraceSummary;

function createMockPrisma(operations: Array<{ traceId: string; result: unknown; createdAt?: Date }>) {
  let findManyCalls = 0;
  let findFirstCalls = 0;

  const prisma = {
    retrievalOperation: {
      async findMany() {
        findManyCalls += 1;
        return operations.map((op) => ({
          traceId: op.traceId,
          result: op.result,
          createdAt: op.createdAt ?? new Date("2026-01-01T00:00:00.000Z"),
        }));
      },
      async findFirst() {
        findFirstCalls += 1;
        return null;
      },
    },
  };

  return {
    prisma: prisma as unknown as Parameters<typeof getRetrievalResultsByTraceIds>[0],
    getCounts: () => ({ findManyCalls, findFirstCalls }),
  };
}

describe("operational diagnostics batch fetch", () => {
  it("issues one findMany and zero findFirst for many trace ids", async () => {
    const traceIds = Array.from({ length: 100 }, (_, i) => `trace-${i}`);
    const { prisma, getCounts } = createMockPrisma(
      traceIds.map((traceId) => ({
        traceId,
        result: { stages: [], retrievalMode: "precision", tokenBudget: 1000 },
      })),
    );

    const results = await getRetrievalResultsByTraceIds(prisma, traceIds);
    const counts = getCounts();

    assert.equal(counts.findManyCalls, 1);
    assert.equal(counts.findFirstCalls, 0);
    assert.equal(results.size, 100);
  });

  it("returns empty map without querying when traceIds is empty", async () => {
    const { prisma, getCounts } = createMockPrisma([]);
    const results = await getRetrievalResultsByTraceIds(prisma, []);
    const counts = getCounts();

    assert.equal(results.size, 0);
    assert.equal(counts.findManyCalls, 0);
    assert.equal(counts.findFirstCalls, 0);
  });

  it("keeps findMany count at O(1) as trace id count grows", async () => {
    const sizes = [10, 50, 100];
    for (const size of sizes) {
      const traceIds = Array.from({ length: size }, (_, i) => `trace-${size}-${i}`);
      const { prisma, getCounts } = createMockPrisma(
        traceIds.map((traceId) => ({
          traceId,
          result: { stages: [], retrievalMode: "precision", tokenBudget: 1000 },
        })),
      );

      await getRetrievalResultsByTraceIds(prisma, traceIds);
      const counts = getCounts();

      assert.equal(counts.findManyCalls, 1, `expected one findMany for size=${size}`);
      assert.equal(counts.findFirstCalls, 0, `expected zero findFirst for size=${size}`);
    }
  });

  it("keeps the latest operation per traceId when duplicates exist", async () => {
    const { prisma } = createMockPrisma([
      {
        traceId: "trace-dup",
        result: {
          stages: [{ stage: "ranking", status: "failed" }],
          retrievalMode: "precision",
          tokenBudget: 1000,
          error: "latest",
        },
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
      },
      {
        traceId: "trace-dup",
        result: { stages: [], retrievalMode: "precision", tokenBudget: 1000, error: "old" },
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ]);

    const results = await getRetrievalResultsByTraceIds(prisma, ["trace-dup"]);
    const stored = results.get("trace-dup");

    assert.equal(stored?.error, "latest");
    assert.equal(stored?.stages?.[0]?.stage, "ranking");
  });

  it("preserves operational diagnostics report shape for fixture traces", () => {
    const traces: TraceSummary[] = [
      {
        retrievalTraceId: "failed-1",
        query: "failed query",
        status: "failed",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        retrievalTraceId: "low-conf-1",
        query: "low confidence query",
        status: "completed",
        createdAt: "2026-01-02T00:00:00.000Z",
      },
    ];

    const resultsByTraceId = new Map<string, StoredRetrievalResult>([
      [
        "failed-1",
        {
          stages: [{ stage: "vector_search", status: "failed", startedAt: "2026-01-01T00:00:00.000Z" }],
          retrievalMode: "precision",
          tokenBudget: 1000,
          error: "vector timeout",
        } satisfies StoredRetrievalResult,
      ],
      [
        "low-conf-1",
        {
          stages: [{ stage: "ranking", status: "completed", startedAt: "2026-01-02T00:00:00.000Z" }],
          retrievalMode: "precision",
          tokenBudget: 1000,
        } satisfies StoredRetrievalResult,
      ],
    ]);

    const snapshot = {
      retrievalTraceId: "low-conf-1",
      workspaceId: "ws-1",
      originalQuery: "low confidence query",
      replayTimestamp: "2026-01-02T00:00:00.000Z",
      rankingBreakdowns: [{ finalScore: 0.3, memoryId: "m1", chunkId: "c1" }],
      contextPackage: {
        chunkTraces: [
          { chunkId: "c1", tokenBudgetDecision: "included", deduplicationDecision: "kept" },
        ],
        rejectedCandidates: [],
        tokenBudget: { maxTokens: 1000, usedTokens: 100, trimmedTokens: 0 },
      },
      compressionArtifacts: [],
    } as unknown as ReplaySnapshot;

    const enriched = enrichTracesForOperationalDiagnostics(
      traces,
      resultsByTraceId,
      new Map([["low-conf-1", snapshot]]),
    );

    const report = buildFullOperationalDiagnosticsReport("ws-1", enriched);

    assert.equal(report.workspaceId, "ws-1");
    assert.equal(report.failedRetrievals.length, 1);
    assert.equal(report.failedRetrievals[0]?.retrievalTraceId, "failed-1");
    assert.equal(report.failedRetrievals[0]?.error, "vector timeout");
    assert.equal(report.failedRetrievals[0]?.failedStage, "vector_search");
    assert.equal(report.lowConfidenceRetrievals.length, 1);
    assert.equal(report.lowConfidenceRetrievals[0]?.retrievalTraceId, "low-conf-1");
    assert.equal(report.lowConfidenceRetrievals[0]?.topScore, 0.3);
    assert.ok(report.generatedAt);
  });
});
