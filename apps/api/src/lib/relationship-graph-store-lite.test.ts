import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getWorkspaceRelationshipGraph,
  type RelationshipGraphLiteView,
  type RelationshipGraphView,
} from "./relationship-graph-store.js";

const workspaceId = "ws-lite-test";

function createMockPrisma() {
  const queryLog: string[] = [];

  const relationships = [
    {
      id: "rel-1",
      sourceMemoryId: "mem-1",
      targetMemoryId: "mem-2",
      relationshipType: "semantic_overlap",
      weight: 0.82,
      metadata: { semanticOverlap: 0.7 },
      compressionTraceId: null,
      createdAt: new Date("2026-01-02T00:00:00.000Z"),
    },
  ];

  const memories = [
    {
      id: "mem-1",
      title: "Alpha memory",
      memoryType: "strategic",
      sourceType: "ingestion",
      archived: false,
      retrievalEligible: true,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      scoring: { reinforcementScore: 0.4 },
      chunks: [{ id: "chunk-1", metadata: { densityDetail: { combinedScore: 0.6, rankingInfluence: 0.3 } } }],
    },
    {
      id: "mem-2",
      title: "Beta memory",
      memoryType: "operational",
      sourceType: "unknown",
      archived: false,
      retrievalEligible: false,
      createdAt: new Date("2026-01-01T01:00:00.000Z"),
      scoring: {},
      chunks: [],
    },
  ];

  const retrievalOps = [
    {
      traceId: "ret-trace-1",
      query: "What changed in Q4 pipeline throughput?",
      createdAt: new Date("2026-01-03T00:00:00.000Z"),
      result: {
        contextPackage: {
          memories: [{ memoryId: "mem-1" }, { memoryId: "mem-2" }],
          chunkTraces: [
            { memoryId: "mem-1", rankingRank: 1 },
            { memoryId: "mem-2", rankingRank: 2 },
          ],
        },
      },
    },
  ];

  const compressionOps = [
    {
      traceId: "cmp-trace-1",
      createdAt: new Date("2026-01-04T00:00:00.000Z"),
    },
  ];

  const prisma = {
    workspace: {
      async findUnique() {
        queryLog.push("workspace.findUnique");
        return { id: workspaceId };
      },
    },
    memoryRelationship: {
      async findMany() {
        queryLog.push("memoryRelationship.findMany");
        return relationships;
      },
    },
    memory: {
      async findMany(args?: { include?: unknown; select?: unknown }) {
        queryLog.push(args?.include ? "memory.findMany.full" : "memory.findMany.lite");
        return memories;
      },
    },
    retrievalOperation: {
      async findMany() {
        queryLog.push("retrievalOperation.findMany");
        return retrievalOps;
      },
    },
    compressionOperation: {
      async findMany() {
        queryLog.push("compressionOperation.findMany");
        return compressionOps;
      },
    },
  };

  return {
    prisma: prisma as unknown as Parameters<typeof getWorkspaceRelationshipGraph>[0],
    queryLog,
    relationships,
    memories,
    retrievalOps,
    compressionOps,
  };
}

describe("getWorkspaceRelationshipGraph lite mode", () => {
  it("returns nodes and edges only without timeline, retrievalTraces, or heatmap queries", async () => {
    const { prisma, queryLog } = createMockPrisma();

    const graph = (await getWorkspaceRelationshipGraph(prisma, workspaceId, {
      lite: true,
    })) as RelationshipGraphLiteView;

    assert.equal(graph.workspaceId, workspaceId);
    assert.equal(graph.nodes.length, 2);
    assert.equal(graph.edges.length, 1);
    assert.equal("domains" in graph, false);
    assert.equal("timelineEvents" in graph, false);
    assert.equal("retrievalTraces" in graph, false);
    assert.equal("stats" in graph, false);
    assert.equal(graph.nodes[0]?.accessCount, 0);
    assert.equal(graph.nodes[0]?.chunkCount, 0);
    assert.deepEqual(queryLog, [
      "workspace.findUnique",
      "memoryRelationship.findMany",
      "memory.findMany.lite",
    ]);
  });

  it("keeps full graph shape and enrichment when lite is absent", async () => {
    const { prisma, queryLog } = createMockPrisma();

    const graph = (await getWorkspaceRelationshipGraph(prisma, workspaceId)) as RelationshipGraphView;

    assert.equal(graph.nodes.length, 2);
    assert.equal(graph.edges.length, 1);
    assert.equal(graph.domains.length, 2);
    assert.equal(graph.timelineEvents.length, 3);
    assert.equal(graph.retrievalTraces.length, 1);
    assert.equal(graph.stats.nodeCount, 2);
    assert.ok(graph.nodes.some((node) => node.accessCount > 0 || node.chunkCount > 0));
    assert.ok(
      queryLog.includes("retrievalOperation.findMany") &&
        queryLog.includes("compressionOperation.findMany") &&
        queryLog.includes("memory.findMany.full"),
    );
  });

  it("includes node and edge fields required by ContextualIntelligenceMap", async () => {
    const { prisma } = createMockPrisma();

    const graph = (await getWorkspaceRelationshipGraph(prisma, workspaceId, {
      lite: true,
    })) as RelationshipGraphLiteView;

    const node = graph.nodes[0];
    const edge = graph.edges[0];

    assert.ok(node);
    assert.ok(edge);
    for (const key of ["id", "label", "domain", "accessCount", "retrievalEligible"] as const) {
      assert.ok(key in node, `node missing ${key}`);
    }
    for (const key of ["source", "target", "weight"] as const) {
      assert.ok(key in edge, `edge missing ${key}`);
    }
  });

  it("preserves node and edge id schema between lite and full responses", async () => {
    const { prisma } = createMockPrisma();

    const lite = (await getWorkspaceRelationshipGraph(prisma, workspaceId, {
      lite: true,
    })) as RelationshipGraphLiteView;
    const full = (await getWorkspaceRelationshipGraph(prisma, workspaceId)) as RelationshipGraphView;

    assert.deepEqual(
      lite.nodes.map((node) => node.id).sort(),
      full.nodes.map((node) => node.id).sort(),
    );
    assert.deepEqual(lite.edges, full.edges);
  });

  it("reduces serialized payload size by at least 50% for representative graph data", async () => {
    const { prisma } = createMockPrisma();

    const lite = await getWorkspaceRelationshipGraph(prisma, workspaceId, { lite: true });
    const full = await getWorkspaceRelationshipGraph(prisma, workspaceId);

    const liteBytes = Buffer.byteLength(JSON.stringify(lite), "utf8");
    const fullBytes = Buffer.byteLength(JSON.stringify(full), "utf8");
    const reductionPct = ((fullBytes - liteBytes) / fullBytes) * 100;

    assert.ok(liteBytes < fullBytes);
    assert.ok(reductionPct >= 50, `expected >=50% reduction, got ${reductionPct.toFixed(1)}%`);
  });
});
