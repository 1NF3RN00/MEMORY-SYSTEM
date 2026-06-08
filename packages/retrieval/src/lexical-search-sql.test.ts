import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildLexicalSearchSql } from "./lexical-search-sql.js";

describe("buildLexicalSearchSql", () => {
  it("builds parameterized full-text search with workspace filter", () => {
    const { sql, params } = buildLexicalSearchSql(
      "pricing policy",
      { workspaceId: "ws-1" },
      24,
    );

    assert.match(sql, /to_tsvector\('english', mc\.content\)/);
    assert.match(sql, /plainto_tsquery\('english', \$2::text\)/);
    assert.match(sql, /ts_rank_cd/);
    assert.match(sql, /m\.workspace_id = \$1::text/);
    assert.deepEqual(params, ["ws-1", "pricing policy", 24]);
  });

  it("applies memory type and timeframe filters", () => {
    const { sql, params } = buildLexicalSearchSql(
      "incident response",
      {
        workspaceId: "ws-2",
        memoryTypes: ["document"],
        timeframe: { start: "2026-01-01T00:00:00.000Z", end: "2026-06-01T00:00:00.000Z" },
      },
      10,
    );

    assert.match(sql, /m\.memory_type = ANY\(\$3::text\[\]\)/);
    assert.match(sql, /m\.created_at >= \$4::timestamptz/);
    assert.match(sql, /m\.created_at <= \$5::timestamptz/);
    assert.equal(params.length, 6);
    assert.equal(params[0], "ws-2");
    assert.equal(params[5], 10);
  });
});
