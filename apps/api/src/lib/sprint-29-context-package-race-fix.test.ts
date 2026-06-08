import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ContextPackage, RetrievalStageRecord } from "@memory-middleware/shared-types";
import { resolveContextPackage } from "./compression-store.js";
import {
  completeRetrievalOperation,
  getRetrievalTrace,
  mergeStoredRetrievalResult,
  persistRetrievalStageProgress,
  type StoredRetrievalResult,
} from "./retrieval-store.js";

const traceId = "01JSPRINT29RETRIEVALTRACE00001";
const workspaceId = "ws-sprint-29";

function buildContextPackage(): ContextPackage {
  return {
    query: "sprint-29 retrieval",
    workspaceId,
    retrievalTraceId: traceId,
    tokenBudget: { maxTokens: 4096, usedTokens: 512, trimmedTokens: 0 },
    retrievalMetadata: {
      retrievalLatencyMs: 40,
      retrievedChunkCount: 2,
      deduplicatedChunkCount: 2,
      finalChunkCount: 2,
    },
    memories: [{ memoryId: "m1", title: "Memory", memoryType: "note", chunks: [] }],
    rejectedCandidates: [],
    rankingBreakdown: [],
    chunkTraces: [],
    generatedAt: "2026-06-08T12:00:00.000Z",
  } as unknown as ContextPackage;
}

function buildStored(overrides: Partial<StoredRetrievalResult> = {}): StoredRetrievalResult {
  return {
    contextPackage: buildContextPackage(),
    stages: [{ stage: "context_assembly", status: "completed", startedAt: "2026-06-08T12:00:00.000Z" }],
    retrievalMode: "precision",
    tokenBudget: 4096,
    ...overrides,
  };
}

type MockRow = {
  traceId: string;
  workspaceId: string;
  query: string;
  status: string;
  createdAt: Date;
  completedAt: Date | null;
  result: StoredRetrievalResult;
};

function createRaceMockPrisma(initial: MockRow) {
  const row = structuredClone(initial);

  return {
    retrievalOperation: {
      async findFirst(args?: {
        where?: { traceId?: string; status?: string };
        orderBy?: { createdAt: "desc" };
      }) {
        if (args?.where?.traceId && args.where.traceId !== row.traceId) return null;
        if (args?.where?.status && args.where.status !== row.status) return null;
        return { ...row };
      },
      async updateMany(args: {
        where: { traceId: string; status?: string };
        data: Partial<Pick<MockRow, "status" | "completedAt" | "result">>;
      }) {
        if (args.where.traceId !== row.traceId) return { count: 0 };
        if (args.where.status && args.where.status !== row.status) return { count: 0 };

        if (args.data.result !== undefined) {
          row.result = args.data.result as unknown as StoredRetrievalResult;
        }
        if (args.data.status !== undefined) {
          row.status = args.data.status;
        }
        if (args.data.completedAt !== undefined) {
          row.completedAt = args.data.completedAt;
        }
        return { count: 1 };
      },
    },
    compressionOperation: {
      async findFirst() {
        return null;
      },
    },
  };
}

