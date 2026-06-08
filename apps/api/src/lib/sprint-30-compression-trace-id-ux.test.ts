import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ContextPackage } from "@memory-middleware/shared-types";
import {
  buildCompressionTraceIdMismatchError,
  resolveContextPackage,
} from "./compression-store.js";

const workspaceId = "ws-sprint-30";
const retrievalTraceId = "01JSPRINT30RETRIEVALTRACE00001";
const compressionTraceId = "01JSPRINT30COMPRESSIONTRACE001";

function buildContextPackage(): ContextPackage {
  return {
    query: "sprint-30 retrieval",
    workspaceId,
    retrievalTraceId,
    tokenBudget: { maxTokens: 4096, usedTokens: 512, trimmedTokens: 0 },
    retrievalMetadata: {
      retrievalLatencyMs: 40,
      retrievedChunkCount: 2,
      deduplicatedChunkCount: 2,
      finalChunkCount: 2,
    },
    memories: [],
    rejectedCandidates: [],
    rankingBreakdown: [],
    chunkTraces: [],
    generatedAt: "2026-06-08T12:00:00.000Z",
  } as unknown as ContextPackage;
}

function createMockPrisma(options: {
  retrievalTrace?: {
    traceId: string;
    workspaceId: string;
    status: string;
    contextPackage?: ContextPackage;
  } | null;
  compressionOp?: {
    traceId: string;
    retrievalTraceId: string;
  } | null;
}) {
  return {
    retrievalOperation: {
      async findFirst() {
        if (!options.retrievalTrace) return null;
        return {
          traceId: options.retrievalTrace.traceId,
          workspaceId: options.retrievalTrace.workspaceId,
          query: "test",
          status: options.retrievalTrace.status,
          createdAt: new Date(),
          result: {
            retrievalMode: "precision",
            tokenBudget: 4096,
            stages: [],
            ...(options.retrievalTrace.contextPackage
              ? { contextPackage: options.retrievalTrace.contextPackage }
              : {}),
          },
        };
      },
    },
    compressionOperation: {
      async findFirst() {
        if (!options.compressionOp) return null;
        return {
          traceId: options.compressionOp.traceId,
          retrievalTraceId: options.compressionOp.retrievalTraceId,
          workspaceId,
          status: "completed",
          createdAt: new Date(),
          result: {},
        };
      },
    },
  };
}

describe("sprint-30 compression trace ID UX", () => {
  it("returns structured mismatch error when compression trace ID is supplied", async () => {
    const prisma = createMockPrisma({
      retrievalTrace: null,
      compressionOp: { traceId: compressionTraceId, retrievalTraceId },
    });

    const result = await resolveContextPackage(prisma as never, {
      workspaceId,
      retrievalTraceId: compressionTraceId,
    });

    assert.equal("code" in result, true);
    if (!("code" in result)) return;

    assert.equal(result.code, "compression_trace_id_provided");
    assert.equal(result.suppliedTraceId, compressionTraceId);
    assert.equal(result.compressionTraceId, compressionTraceId);
    assert.equal(result.retrievalTraceId, retrievalTraceId);
    assert.match(result.error, /compression trace ID/i);
    assert.match(result.error, new RegExp(retrievalTraceId));
  });

  it("buildCompressionTraceIdMismatchError includes actionable retrievalTraceId", () => {
    const body = buildCompressionTraceIdMismatchError(compressionTraceId, retrievalTraceId);
    assert.equal(body.code, "compression_trace_id_provided");
    assert.equal(body.retrievalTraceId, retrievalTraceId);
    assert.match(body.error, /compression-traces/);
  });

  it("resolves context package for a valid retrieval trace ID", async () => {
    const contextPackage = buildContextPackage();
    const prisma = createMockPrisma({
      retrievalTrace: {
        traceId: retrievalTraceId,
        workspaceId,
        status: "completed",
        contextPackage,
      },
      compressionOp: null,
    });

    const result = await resolveContextPackage(prisma as never, {
      workspaceId,
      retrievalTraceId,
    });

    assert.equal("code" in result, false);
    assert.equal((result as ContextPackage).retrievalTraceId, retrievalTraceId);
  });
});
