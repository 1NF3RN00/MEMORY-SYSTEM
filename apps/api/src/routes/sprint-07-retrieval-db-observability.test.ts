import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  DbQueryAggregator,
  toRetrievalDbObservability,
} from "@memory-middleware/observability";

const __dirname = dirname(fileURLToPath(import.meta.url));

function readRetrievalRouteSource(): string {
  return readFileSync(join(__dirname, "..", "..", "src", "routes", "retrieval.ts"), "utf8");
}

describe("Sprint-07 — POST /retrieve dbObservability", () => {
  it("wraps retrieval handler in runWithDbObservationScope with traceId scope", () => {
    const source = readRetrievalRouteSource();
    const postHandler = source.slice(
      source.indexOf('app.post("/retrieve"'),
      source.indexOf('app.get<{ Querystring: { workspaceId?: string'),
    );

    assert.match(postHandler, /runWithDbObservationScope/);
    assert.match(postHandler, /scopeId:\s*traceId/);
    assert.match(postHandler, /scopeType:\s*"retrieval"/);
    assert.match(postHandler, /slowQueryMs:\s*dbEnv\.DB_SLOW_QUERY_MS/);
  });

  it("attaches dbObservability to success and error HTTP responses", () => {
    const source = readRetrievalRouteSource();
    assert.match(source, /const dbObservability = toRetrievalDbObservability\(summary\)/);
    assert.match(source, /return reply\.status\(routeResult\.status\)\.send\(\{[\s\S]*dbObservability/);
    assert.match(source, /return \{[\s\S]*dbObservability/);
  });

  it("persists dbObservability in StoredRetrievalResult on completion", () => {
    const source = readRetrievalRouteSource();
    assert.match(source, /dbObservability:\s*storedDbObservability/);
    assert.match(source, /dbObservability:\s*failedDbObservability/);
  });

  it("maps scope summary to RetrievalDbObservability response contract", () => {
    const aggregator = new DbQueryAggregator("01RETRIEVALTRACE", "retrieval", {
      slowQueryMs: 10,
    });
    const args = { where: { id: "01ARZ3NDEKTSV4RRFFQ69G5FAV" } };

    aggregator.recordQuery({ model: "Memory", operation: "findMany", args, durationMs: 3 });
    aggregator.recordQuery({ model: "Memory", operation: "findMany", args, durationMs: 4 });
    aggregator.recordQuery({ model: "MemoryChunk", operation: "findUnique", args, durationMs: 25 });

    const observability = toRetrievalDbObservability(aggregator.toSummary());

    assert.equal(observability.retrievalId, "01RETRIEVALTRACE");
    assert.equal(observability.totalQueries, 3);
    assert.equal(observability.totalDbTime, 32);
    assert.equal(observability.slowQueries.length, 1);
    assert.equal(observability.duplicateQueries.length, 1);
    assert.equal(observability.duplicateQueries[0]?.count, 2);
  });
});
