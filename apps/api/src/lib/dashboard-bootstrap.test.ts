import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import type { PrismaClient } from "@prisma/client";
import { loadDashboardBootstrapSummary } from "./dashboard-bootstrap.js";

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(here, "..");

function readSource(relativePath: string): string {
  return readFileSync(join(srcRoot, relativePath), "utf8");
}

function createMockPrisma(): PrismaClient {
  return {
    memory: {
      findMany: async () => [
        {
          id: "mem-1",
          title: "Fixture memory",
          memoryType: "semantic",
          persistenceMode: "persistent",
          archived: false,
        },
      ],
    },
    ingestionTrace: {
      findMany: async () => [
        {
          traceId: "ing-1",
          workspaceId: "ws-sprint-13",
          memoryId: "mem-1",
          status: "completed",
          sourceType: "upload",
          createdAt: new Date("2026-06-08T12:00:00.000Z"),
        },
      ],
    },
    retrievalOperation: {
      findMany: async () => [
        {
          traceId: "ret-1",
          workspaceId: "ws-sprint-13",
          query: "fixture query",
          status: "completed",
          result: {
            contextPackage: { chunkTraces: [] },
            rankingBreakdown: [{ memoryId: "m1", score: 0.9 }],
            stages: [{ stage: "ranking", status: "completed" }],
          },
          createdAt: new Date("2026-06-08T12:00:00.000Z"),
          completedAt: new Date("2026-06-08T12:00:01.000Z"),
        },
      ],
    },
    $queryRaw: async () => [{ ok: 1 }],
  } as unknown as PrismaClient;
}

describe("sprint-13 dashboard bootstrap", () => {
  it("loadDashboardBootstrapSummary batches memory, retrieval, ingestion, and health probes", () => {
    const source = readSource("lib/dashboard-bootstrap.ts");
    assert.match(source, /Promise\.all\(/);
    assert.match(source, /prisma\.memory\.findMany/);
    assert.match(source, /listRetrievalTraces/);
    assert.match(source, /prisma\.ingestionTrace\.findMany/);
    assert.match(source, /\$queryRaw`SELECT 1`/);
    assert.match(source, /tier:\s*"summary"/);
  });

  it("registers GET /workspaces/:workspaceId/dashboard-bootstrap with workspace scope enforcement", () => {
    const source = readSource("routes/workspaces.ts");
    assert.match(source, /\/workspaces\/:workspaceId\/dashboard-bootstrap/);
    assert.match(source, /enforceWorkspaceScope/);
    assert.match(source, /loadDashboardBootstrapSummary/);
  });

  it("exports typed DashboardBootstrapResponse from shared-types", () => {
    const contractsPath = join(srcRoot, "..", "..", "..", "packages", "shared-types", "src", "dashboard-bootstrap-contracts.ts");
    const source = readFileSync(contractsPath, "utf8");
    assert.match(source, /export interface DashboardBootstrapResponse/);
    assert.match(source, /tier:\s*"summary"/);
    assert.doesNotMatch(source, /contextPackage/);
    assert.doesNotMatch(source, /rankingBreakdown/);
  });

  it("loadDashboardBootstrapSummary returns slim rows without full trace bodies", async () => {
    const prisma = createMockPrisma();
    const payload = await loadDashboardBootstrapSummary(prisma, "ws-sprint-13", "trace-13");

    assert.equal(payload.workspaceId, "ws-sprint-13");
    assert.equal(payload.tier, "summary");
    assert.equal(payload.memories.length, 1);
    assert.equal(payload.retrievalTraces.length, 1);
    assert.equal(payload.ingestionTraces.length, 1);
    assert.equal(payload.health.status, "ok");
    assert.equal(payload.health.trace_id, "trace-13");

    const serialized = JSON.stringify(payload);
    assert.doesNotMatch(serialized, /contextPackage/);
    assert.doesNotMatch(serialized, /rankingBreakdown/);
    assert.doesNotMatch(serialized, /"stages"/);
    assert.doesNotMatch(serialized, /"result"/);
  });

  it("loadDashboardBootstrapSummary degrades health when DB probe fails", async () => {
    const prisma = createMockPrisma();
    prisma.$queryRaw = async () => {
      throw new Error("db unavailable");
    };

    const payload = await loadDashboardBootstrapSummary(prisma, "ws-sprint-13");
    assert.equal(payload.health.status, "degraded");
  });
});
