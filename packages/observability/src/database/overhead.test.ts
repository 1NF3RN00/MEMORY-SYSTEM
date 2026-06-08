import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fingerprintQuery } from "./fingerprint.js";
import { recordScopedQuery, runWithDbObservationScope } from "./scope.js";

describe("database observability overhead", () => {
  it("fingerprint + record path averages under 5ms per query (design target)", async () => {
    const iterations = 500;

    await runWithDbObservationScope({ scopeId: "01OVERHEAD", scopeType: "retrieval" }, async () => {
      const start = performance.now();
      for (let i = 0; i < iterations; i += 1) {
        fingerprintQuery("Memory", "findMany", {
          where: { workspaceId: "01ARZ3NDEKTSV4RRFFQ69G5FAV", memoryId: "01J00000000000000000000000" },
          take: 10,
        });
        recordScopedQuery({
          model: "Memory",
          operation: "findMany",
          args: { where: { workspaceId: "01ARZ3NDEKTSV4RRFFQ69G5FAV" } },
          durationMs: 0.1,
        });
      }
      const avgMs = (performance.now() - start) / iterations;
      assert.ok(avgMs < 5, `expected <5ms avg overhead, got ${avgMs.toFixed(3)}ms`);
      return true;
    });
  });
});
