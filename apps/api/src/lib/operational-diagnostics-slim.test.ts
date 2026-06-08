import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ReplaySnapshot } from "@memory-middleware/shared-types";
import {
  buildFullOperationalDiagnosticsReport,
  buildSlimOperationalDiagnosticsReport,
  enrichTracesForOperationalDiagnostics,
  type RetrievalTraceSummary,
} from "./operational-diagnostics.js";
import type { StoredRetrievalResult } from "./retrieval-store.js";
import {
  getRetrievalFailureInfoByTraceIds,
  getRetrievalResultsByTraceIds,
} from "./retrieval-store.js";

function createFixtureInputs() {
  const traces: RetrievalTraceSummary[] = [
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
    {
      retrievalTraceId: "ok-1",
      query: "healthy query",
      status: "completed",
      createdAt: "2026-01-03T00:00:00.000Z",
    },
  ];

  const resultsByTraceId = new Map<string, StoredRetrievalResult>([
    [
      "failed-1",
      {
        stages: [
          { stage: "vector_search", status: "failed", startedAt: "2026-01-01T00:00:00.000Z" },
        ],
        retrievalMode: "precision",
        tokenBudget: 1000,
        error: "vector timeout",
      },
    ],
    [
      "low-conf-1",
      {
        stages: [{ stage: "ranking", status: "completed", startedAt: "2026-01-02T00:00:00.000Z" }],
        retrievalMode: "precision",
        tokenBudget: 1000,
      },
    ],
  ]);

  const snapshotByTrace = new Map<string, ReplaySnapshot>([
    [
      "low-conf-1",
      {
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
      } as unknown as ReplaySnapshot,
    ],
    [
      "ok-1",
      {
        retrievalTraceId: "ok-1",
        workspaceId: "ws-1",
        originalQuery: "healthy query",
        replayTimestamp: "2026-01-03T00:00:00.000Z",
        rankingBreakdowns: [{ finalScore: 0.9, memoryId: "m2", chunkId: "c2" }],
        contextPackage: {
          chunkTraces: [
            { chunkId: "c2", tokenBudgetDecision: "included", deduplicationDecision: "kept" },
          ],
          rejectedCandidates: [],
          tokenBudget: { maxTokens: 1000, usedTokens: 100, trimmedTokens: 0 },
        },
        compressionArtifacts: [],
      } as unknown as ReplaySnapshot,
    ],
  ]);

  return { traces, resultsByTraceId, snapshotByTrace };
}

describe("operational diagnostics slim mode", () => {
  it("slim counts match full report section lengths", () => {
    const { traces, resultsByTraceId, snapshotByTrace } = createFixtureInputs();
    const enriched = enrichTracesForOperationalDiagnostics(
      traces,
      resultsByTraceId,
      snapshotByTrace,
    );

    const full = buildFullOperationalDiagnosticsReport("ws-1", enriched);
    const slim = buildSlimOperationalDiagnosticsReport("ws-1", enriched);

    assert.equal(slim.mode, "slim");
    assert.equal(slim.counts.failedRetrievals, full.failedRetrievals.length);
    assert.equal(slim.counts.lowConfidenceRetrievals, full.lowConfidenceRetrievals.length);
    assert.equal(slim.counts.tokenWaste, full.tokenWaste.length);
    assert.equal(slim.counts.contextualDegradation, full.contextualDegradation.length);
    assert.equal(slim.counts.failedRetrievals, 1);
    assert.equal(slim.counts.lowConfidenceRetrievals, 1);
  });

  it("slim JSON payload is much smaller than full report JSON", () => {
    const { traces, resultsByTraceId, snapshotByTrace } = createFixtureInputs();
    const enriched = enrichTracesForOperationalDiagnostics(
      traces,
      resultsByTraceId,
      snapshotByTrace,
    );

    const full = buildFullOperationalDiagnosticsReport("ws-1", enriched);
    const slim = buildSlimOperationalDiagnosticsReport("ws-1", enriched);

    const fullBytes = Buffer.byteLength(JSON.stringify({ report: full }), "utf8");
    const slimBytes = Buffer.byteLength(JSON.stringify({ report: slim }), "utf8");

    assert.ok(slimBytes < fullBytes);
    assert.ok(slimBytes < 512, `expected slim payload under 512 B, got ${slimBytes}`);
  });

  it("full report preserves failedStage and error on failed retrievals", () => {
    const { traces, resultsByTraceId, snapshotByTrace } = createFixtureInputs();
    const enriched = enrichTracesForOperationalDiagnostics(
      traces,
      resultsByTraceId,
      snapshotByTrace,
    );
    const full = buildFullOperationalDiagnosticsReport("ws-1", enriched);

    assert.equal(full.failedRetrievals[0]?.failedStage, "vector_search");
    assert.equal(full.failedRetrievals[0]?.error, "vector timeout");
  });

  it("failure-info batch fetch extracts failedStage without full result shape", async () => {
    const prisma = {
      retrievalOperation: {
        async findMany() {
          return [
            {
              traceId: "failed-1",
              result: {
                stages: [
                  { stage: "ranking", status: "failed", startedAt: "2026-01-01T00:00:00.000Z" },
                ],
                error: "ranking failed",
                contextPackage: { chunkTraces: [], rejectedCandidates: [], tokenBudget: {} },
                retrievalMode: "precision",
                tokenBudget: 1000,
              },
            },
          ];
        },
      },
    };

    const info = await getRetrievalFailureInfoByTraceIds(
      prisma as unknown as Parameters<typeof getRetrievalFailureInfoByTraceIds>[0],
      ["failed-1"],
    );
    const entry = info.get("failed-1");

    assert.equal(entry?.failedStage, "ranking");
    assert.equal(entry?.error, "ranking failed");
    assert.equal("contextPackage" in (entry ?? {}), false);
  });

  it("slim path only queries failure info for failed trace ids", async () => {
    let queriedTraceIds: string[] = [];
    const prisma = {
      retrievalOperation: {
        async findMany(args: { where: { traceId: { in: string[] } } }) {
          queriedTraceIds = args.where.traceId.in;
          return queriedTraceIds.map((traceId) => ({
            traceId,
            result: {
              stages: [{ stage: "vector_search", status: "failed", startedAt: "2026-01-01" }],
              error: "timeout",
            },
          }));
        },
      },
    };

    await getRetrievalFailureInfoByTraceIds(
      prisma as unknown as Parameters<typeof getRetrievalFailureInfoByTraceIds>[0],
      ["failed-1", "failed-2"],
    );

    assert.deepEqual(queriedTraceIds, ["failed-1", "failed-2"]);

    let fullQueryCount = 0;
    const fullPrisma = {
      retrievalOperation: {
        async findMany() {
          fullQueryCount += 1;
          return [];
        },
      },
    };
    await getRetrievalResultsByTraceIds(
      fullPrisma as unknown as Parameters<typeof getRetrievalResultsByTraceIds>[0],
      ["t1", "t2", "t3"],
    );
    assert.equal(fullQueryCount, 1);
  });
});
