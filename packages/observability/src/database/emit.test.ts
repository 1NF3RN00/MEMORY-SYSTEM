import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DbScopeSummary } from "@memory-middleware/shared-types";
import { createLogger } from "../logger.js";
import { emitDbScopeCompleted } from "./emit.js";
import {
  getDbOperationLeaderboard,
  resetDbOperationLeaderboardForTests,
} from "./leaderboard.js";

const summary: DbScopeSummary = {
  scopeId: "01EMITTEST",
  scopeType: "request",
  totalQueries: 2,
  totalDbTime: 42.5,
  slowQueries: [],
  duplicateQueries: [],
  nPlusOnePatterns: [],
};

describe("emitDbScopeCompleted", () => {
  it("logs database.scope.completed and updates leaderboard", async () => {
    resetDbOperationLeaderboardForTests();
    const logger = createLogger({ level: "silent", service: "test" });

    await emitDbScopeCompleted(logger, undefined, summary, {
      leaderboardCapacity: 10,
      metadata: { method: "GET" },
    });

    const entries = getDbOperationLeaderboard().getTop(1);
    assert.equal(entries[0]?.scopeId, "01EMITTEST");
    assert.equal(entries[0]?.totalDbTime, 42.5);
  });
});
