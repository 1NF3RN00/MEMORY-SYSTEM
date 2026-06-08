import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PrismaClient } from "@prisma/client";
import { queryDbOperationHistoryFromEventLog } from "./db-operation-history.js";

function scopePayload(scopeId: string, scopeType: string, totalDbTime: number) {
  return {
    event_id: "evt-1",
    event_type: "database.scope.completed",
    trace_id: scopeId,
    metadata: {
      scopeType,
      totalQueries: 5,
      totalDbTime,
      slowQueryCount: 0,
      duplicateQueryCount: 0,
      nPlusOneCount: 0,
      completedAt: "2026-06-08T12:00:00.000Z",
    },
  };
}

describe("queryDbOperationHistoryFromEventLog", () => {
  it("queries EventLog with bounded take and sorts by totalDbTime", async () => {
    const findManyCalls: Array<Record<string, unknown>> = [];
    const prisma = {
      eventLog: {
        async findMany(args: Record<string, unknown>) {
          findManyCalls.push(args);
          return [
            {
              traceId: "scope-low",
              timestamp: new Date("2026-06-08T10:00:00.000Z"),
              payload: scopePayload("scope-low", "request", 40),
            },
            {
              traceId: "scope-high",
              timestamp: new Date("2026-06-08T11:00:00.000Z"),
              payload: scopePayload("scope-high", "retrieval", 320),
            },
          ];
        },
      },
    } as unknown as PrismaClient;

    const result = await queryDbOperationHistoryFromEventLog(prisma, {
      limit: 1,
      windowSize: 50,
    });

    assert.equal(findManyCalls.length, 1);
    assert.equal(findManyCalls[0]?.take, 50);
    assert.deepEqual((findManyCalls[0]?.where as { eventType?: string })?.eventType, "database.scope.completed");
    assert.equal(result.scannedCount, 2);
    assert.equal(result.windowSize, 50);
    assert.equal(result.entries.length, 1);
    assert.equal(result.entries[0]?.scopeId, "scope-high");
    assert.equal(result.entries[0]?.totalDbTime, 320);
  });
});
