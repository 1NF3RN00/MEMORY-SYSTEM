import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DbQueryAggregator } from "./aggregator.js";

describe("DbQueryAggregator", () => {
  it("flags slow queries above threshold", () => {
    const aggregator = new DbQueryAggregator("01SCOPE", "retrieval", { slowQueryMs: 50 });
    aggregator.recordQuery({
      model: "Memory",
      operation: "findMany",
      args: { where: { workspaceId: "01ARZ3NDEKTSV4RRFFQ69G5FAV" } },
      durationMs: 120,
    });
    aggregator.recordQuery({
      model: "Memory",
      operation: "findMany",
      args: { where: { workspaceId: "01ARZ3NDEKTSV4RRFFQ69G5FAX" } },
      durationMs: 10,
    });

    const summary = aggregator.toSummary();
    assert.equal(summary.totalQueries, 2);
    assert.equal(summary.slowQueries.length, 1);
    assert.equal(summary.slowQueries[0]?.durationMs, 120);
  });

  it("groups duplicate fingerprints", () => {
    const aggregator = new DbQueryAggregator("01SCOPE", "retrieval");
    const args = { where: { id: "01ARZ3NDEKTSV4RRFFQ69G5FAV" } };

    aggregator.recordQuery({ model: "Memory", operation: "findUnique", args, durationMs: 4 });
    aggregator.recordQuery({ model: "Memory", operation: "findUnique", args, durationMs: 6 });
    aggregator.recordQuery({ model: "Memory", operation: "findUnique", args, durationMs: 5 });

    const summary = aggregator.toSummary();
    assert.equal(summary.duplicateQueries.length, 1);
    assert.equal(summary.duplicateQueries[0]?.count, 3);
    assert.equal(summary.duplicateQueries[0]?.totalDurationMs, 15);
  });

  it("detects n+1 read patterns", () => {
    const aggregator = new DbQueryAggregator("01SCOPE", "retrieval", { nPlusOneThreshold: 3 });
    const args = { where: { id: "01ARZ3NDEKTSV4RRFFQ69G5FAV" } };

    for (let i = 0; i < 3; i += 1) {
      aggregator.recordQuery({
        model: "MemoryChunk",
        operation: "findUnique",
        args,
        durationMs: 2,
      });
    }

    const summary = aggregator.toSummary();
    assert.equal(summary.nPlusOnePatterns.length, 1);
    assert.equal(summary.nPlusOnePatterns[0]?.count, 3);
  });
});
