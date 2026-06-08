import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DbScopeSummary } from "@memory-middleware/shared-types";
import { createLogger } from "../logger.js";
import { emitDbScopeCompleted } from "./emit.js";
import {
  getDbOperationLeaderboard,
  resetDbOperationLeaderboardForTests,
} from "./leaderboard.js";
import { recordScopedQuery, runWithDbObservationScope } from "./scope.js";

describe("sprint-08 verification: leaderboard and scopes", () => {
  it("leaderboard updates after retrieval scope completion (POST /retrieve path)", async () => {
    resetDbOperationLeaderboardForTests();
    const logger = createLogger({ level: "silent", service: "test" });

    const retrievalSummary: DbScopeSummary = {
      scopeId: "01RETRIEVE",
      scopeType: "retrieval",
      totalQueries: 5,
      totalDbTime: 120,
      slowQueries: [],
      duplicateQueries: [],
      nPlusOnePatterns: [],
    };

    await emitDbScopeCompleted(logger, undefined, retrievalSummary, {
      leaderboardCapacity: 20,
      metadata: { route: "POST /retrieve" },
    });

    const top = getDbOperationLeaderboard().getTop(20);
    assert.equal(top.length, 1);
    assert.equal(top[0]?.scopeId, "01RETRIEVE");
    assert.equal(top[0]?.scopeType, "retrieval");
    assert.equal(top[0]?.totalDbTime, 120);
  });

  it("worker job scope summary lands on leaderboard after emit", async () => {
    resetDbOperationLeaderboardForTests();
    const logger = createLogger({ level: "silent", service: "test" });

    const { summary } = await runWithDbObservationScope(
      { scopeId: "01WORKER", scopeType: "worker" },
      async () => {
        recordScopedQuery({
          model: "IngestionJob",
          operation: "update",
          args: {},
          durationMs: 12,
        });
        return true;
      },
    );

    await emitDbScopeCompleted(logger, undefined, summary, {
      leaderboardCapacity: 20,
      metadata: { scope: "worker", job_id: "job-1" },
    });

    const workerEntries = getDbOperationLeaderboard().getTop(20, "worker");
    assert.equal(workerEntries.length, 1);
    assert.equal(workerEntries[0]?.scopeId, "01WORKER");
    assert.equal(workerEntries[0]?.totalDbTime, 12);
    assert.equal(workerEntries[0]?.totalQueries, 1);
  });
});
