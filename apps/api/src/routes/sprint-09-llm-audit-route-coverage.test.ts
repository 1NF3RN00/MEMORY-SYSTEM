import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  LlmCallCollector,
  recordLlmCall,
  runWithLlmCallAsync,
} from "@memory-middleware/observability";

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(here, "..", "..", "src");

function readSource(relativePath: string): string {
  return readFileSync(join(srcRoot, relativePath), "utf8");
}

/** Route files that invoke OpenAI clients must wrap handlers in ALS scope. */
const LLM_ROUTE_FILES = [
  { path: "routes/compression.ts", wrap: "runWithTimingAsync" },
  { path: "routes/retrieval.ts", wrap: "runWithTimingAsync" },
  { path: "routes/workflows.ts", wrap: "runWithLlmCallAsync" },
  { path: "routes/historian.ts", wrap: "runWithLlmCallAsync" },
  { path: "routes/diagnostics.ts", wrap: "runWithLlmCallAsync" },
  { path: "routes/observations.ts", wrap: "runWithLlmCallAsync" },
  { path: "routes/observation-providers.ts", wrap: "runWithLlmCallAsync" },
] as const;

describe("sprint-09 llm audit route coverage", () => {
  for (const { path, wrap } of LLM_ROUTE_FILES) {
    it(`${path} wraps OpenAI call sites with ${wrap}`, () => {
      const source = readSource(path);
      assert.match(source, /createOpenAi/);
      assert.match(source, new RegExp(wrap));
      assert.match(source, /request\.llmCallCollector/);
    });
  }

  it("planning route uses llm collector but has no OpenAI clients", () => {
    const source = readSource("routes/planning.ts");
    assert.doesNotMatch(source, /createOpenAi/);
    assert.match(source, /runWithTimingAsync/);
    assert.match(source, /request\.llmCallCollector/);
  });

  it("worker job processor wraps ingestion embeddings in timing ALS with llm collector", () => {
    const source = readSource("lib/job-processor.ts");
    assert.match(source, /createOpenAiEmbeddingClient/);
    assert.match(source, /runWithTimingAsync/);
    assert.match(source, /LlmCallCollector\(job\.traceId\)/);
    assert.match(source, /emitLlmCallAudit/);
  });

  it("workflow retrieval is invoked only from wrapped workflow execute handler", () => {
    const workflowSource = readSource("routes/workflows.ts");
    const retrievalSource = readSource("lib/workflow-retrieval.ts");
    assert.match(retrievalSource, /createOpenAiEmbeddingClient/);
    assert.match(workflowSource, /retrieveForWorkflowDomain/);
    assert.match(workflowSource, /runWithLlmCallAsync\(request\.llmCallCollector/);
  });

  it("each LLM route file has exactly one ALS wrapper (no double-wrap)", () => {
    const singleWrapRoutes = [
      "routes/workflows.ts",
      "routes/historian.ts",
      "routes/diagnostics.ts",
      "routes/observations.ts",
      "routes/observation-providers.ts",
    ] as const;

    for (const path of singleWrapRoutes) {
      const source = readSource(path);
      const matches = source.match(/runWithLlmCallAsync\(request\.llmCallCollector/g) ?? [];
      assert.equal(
        matches.length,
        1,
        `${path} should have exactly one runWithLlmCallAsync wrapper`,
      );
    }

    for (const path of ["routes/retrieval.ts", "routes/planning.ts", "routes/compression.ts"] as const) {
      const source = readSource(path);
      const timingMatches = source.match(/runWithTimingAsync\(/g) ?? [];
      const collectorMatches = source.match(/request\.llmCallCollector/g) ?? [];
      assert.equal(timingMatches.length, 1, `${path} should have exactly one runWithTimingAsync`);
      assert.ok(collectorMatches.length >= 1, `${path} should pass request.llmCallCollector`);
    }
  });

  it("recordLlmCall no-ops without an active ALS collector", () => {
    const result = recordLlmCall({
      operation: "embedding",
      model: "text-embedding-3-small",
      promptTokens: 10,
      completionTokens: 0,
      latencyMs: 5,
    });
    assert.equal(result, undefined);
  });

  it("runWithLlmCallAsync enables non-empty llmCallAudit.calls when LLM records", async () => {
    const collector = new LlmCallCollector("01VERIFY");
    await runWithLlmCallAsync(collector, async () => {
      const record = recordLlmCall({
        operation: "embedding",
        model: "text-embedding-3-small",
        promptTokens: 42,
        completionTokens: 0,
        latencyMs: 12,
      });
      assert.ok(record);
    });

    const audit = collector.toAudit();
    assert.equal(audit.calls.length, 1);
    assert.equal(audit.calls[0]?.operation, "embedding");
  });

  it("planning route returns llmCallAudit with empty calls when no OpenAI runs", () => {
    const source = readSource("routes/planning.ts");
    assert.match(source, /llmCallAudit:\s*request\.llmCallCollector\.toAudit\(\)/);
    assert.doesNotMatch(source, /createOpenAi/);
  });

  it("request timing middleware invokes emitLlmCallAudit on every response", () => {
    const timingSource = readFileSync(
      join(srcRoot, "..", "..", "..", "packages", "observability", "src", "middleware", "request-timing.ts"),
      "utf8",
    );
    const emitSource = readFileSync(
      join(srcRoot, "..", "..", "..", "packages", "observability", "src", "llm", "emit.ts"),
      "utf8",
    );
    assert.match(timingSource, /emitLlmCallAudit/);
    assert.match(emitSource, /llm\.audit\.completed/);
  });
});
