import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LlmCallCollector } from "./collector.js";
import { recordLlmCall } from "./record.js";
import { runWithLlmCall } from "./context.js";
import { estimateLlmCostUsd } from "./pricing.js";

describe("LlmCallCollector", () => {
  it("aggregates token, latency, and cost totals", () => {
    const collector = new LlmCallCollector("01LLMTEST");

    collector.record({
      operation: "embedding",
      model: "text-embedding-3-small",
      promptTokens: 120,
      completionTokens: 0,
      latencyMs: 42,
    });
    collector.record({
      operation: "compression_abstraction",
      model: "gpt-4o-mini",
      promptTokens: 800,
      completionTokens: 120,
      latencyMs: 310,
    });

    const audit = collector.toAudit();
    assert.equal(audit.requestId, "01LLMTEST");
    assert.equal(audit.totalPromptTokens, 920);
    assert.equal(audit.totalCompletionTokens, 120);
    assert.equal(audit.totalLatencyMs, 352);
    assert.equal(audit.calls.length, 2);
    assert.ok(audit.totalCostUsd > 0);
  });

  it("records via ALS context helper", () => {
    const collector = new LlmCallCollector("01ALS");
    runWithLlmCall(collector, () => {
      const record = recordLlmCall({
        operation: "workflow_analysis",
        model: "gpt-4o-mini",
        promptTokens: 500,
        completionTokens: 200,
        latencyMs: 900,
      });
      assert.ok(record);
      assert.equal(record?.operation, "workflow_analysis");
    });

    const audit = collector.toAudit();
    assert.equal(audit.calls.length, 1);
    assert.equal(audit.totalCompletionTokens, 200);
  });

  it("estimates embedding cost from prompt tokens only", () => {
    const cost = estimateLlmCostUsd("text-embedding-3-small", 10_000, 0);
    assert.equal(cost, 0.0002);
  });
});
