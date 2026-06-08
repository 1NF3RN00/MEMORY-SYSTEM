import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildVectorSearchSql } from "./vector-search-sql.js";

describe("buildVectorSearchSql", () => {
  it("matches production retrieval vector search shape", () => {
    const embedding = Array.from({ length: 4 }, (_, i) => (i + 1) * 0.01);
    const { sql, params } = buildVectorSearchSql(
      embedding,
      { workspaceId: "01HXYZWORKSPACE" },
      24,
    );

    assert.match(sql, /ORDER BY mc\.embedding <=> \$1::vector ASC/);
    assert.match(sql, /m\.workspace_id = \$2::text/);
    assert.match(sql, /mc\.embedding_status = 'completed'/);
    assert.match(sql, /LIMIT \$3/);
    assert.equal(params.length, 3);
    assert.equal(params[0], `[${embedding.join(",")}]`);
    assert.equal(params[1], "01HXYZWORKSPACE");
    assert.equal(params[2], 24);
  });

  it("adds optional memory type and threshold filters", () => {
    const { sql, params } = buildVectorSearchSql(
      [0.1, 0.2],
      {
        workspaceId: "ws1",
        memoryTypes: ["semantic", "episodic"],
        timeframe: { start: "2025-01-01T00:00:00.000Z", end: "2025-12-31T23:59:59.999Z" },
      },
      48,
      0.55,
    );

    assert.match(sql, /m\.memory_type = ANY\(\$3::text\[\]\)/);
    assert.match(sql, /m\.created_at >= \$4::timestamptz/);
    assert.match(sql, /m\.created_at <= \$5::timestamptz/);
    assert.match(sql, /\(1 - \(mc\.embedding <=> \$1::vector\)\) >= \$6/);
    assert.deepEqual(params[2], ["semantic", "episodic"]);
    assert.equal(params[5], 0.55);
    assert.equal(params[6], 48);
  });
});
