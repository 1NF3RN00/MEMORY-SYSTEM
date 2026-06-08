import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DbScopeSummary } from "@memory-middleware/shared-types";
import { DbOperationLeaderboard } from "./leaderboard.js";

function makeSummary(
  scopeId: string,
  totalDbTime: number,
  scopeType: DbScopeSummary["scopeType"] = "retrieval",
): DbScopeSummary {
  return {
    scopeId,
    scopeType,
    totalQueries: 1,
    totalDbTime,
    slowQueries: [],
    duplicateQueries: [],
    nPlusOnePatterns: [],
  };
}

describe("DbOperationLeaderboard", () => {
  it("returns top entries sorted by totalDbTime descending", () => {
    const leaderboard = new DbOperationLeaderboard(500);

    leaderboard.push(makeSummary("01SLOW", 300));
    leaderboard.push(makeSummary("01FAST", 50));
    leaderboard.push(makeSummary("01MID", 150));

    const top = leaderboard.getTop(2);
    assert.equal(top.length, 2);
    assert.equal(top[0]?.scopeId, "01SLOW");
    assert.equal(top[1]?.scopeId, "01MID");
  });

  it("filters by scopeType when provided", () => {
    const leaderboard = new DbOperationLeaderboard(500);

    leaderboard.push(makeSummary("01REQ", 200, "request"));
    leaderboard.push(makeSummary("01RET", 100, "retrieval"));

    const retrievalOnly = leaderboard.getTop(20, "retrieval");
    assert.equal(retrievalOnly.length, 1);
    assert.equal(retrievalOnly[0]?.scopeType, "retrieval");
  });

  it("evicts oldest entries when capacity is exceeded", () => {
    const leaderboard = new DbOperationLeaderboard(2);

    leaderboard.push(makeSummary("01OLD", 10));
    leaderboard.push(makeSummary("01MID", 20));
    leaderboard.push(makeSummary("01NEW", 30));

    assert.equal(leaderboard.size(), 2);
    const top = leaderboard.getTop(20);
    assert.deepEqual(
      top.map((entry) => entry.scopeId),
      ["01NEW", "01MID"],
    );
  });
});
