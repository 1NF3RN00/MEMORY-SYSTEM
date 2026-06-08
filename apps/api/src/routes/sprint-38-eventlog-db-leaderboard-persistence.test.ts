import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(here, "..", "..", "src");

function readSource(relativePath: string): string {
  return readFileSync(join(srcRoot, relativePath), "utf8");
}

describe("sprint-38 eventlog db leaderboard persistence", () => {
  it("registers GET /diagnostics/db-operations with source=history", () => {
    const source = readSource("routes/diagnostics.ts");
    assert.match(source, /\/diagnostics\/db-operations/);
    assert.match(source, /source === "history"/);
    assert.match(source, /queryDbOperationHistoryFromEventLog/);
    assert.match(source, /source: "history"/);
    assert.match(source, /source: "memory"/);
  });

  it("queries EventLog via bounded findMany on database.scope.completed", () => {
    const source = readSource("lib/db-operation-history.ts");
    assert.match(source, /DB_SCOPE_COMPLETED_EVENT_TYPE/);
    assert.match(source, /orderBy:\s*\{\s*timestamp:\s*"desc"\s*\}/);
    assert.match(source, /take:\s*windowSize/);
    assert.match(source, /queryLeaderboardFromEventLogRows/);
  });

  it("documents memory vs history limitations in diagnostics response", () => {
    const source = readSource("routes/diagnostics.ts");
    assert.match(source, /comparison:/);
    assert.match(source, /coldStartSurvives:\s*true/);
    assert.match(source, /boundedWindow:\s*true/);
  });

  it("exposes DB_LEADERBOARD_HISTORY_WINDOW for bounded history fetch", () => {
    const source = readSource("config/db-observability-env.ts");
    assert.match(source, /DB_LEADERBOARD_HISTORY_WINDOW/);
  });

  it("sorts historical rows by totalDbTime in observability history module", () => {
    const historyPath = join(srcRoot, "..", "..", "..", "packages", "observability", "src", "database", "history.ts");
    const source = readFileSync(historyPath, "utf8");
    assert.match(source, /totalDbTime/);
    assert.match(source, /right\.totalDbTime - left\.totalDbTime/);
  });
});
