import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  ExecutionTimingCollector,
  LlmCallCollector,
  recordScopedQuery,
  runWithDbObservationScope,
  runWithTimingAsync,
} from "@memory-middleware/observability";

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(here, "..");

function readSource(relativePath: string): string {
  return readFileSync(join(srcRoot, relativePath), "utf8");
}

describe("sprint-35 worker observability scopes", () => {
  it("job-processor wires timing, llm, and db scopes with worker traceId", () => {
    const source = readSource("lib/job-processor.ts");

    assert.match(source, /new ExecutionTimingCollector\(job\.traceId\)/);
    assert.match(source, /new LlmCallCollector\(job\.traceId\)/);
    assert.match(source, /scopeId:\s*job\.traceId/);
    assert.match(source, /scopeType:\s*"worker"/);
    assert.match(source, /runWithTimingAsync/);
    assert.match(source, /runWithDbObservationScope/);
    assert.match(source, /emitTimingAudit/);
    assert.match(source, /emitLlmCallAudit/);
    assert.match(source, /emitDbScopeCompleted/);
  });

  it("job-processor nests timing inside db scope and emits all audits after job body", () => {
    const source = readSource("lib/job-processor.ts");

    const dbScopeIndex = source.indexOf("runWithDbObservationScope");
    const timingIndex = source.indexOf("runWithTimingAsync");
    const emitAuditsCallIndex = source.indexOf("await emitWorkerJobAudits");

    assert.ok(dbScopeIndex >= 0);
    assert.ok(timingIndex > dbScopeIndex, "timing ALS should nest inside db scope");
    assert.ok(
      emitAuditsCallIndex > timingIndex,
      "audit emission should run after scoped job execution",
    );
    assert.match(source, /emitWorkerJobAudits/);
    assert.match(source, /emitTimingAudit/);
    assert.match(source, /emitDbScopeCompleted/);
  });

  it("audit emits are non-blocking on failure", () => {
    const source = readSource("lib/job-processor.ts");
    assert.match(source, /worker\.audit\.emit_failed/);
    assert.match(source, /emitSafe/);
  });

  it("worker job stages include claim and ingestion timing markers", () => {
    const source = readSource("lib/job-processor.ts");
    assert.match(source, /worker_job:claim/);
    assert.match(source, /worker_job:ingestion/);
  });

  it("ingest route and worker share the same traceId scheme (ULID on job.traceId)", () => {
    const ingestSource = readSource("routes/ingest.ts");
    const workerSource = readSource("lib/job-processor.ts");

    assert.match(ingestSource, /traceId:\s*resolvedTraceId/);
    assert.match(ingestSource, /isUlid/);
    assert.match(workerSource, /job\.traceId/);
  });

  it("worker-main runs as a separate process with logger and events passed to job processor", () => {
    const source = readSource("worker-main.ts");
    assert.match(source, /processNextIngestionJob/);
    assert.match(source, /service:\s*"worker"/);
    assert.match(source, /logger/);
    assert.match(source, /events/);
  });

  it("collectors correlate audits to the same traceId under nested scopes", async () => {
    const traceId = "01WORKER35";
    const timingCollector = new ExecutionTimingCollector(traceId);
    const llmCallCollector = new LlmCallCollector(traceId);

    const { summary } = await runWithDbObservationScope(
      { scopeId: traceId, scopeType: "worker" },
      async () =>
        runWithTimingAsync(
          timingCollector,
          async () => {
            await timingCollector.measureAsync("worker_job:claim", async () => {
              recordScopedQuery({
                model: "IngestionJob",
                operation: "update",
                args: {},
                durationMs: 8,
              });
            });
            return true;
          },
          llmCallCollector,
        ),
    );

    const timingAudit = timingCollector.toAudit();
    const llmAudit = llmCallCollector.toAudit();

    assert.equal(timingAudit.requestId, traceId);
    assert.equal(llmAudit.requestId, traceId);
    assert.equal(summary.scopeId, traceId);
    assert.equal(summary.scopeType, "worker");
    assert.ok(
      timingAudit.stages.some((stage) => stage.stage === "worker_job:claim"),
      "failed jobs should still retain partial timing stages",
    );
  });

  it("job tick emits full timing, llm, and db audits after scoped execution", () => {
    const source = readSource("lib/job-processor.ts");

    const scopeClose = source.indexOf("await emitWorkerJobAudits");
    const dbScopeOpen = source.indexOf("await runWithDbObservationScope");

    assert.ok(scopeClose > dbScopeOpen, "audits emit after db scope completes");
    assert.match(source, /emitTimingAudit\(/);
    assert.match(source, /emitLlmCallAudit\(/);
    assert.match(source, /emitDbScopeCompleted\(/);
    assert.match(source, /timingCollector\.toAudit\(\)/);
    assert.match(source, /llmCallCollector\.toAudit\(\)/);
  });

  it("failed ingestion jobs still emit partial audits without rethrowing", () => {
    const source = readSource("lib/job-processor.ts");
    const bodyStart = source.indexOf("async function processIngestionJobBody");
    const bodySource = source.slice(bodyStart);

    assert.match(bodySource, /catch \(error\)/);
    assert.doesNotMatch(bodySource, /throw error/);
    assert.match(bodySource, /return true/);

    const emitIndex = source.indexOf("await emitWorkerJobAudits");
    const scopeAwait = source.indexOf("await runWithDbObservationScope");
    assert.ok(emitIndex > scopeAwait, "audits emit even when ingestion body catches errors");
  });

  it("failed ingestion retains partial timing stages for audit emission", async () => {
    const traceId = "01WORKER35FAIL";
    const timingCollector = new ExecutionTimingCollector(traceId);
    const llmCallCollector = new LlmCallCollector(traceId);

    await runWithDbObservationScope(
      { scopeId: traceId, scopeType: "worker" },
      async () =>
        runWithTimingAsync(
          timingCollector,
          async () => {
            await timingCollector.measureAsync("worker_job:claim", async () => {
              recordScopedQuery({
                model: "IngestionJob",
                operation: "update",
                args: {},
                durationMs: 4,
              });
            });

            try {
              await timingCollector.measureAsync("worker_job:ingestion", async () => {
                throw new Error("simulated pipeline failure");
              });
            } catch {
              // mirrors processIngestionJobBody: catch without rethrow
            }

            return true;
          },
          llmCallCollector,
        ),
    );

    const timingAudit = timingCollector.toAudit();
    const stageNames = timingAudit.stages.map((stage) => stage.stage);

    assert.equal(timingAudit.requestId, traceId);
    assert.ok(stageNames.includes("worker_job:claim"), "claim stage always present before failure");
    assert.ok(
      stageNames.includes("worker_job:ingestion"),
      "measureAsync records ingestion stage via finally even when pipeline throws",
    );
    assert.equal(llmCallCollector.toAudit().requestId, traceId);
  });
});
