import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(here, "..");
const repoRoot = join(here, "..", "..", "..", "..");

function readSource(relativePath: string): string {
  return readFileSync(join(srcRoot, relativePath), "utf8");
}

function readRepoSource(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), "utf8");
}

describe("sprint-23 ingestion timing wrappers", () => {
  it("ingestion pipeline accepts timingCollector and wraps all audit stages", () => {
    const source = readRepoSource("packages/ingestion/src/pipeline.ts");

    assert.match(source, /timingCollector\?: ExecutionTimingCollector/);
    assert.match(source, /resolvePipelineCollector/);
    assert.match(source, /measurePipelineStage\(input\.traceId, "ingestion"/);
    assert.match(source, /measurePipelineStage\(\s*input\.traceId,\s*"normalization"/);
    assert.match(source, /measurePipelineStage\(\s*input\.traceId,\s*"chunking"/);
    assert.match(source, /measurePipelineStage\(\s*input\.traceId,\s*"embedding_generation"/);
    assert.match(source, /Date\.now\(\) - normStarted/);
    assert.match(source, /Date\.now\(\) - chunkStarted/);
    assert.match(source, /Date\.now\(\) - pipelineStarted/);
  });

  it("job-processor passes timingCollector into runIngestionPipeline", () => {
    const source = readSource("lib/job-processor.ts");

    assert.match(source, /runIngestionPipeline\(pipelineInput/);
    assert.match(source, /timingCollector:\s*collectors\.timingCollector/);
    assert.match(source, /emitTimingAudit/);
    assert.match(source, /timingCollector\.toAudit\(\)/);
  });
});