describe("sprint-29 context package race fix", () => {
  it("mergeStoredRetrievalResult preserves contextPackage when patch omits it", () => {
    const pkg = buildContextPackage();
    const prev: StoredRetrievalResult = {
      contextPackage: pkg,
      stages: [],
      retrievalMode: "precision",
      tokenBudget: 4096,
    };
    const merged = mergeStoredRetrievalResult(prev, {
      stages: [{ stage: "ranking", status: "completed", startedAt: "2026-06-08T12:00:00.000Z" }],
    });
    assert.equal(merged.contextPackage, pkg);
    assert.equal(merged.stages.length, 1);
  });

  it("completeRetrievalOperation persists package before completed status", async () => {
    const updateSequence: string[] = [];
    const prisma = createRaceMockPrisma({
      traceId,
      workspaceId,
      query: "race test",
      status: "processing",
      createdAt: new Date(),
      completedAt: null,
      result: { stages: [], retrievalMode: "precision", tokenBudget: 4096 },
    });

    const originalUpdateMany = prisma.retrievalOperation.updateMany.bind(prisma.retrievalOperation);
    prisma.retrievalOperation.updateMany = async (args) => {
      if (args.data.result !== undefined && args.data.status === undefined) {
        updateSequence.push("result");
      }
      if (args.data.status === "completed") {
        updateSequence.push("status");
      }
      return originalUpdateMany(args);
    };

    await completeRetrievalOperation(prisma as never, traceId, buildStored(), "completed");

    assert.deepEqual(updateSequence, ["result", "status"]);

    const op = await prisma.retrievalOperation.findFirst();
    assert.equal(op?.status, "completed");
    assert.ok(op?.result.contextPackage);
    assert.equal(op?.result.contextPackage?.memories.length, 1);
  });

  it("persistRetrievalStageProgress does not clobber a stored contextPackage", async () => {
    const stored = buildStored();
    const prisma = createRaceMockPrisma({
      traceId,
      workspaceId,
      query: "race test",
      status: "processing",
      createdAt: new Date(),
      completedAt: null,
      result: stored,
    });

    const lateStages: RetrievalStageRecord[] = [
      { stage: "keyword_search", status: "completed", startedAt: "2026-06-08T12:00:01.000Z" },
    ];

    await persistRetrievalStageProgress(prisma as never, traceId, lateStages, {
      retrievalMode: "precision",
      tokenBudget: 4096,
    });

    const op = await prisma.retrievalOperation.findFirst();
    assert.ok(op?.result.contextPackage);
    assert.equal(op?.result.stages.length, 1);
    assert.equal(op?.result.stages[0]?.stage, "context_assembly");
  });

  it("concurrent-style race: late stage progress after completion does not drop package", async () => {
    const prisma = createRaceMockPrisma({
      traceId,
      workspaceId,
      query: "race test",
      status: "processing",
      createdAt: new Date(),
      completedAt: null,
      result: { stages: [], retrievalMode: "precision", tokenBudget: 4096 },
    });

    await completeRetrievalOperation(prisma as never, traceId, buildStored(), "completed");

    await persistRetrievalStageProgress(
      prisma as never,
      traceId,
      [{ stage: "vector_search", status: "completed", startedAt: "2026-06-08T12:00:02.000Z" }],
      { retrievalMode: "precision", tokenBudget: 4096 },
    );

    const op = await prisma.retrievalOperation.findFirst();
    assert.equal(op?.status, "completed");
    assert.ok(op?.result.contextPackage);
    assert.equal(op?.result.contextPackage?.memories.length, 1);
  });

  it("completeRetrievalOperation rejects completed status without contextPackage", async () => {
    const prisma = createRaceMockPrisma({
      traceId,
      workspaceId,
      query: "race test",
      status: "processing",
      createdAt: new Date(),
      completedAt: null,
      result: { stages: [], retrievalMode: "precision", tokenBudget: 4096 },
    });

    await assert.rejects(
      () =>
        completeRetrievalOperation(
          prisma as never,
          traceId,
          { stages: [], retrievalMode: "precision", tokenBudget: 4096 },
          "completed",
        ),
      /Cannot mark retrieval completed without contextPackage/,
    );
  });

  it("resolveContextPackage returns retrieval_incomplete for processing traces", async () => {
    const prisma = createRaceMockPrisma({
      traceId,
      workspaceId,
      query: "in progress",
      status: "processing",
      createdAt: new Date(),
      completedAt: null,
      result: { stages: [], retrievalMode: "precision", tokenBudget: 4096 },
    });

    const result = await resolveContextPackage(prisma as never, {
      workspaceId,
      retrievalTraceId: traceId,
    });

    assert.equal("error" in result, true);
    if ("error" in result) {
      assert.equal(result.code, "retrieval_incomplete");
      assert.match(result.error, /still in progress/i);
    }
  });

  it("resolveContextPackage returns package for completed retrieval (compress-after-retrieve path)", async () => {
    const prisma = createRaceMockPrisma({
      traceId,
      workspaceId,
      query: "compress after retrieve",
      status: "processing",
      createdAt: new Date(),
      completedAt: null,
      result: { stages: [], retrievalMode: "precision", tokenBudget: 4096 },
    });

    await completeRetrievalOperation(prisma as never, traceId, buildStored(), "completed");

    const result = await resolveContextPackage(prisma as never, {
      workspaceId,
      retrievalTraceId: traceId,
    });

    assert.equal("error" in result, false);
    if (!("error" in result)) {
      assert.equal(result.retrievalTraceId, traceId);
      assert.equal(result.memories.length, 1);
    }
  });

  it("getRetrievalTrace exposes contextPackage for replay after two-phase completion", async () => {
    const prisma = createRaceMockPrisma({
      traceId,
      workspaceId,
      query: "replay trace",
      status: "processing",
      createdAt: new Date(),
      completedAt: null,
      result: { stages: [], retrievalMode: "precision", tokenBudget: 4096 },
    });

    await completeRetrievalOperation(prisma as never, traceId, buildStored(), "completed");

    const trace = await getRetrievalTrace(prisma as never, traceId);

    assert.ok(trace);
    assert.equal(trace?.status, "completed");
    assert.ok(trace?.contextPackage);
    assert.equal(trace?.contextPackage?.retrievalTraceId, traceId);
  });

  it("stress: interleaved stage progress and completion preserves package", async () => {
    const prisma = createRaceMockPrisma({
      traceId,
      workspaceId,
      query: "stress race",
      status: "processing",
      createdAt: new Date(),
      completedAt: null,
      result: { stages: [], retrievalMode: "precision", tokenBudget: 4096 },
    });

    const stageBurst = Array.from({ length: 12 }, (_, i) => ({
      stage: "vector_search" as const,
      status: "completed" as const,
      startedAt: `2026-06-08T12:00:${String(i).padStart(2, "0")}.000Z`,
    }));

    await Promise.all([
      completeRetrievalOperation(prisma as never, traceId, buildStored(), "completed"),
      ...stageBurst.map((stage) =>
        persistRetrievalStageProgress(prisma as never, traceId, [stage], {
          retrievalMode: "precision",
          tokenBudget: 4096,
        }),
      ),
    ]);

    const op = await prisma.retrievalOperation.findFirst();
    assert.equal(op?.status, "completed");
    assert.ok(op?.result.contextPackage);
    assert.equal(op?.result.contextPackage?.memories.length, 1);
  });
});
