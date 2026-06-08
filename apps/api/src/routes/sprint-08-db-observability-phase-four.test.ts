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

describe("sprint-08 db observability phase four", () => {
  it("registers GET /diagnostics/db-operations with limit and scopeType filters", () => {
    const source = readSource("routes/diagnostics.ts");
    assert.match(source, /\/diagnostics\/db-operations/);
    assert.match(source, /getDbOperationLeaderboard/);
    assert.match(source, /coldStartClears:\s*true/);
  });

  it("wires request scope via registerRequestDbObservation in create-app", () => {
    const source = readSource("create-app.ts");
    assert.match(source, /registerRequestDbObservation/);
    assert.match(source, /DB_OBSERVATION_ENABLED/);
    assert.match(source, /DB_LEADERBOARD_SIZE/);
  });

  it("wraps worker ingestion jobs in runWithDbObservationScope and emits scope completion", () => {
    const source = readSource("lib/job-processor.ts");
    assert.match(source, /runWithDbObservationScope/);
    assert.match(source, /scopeType:\s*"worker"/);
    assert.match(source, /emitDbScopeCompleted/);
  });

  it("emits database.scope.completed for retrieval scopes", () => {
    const source = readSource("routes/retrieval.ts");
    assert.match(source, /emitDbScopeCompleted/);
    assert.match(source, /route:\s*"POST \/retrieve"/);
  });

  it("worker bootstrap uses connectDatabase instrumented client", () => {
    const source = readSource("worker-main.ts");
    assert.match(source, /connectDatabase/);
    const databaseSource = readSource("lib/database.ts");
    assert.match(databaseSource, /createInstrumentedPrismaClient/);
  });
});
