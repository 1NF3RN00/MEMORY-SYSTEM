import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  paginateLeaderboardEntries,
  parseEventLogDbScopeEntry,
  queryLeaderboardFromEventLogRows,
} from "./history.js";

function scopePayload(
  scopeId: string,
  scopeType: string,
  totalDbTime: number,
  completedAt: string,
) {
  return {
    event_id: "evt-1",
    event_type: "database.scope.completed",
    trace_id: scopeId,
    metadata: {
      scopeType,
      totalQueries: 10,
      totalDbTime,
      slowQueryCount: 1,
      duplicateQueryCount: 0,
      nPlusOneCount: 0,
      completedAt,
    },
  };
}

describe("parseEventLogDbScopeEntry", () => {
  it("maps EventLog payload to DbOperationLeaderboardEntry", () => {
    const entry = parseEventLogDbScopeEntry({
      traceId: "01HIST001",
      timestamp: "2026-06-08T12:00:00.000Z",
      payload: scopePayload("01HIST001", "retrieval", 250.5, "2026-06-08T12:00:00.000Z"),
    });

    assert.ok(entry);
    assert.equal(entry.scopeId, "01HIST001");
    assert.equal(entry.scopeType, "retrieval");
    assert.equal(entry.totalDbTime, 250.5);
    assert.equal(entry.slowQueryCount, 1);
  });

  it("returns null for malformed payloads", () => {
    assert.equal(
      parseEventLogDbScopeEntry({
        traceId: "bad",
        timestamp: new Date(),
        payload: { metadata: { scopeType: "request" } },
      }),
      null,
    );
  });
});

describe("queryLeaderboardFromEventLogRows", () => {
  it("sorts by totalDbTime descending and applies limit", () => {
    const rows = [
      {
        traceId: "low",
        timestamp: "2026-06-08T10:00:00.000Z",
        payload: scopePayload("low", "request", 50, "2026-06-08T10:00:00.000Z"),
      },
      {
        traceId: "high",
        timestamp: "2026-06-08T11:00:00.000Z",
        payload: scopePayload("high", "retrieval", 500, "2026-06-08T11:00:00.000Z"),
      },
      {
        traceId: "mid",
        timestamp: "2026-06-08T09:00:00.000Z",
        payload: scopePayload("mid", "worker", 120, "2026-06-08T09:00:00.000Z"),
      },
    ];

    const top = queryLeaderboardFromEventLogRows(rows, { limit: 2 });
    assert.deepEqual(
      top.map((entry) => entry.scopeId),
      ["high", "mid"],
    );
  });

  it("filters by scopeType and paginates with offset", () => {
    const rows = [
      {
        traceId: "r1",
        timestamp: "2026-06-08T10:00:00.000Z",
        payload: scopePayload("r1", "retrieval", 300, "2026-06-08T10:00:00.000Z"),
      },
      {
        traceId: "w1",
        timestamp: "2026-06-08T11:00:00.000Z",
        payload: scopePayload("w1", "worker", 400, "2026-06-08T11:00:00.000Z"),
      },
      {
        traceId: "r2",
        timestamp: "2026-06-08T12:00:00.000Z",
        payload: scopePayload("r2", "retrieval", 200, "2026-06-08T12:00:00.000Z"),
      },
    ];

    const page = queryLeaderboardFromEventLogRows(rows, {
      limit: 1,
      offset: 1,
      scopeType: "retrieval",
    });

    assert.equal(page.length, 1);
    assert.equal(page[0]?.scopeId, "r2");
  });
});

describe("paginateLeaderboardEntries", () => {
  it("preserves stable ordering for equal totalDbTime", () => {
    const entries = paginateLeaderboardEntries(
      [
        {
          scopeId: "a",
          scopeType: "request",
          totalDbTime: 100,
          totalQueries: 1,
          slowQueryCount: 0,
          duplicateQueryCount: 0,
          nPlusOneCount: 0,
          completedAt: "2026-06-08T10:00:00.000Z",
        },
        {
          scopeId: "b",
          scopeType: "request",
          totalDbTime: 100,
          totalQueries: 1,
          slowQueryCount: 0,
          duplicateQueryCount: 0,
          nPlusOneCount: 0,
          completedAt: "2026-06-08T11:00:00.000Z",
        },
      ],
      { limit: 2 },
    );

    assert.equal(entries.length, 2);
    assert.equal(entries[0]?.totalDbTime, 100);
  });
});
