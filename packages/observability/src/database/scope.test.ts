import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { recordScopedQuery, runWithDbObservationScope } from "./scope.js";

describe("runWithDbObservationScope", () => {
  it("isolates parallel scopes", async () => {
    const [left, right] = await Promise.all([
      runWithDbObservationScope({ scopeId: "01LEFT", scopeType: "retrieval" }, async () => {
        recordScopedQuery({
          model: "Memory",
          operation: "findMany",
          args: {},
          durationMs: 3,
        });
        return "left";
      }),
      runWithDbObservationScope({ scopeId: "01RIGHT", scopeType: "retrieval" }, async () => {
        recordScopedQuery({
          model: "Workspace",
          operation: "findUnique",
          args: { where: { id: "01ARZ3NDEKTSV4RRFFQ69G5FAV" } },
          durationMs: 5,
        });
        recordScopedQuery({
          model: "Workspace",
          operation: "findUnique",
          args: { where: { id: "01ARZ3NDEKTSV4RRFFQ69G5FAX" } },
          durationMs: 5,
        });
        return "right";
      }),
    ]);

    assert.equal(left.result, "left");
    assert.equal(right.result, "right");
    assert.equal(left.summary.scopeId, "01LEFT");
    assert.equal(right.summary.scopeId, "01RIGHT");
    assert.equal(left.summary.totalQueries, 1);
    assert.equal(right.summary.totalQueries, 2);
  });
});
