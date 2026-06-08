import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildExplainSql,
  buildPlanSummary,
  fingerprintSql,
  isExplainEligibleSql,
  parseExplainPayload,
  parsePrismaQueryParams,
  resetExplainCaptureCountsForTests,
  sanitizeExplainPlanNode,
  sanitizeFilterLiteral,
} from "./explain-on-slow.js";

describe("explain-on-slow eligibility", () => {
  it("allows SELECT and WITH reads only", () => {
    assert.equal(isExplainEligibleSql("SELECT 1"), true);
    assert.equal(isExplainEligibleSql("  with cte as (select 1) select * from cte"), true);
    assert.equal(isExplainEligibleSql("INSERT INTO t VALUES (1)"), false);
    assert.equal(isExplainEligibleSql("UPDATE t SET x = 1"), false);
    assert.equal(isExplainEligibleSql("DELETE FROM t"), false);
    assert.equal(isExplainEligibleSql("EXPLAIN SELECT 1"), false);
  });
});

describe("explain-on-slow sanitization", () => {
  it("redacts quoted literals and id-shaped values from filters", () => {
    const sanitized = sanitizeFilterLiteral(
      "(workspace_id = '01ARZ3NDEKTSV4RRFFQ69G5FAV'::text)",
    );
    assert.match(sanitized, /<redacted>|<id>/);
    assert.doesNotMatch(sanitized, /01ARZ3NDEKTSV4RRFFQ69G5FAV/);
  });

  it("sanitizes explain plan nodes without raw parameter literals", () => {
    const node = sanitizeExplainPlanNode({
      "Node Type": "Index Scan",
      "Index Name": "memory_workspace_id_idx",
      Filter: "(email = 'ops@example.com')",
      Plans: [
        {
          "Node Type": "Seq Scan",
          "Relation Name": "memory",
          Filter: "(workspace_id = '01ARZ3NDEKTSV4RRFFQ69G5FAV'::text)",
        },
      ],
    });

    assert.equal(node.nodeType, "Index Scan");
    assert.equal(node.indexName, "memory_workspace_id_idx");
    assert.match(node.filter ?? "", /<redacted>/);
    assert.doesNotMatch(JSON.stringify(node), /ops@example.com/);
    assert.doesNotMatch(JSON.stringify(node), /01ARZ3NDEKTSV4RRFFQ69G5FAV/);
  });

  it("parses postgres explain json into sanitized plan tree", () => {
    const { sanitizedPlan, planningTimeMs } = parseExplainPayload([
      {
        Plan: {
          "Node Type": "Seq Scan",
          "Relation Name": "memory_chunk",
          "Actual Total Time": 12.5,
        },
        "Planning Time": 0.42,
      },
    ]);

    assert.equal(planningTimeMs, 0.42);
    assert.equal(sanitizedPlan[0]?.nodeType, "Seq Scan");
    assert.equal(sanitizedPlan[0]?.relationName, "memory_chunk");
    assert.equal(buildPlanSummary(sanitizedPlan[0]!), "Seq Scan on memory_chunk");
  });
});

describe("explain-on-slow helpers", () => {
  it("builds FORMAT JSON vs ANALYZE explain prefixes", () => {
    assert.equal(buildExplainSql("SELECT 1", false), "EXPLAIN (FORMAT JSON) SELECT 1");
    assert.match(buildExplainSql("SELECT 1", true), /EXPLAIN \(ANALYZE, BUFFERS, FORMAT JSON\)/);
  });

  it("fingerprints normalized SQL consistently", () => {
    const a = fingerprintSql("SELECT   1");
    const b = fingerprintSql("select 1");
    assert.equal(a, b);
    assert.equal(a.length, 12);
  });

  it("parses prisma query params JSON", () => {
    assert.deepEqual(parsePrismaQueryParams('["01ARZ3NDEKTSV4RRFFQ69G5FAV",24]'), [
      "01ARZ3NDEKTSV4RRFFQ69G5FAV",
      24,
    ]);
    assert.deepEqual(parsePrismaQueryParams(""), []);
    assert.deepEqual(parsePrismaQueryParams("not-json"), []);
  });

  it("resets per-scope explain counters for tests", () => {
    resetExplainCaptureCountsForTests();
    assert.doesNotThrow(() => resetExplainCaptureCountsForTests());
  });
});
