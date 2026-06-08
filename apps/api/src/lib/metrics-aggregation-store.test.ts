import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  backfillWorkspaceMetrics,
  getWorkspaceMetricsSummary,
  recordRetrievalMetrics,
} from "./metrics-aggregation-store.js";

type MetricsRow = {
  workspaceId: string;
  activeMemories: number;
  retrievalTotal: number;
  retrievalCompleted: number;
  retrievalFailed: number;
  retrieval24h: number;
  retrievalFailed24h: number;
  retrievalLatencySumMs: bigint;
  retrievalLatencyCount: number;
  ingestionTotal: number;
  ingestionCompleted: number;
  ingestionFailed: number;
  ingestion24h: number;
  compressionTotal: number;
  compressionCompleted: number;
  compressionFailed: number;
  contextRenderTotal: number;
  contextRenderCompleted: number;
  contextRenderFailed: number;
  rollingWindowStartAt: Date;
  updatedAt: Date;
};

function createMockPrisma() {
  const rows = new Map<string, MetricsRow>();

  const defaultRow = (workspaceId: string): MetricsRow => ({
    workspaceId,
    activeMemories: 0,
    retrievalTotal: 0,
    retrievalCompleted: 0,
    retrievalFailed: 0,
    retrieval24h: 0,
    retrievalFailed24h: 0,
    retrievalLatencySumMs: 0n,
    retrievalLatencyCount: 0,
    ingestionTotal: 0,
    ingestionCompleted: 0,
    ingestionFailed: 0,
    ingestion24h: 0,
    compressionTotal: 0,
    compressionCompleted: 0,
    compressionFailed: 0,
    contextRenderTotal: 0,
    contextRenderCompleted: 0,
    contextRenderFailed: 0,
    rollingWindowStartAt: new Date(),
    updatedAt: new Date(),
  });

  const counts: Record<string, number> = {
    memory: 3,
    retrievalOperation: 5,
    ingestionTrace: 2,
    compressionOperation: 1,
    contextRenderOperation: 0,
  };

  return {
    workspaceMetricsSummary: {
      findUnique: async ({ where }: { where: { workspaceId: string } }) =>
        rows.get(where.workspaceId) ?? null,
      create: async ({ data }: { data: { workspace: { connect: { id: string } } } }) => {
        const workspaceId = data.workspace.connect.id;
        const row = defaultRow(workspaceId);
        rows.set(workspaceId, row);
        return row;
      },
      update: async ({
        where,
        data,
      }: {
        where: { workspaceId: string };
        data: Record<string, unknown>;
      }) => {
        const row = rows.get(where.workspaceId) ?? defaultRow(where.workspaceId);
        for (const [key, value] of Object.entries(data)) {
          if (value && typeof value === "object" && "increment" in value) {
            const inc = (value as { increment: number | bigint }).increment;
            const current = row[key as keyof MetricsRow];
            if (typeof current === "bigint" && typeof inc === "bigint") {
              (row as Record<string, unknown>)[key] = current + inc;
            } else if (typeof current === "number" && typeof inc === "number") {
              (row as Record<string, unknown>)[key] = current + inc;
            }
          } else if (key === "rollingWindowStartAt" && value instanceof Date) {
            row.rollingWindowStartAt = value;
          } else if (typeof value === "number" || typeof value === "bigint") {
            (row as Record<string, unknown>)[key] = value;
          }
        }
        row.updatedAt = new Date();
        rows.set(where.workspaceId, row);
        return row;
      },
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { workspaceId: string };
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) => {
        const existing = rows.get(where.workspaceId);
        if (existing) {
          Object.assign(existing, update);
          rows.set(where.workspaceId, existing);
          return existing;
        }
        const workspaceId =
          (create.workspace as { connect: { id: string } }).connect.id ?? where.workspaceId;
        const row = { ...defaultRow(workspaceId), ...create, workspaceId } as MetricsRow;
        rows.set(workspaceId, row);
        return row;
      },
    },
    memory: {
      count: async () => counts.memory,
    },
    retrievalOperation: {
      count: async ({ where }: { where?: { status?: string; createdAt?: { gte: Date } } }) => {
        if (where?.status === "completed") return 4;
        if (where?.status === "failed") return 1;
        if (where?.createdAt) return 2;
        return counts.retrievalOperation;
      },
      findMany: async () => [
        {
          createdAt: new Date(Date.now() - 1000),
          completedAt: new Date(),
        },
      ],
    },
    ingestionTrace: {
      count: async ({ where }: { where?: { status?: string | { in: string[] }; createdAt?: { gte: Date } } }) => {
        if (where?.status && typeof where.status === "object" && "in" in where.status) return 2;
        if (where?.status === "failed") return 0;
        if (where?.createdAt) return 1;
        return counts.ingestionTrace;
      },
    },
    compressionOperation: {
      count: async ({ where }: { where?: { status?: string } }) => {
        if (where?.status === "completed") return 1;
        if (where?.status === "failed") return 0;
        return counts.compressionOperation;
      },
    },
    contextRenderOperation: {
      count: async () => counts.contextRenderOperation,
    },
    rows,
  };
}

describe("metrics-aggregation-store", () => {
  it("recordRetrievalMetrics increments completed counters and latency", async () => {
    const prisma = createMockPrisma() as never;
    await recordRetrievalMetrics(prisma, "ws-1", "completed", 120);
    const summary = await getWorkspaceMetricsSummary(prisma, "ws-1");
    assert.equal(summary.retrieval.total, 1);
    assert.equal(summary.retrieval.completed, 1);
    assert.equal(summary.retrieval.avgLatencyMs, 120);
  });

  it("backfillWorkspaceMetrics upserts counts from operation tables", async () => {
    const prisma = createMockPrisma() as never;
    const result = await backfillWorkspaceMetrics(prisma, "ws-backfill");
    assert.equal(result.activeMemories, 3);
    assert.equal(result.retrievalTotal, 5);
    assert.equal(result.ingestionTotal, 2);
    const summary = await getWorkspaceMetricsSummary(prisma, "ws-backfill");
    assert.equal(summary.activeMemories, 3);
    assert.equal(summary.retrieval.total, 5);
    assert.equal(summary.retrieval.completed, 4);
    assert.equal(summary.retrieval.failed, 1);
  });

  it("getWorkspaceMetricsSummary returns zeros when row missing", async () => {
    const prisma = createMockPrisma() as never;
    const summary = await getWorkspaceMetricsSummary(prisma, "ws-missing");
    assert.equal(summary.workspaceId, "ws-missing");
    assert.equal(summary.retrieval.total, 0);
    assert.equal(summary.ingestion.total, 0);
  });
});
