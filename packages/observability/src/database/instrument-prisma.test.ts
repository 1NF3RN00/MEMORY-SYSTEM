import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { recordScopedQuery, runWithDbObservationScope } from "./scope.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("instrument-prisma EventLog exclusion", () => {
  it("production source excludes EventLog from aggregation", () => {
    const source = readFileSync(
      join(__dirname, "..", "..", "src", "database", "instrument-prisma.ts"),
      "utf8",
    );
    assert.match(source, /EXCLUDED_MODELS\s*=\s*new Set\(\["EventLog"\]\)/);
    assert.match(source, /if \(EXCLUDED_MODELS\.has\(model\)\)/);
  });

  it("wires opt-in slow-query EXPLAIN hook when explainOnSlow is enabled", () => {
    const source = readFileSync(
      join(__dirname, "..", "..", "src", "database", "instrument-prisma.ts"),
      "utf8",
    );
    assert.match(source, /explainOnSlow/);
    assert.match(source, /registerSlowQueryExplainHook/);
    assert.match(source, /emit:\s*"event",\s*level:\s*"query"/);
  });

  it("mirrors hook behavior: EventLog writes do not increment totalQueries", async () => {
    const EXCLUDED_MODELS = new Set(["EventLog"]);

    const { summary } = await runWithDbObservationScope(
      { scopeId: "01EVENTLOGSKIP", scopeType: "retrieval" },
      async () => {
        for (const model of ["EventLog", "EventLog", "EventLog"] as const) {
          if (!EXCLUDED_MODELS.has(model)) {
            recordScopedQuery({
              model,
              operation: "create",
              args: { data: { eventType: "database.query.completed" } },
              durationMs: 1,
            });
          }
        }
        recordScopedQuery({
          model: "Memory",
          operation: "findMany",
          args: { where: { workspaceId: "01ARZ3NDEKTSV4RRFFQ69G5FAV" } },
          durationMs: 4,
        });
        return true;
      },
    );

    assert.equal(summary.totalQueries, 1);
    assert.equal(summary.totalDbTime, 4);
    assert.equal(summary.duplicateQueries.length, 0);
  });
});
