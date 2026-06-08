import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  analyzeExplainPlan,
  buildRecommendations,
  mapPostgresExplainPlan,
  parseExplainPayload,
  PGVECTOR_EXPLAIN_VARIANTS,
} from "./benchmark-pgvector-explain.js";

describe("benchmark-pgvector-explain helpers", () => {
  it("parses Postgres EXPLAIN JSON plan nodes", () => {
    const payload = [
      {
        Plan: {
          "Node Type": "Limit",
          "Actual Total Time": 2.5,
          Plans: [
            {
              "Node Type": "Index Scan",
              "Relation Name": "memory_chunks",
              "Index Name": "memory_chunks_embedding_hnsw_idx",
              "Actual Total Time": 2.1,
            },
          ],
        },
        "Planning Time": 0.12,
        "Execution Time": 2.5,
      },
    ];

    const parsed = parseExplainPayload(payload);
    assert.ok(parsed.plan);
    assert.equal(parsed.planningTimeMs, 0.12);
    assert.equal(parsed.executionTimeMs, 2.5);

    const analyzed = analyzeExplainPlan(parsed.plan, parsed.executionTimeMs);
    assert.equal(analyzed.usesHnswIndex, true);
    assert.equal(analyzed.usesSeqScanOnChunks, false);
    assert.deepEqual(analyzed.indexNames, ["memory_chunks_embedding_hnsw_idx"]);
    assert.equal(analyzed.executionTimeMs, 2.5);
  });

  it("detects sequential scan on memory_chunks", () => {
    const plan = mapPostgresExplainPlan({
      "Node Type": "Seq Scan",
      "Relation Name": "memory_chunks",
      "Actual Total Time": 12.3,
    });
    const analyzed = analyzeExplainPlan(plan);
    assert.equal(analyzed.usesSeqScanOnChunks, true);
    assert.equal(analyzed.usesHnswIndex, false);
  });

  it("builds evidence-based recommendations without mandating index changes", () => {
    const variants = [
      {
        variantId: "base_precision" as const,
        description: "test",
        limit: 24,
        filter: { workspaceId: "ws" },
        executionTimeMs: 3,
        planningTimeMs: 0.1,
        usesHnswIndex: true,
        usesSeqScanOnChunks: false,
        indexNames: ["memory_chunks_embedding_hnsw_idx"],
        planSummary: "Limit → Index Scan",
        rawPlan: [],
      },
    ];

    const recs = buildRecommendations(
      variants,
      [
        {
          indexName: "memory_chunks_embedding_hnsw_idx",
          indexDef:
            'CREATE INDEX memory_chunks_embedding_hnsw_idx ON public.memory_chunks USING hnsw (embedding vector_cosine_ops)',
          tableName: "memory_chunks",
        },
      ],
      { workspaceId: "ws", embeddedChunkCount: 120, eligibleMemoryCount: 40 },
    );

    assert.ok(recs.some((r) => /no index migration required/i.test(r)));
    assert.ok(recs.some((r) => /Do not change `topK`/i.test(r)));
  });

  it("defines representative retrieval variants", () => {
    assert.equal(PGVECTOR_EXPLAIN_VARIANTS.length, 3);
    const ids = PGVECTOR_EXPLAIN_VARIANTS.map((v) => v.id);
    assert.deepEqual(ids, ["base_precision", "expanded_topk", "semantic_memory_filter"]);
  });
});
