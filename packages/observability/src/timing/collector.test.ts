import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ExecutionTimingCollector } from "./collector.js";

describe("ExecutionTimingCollector", () => {
  it("records stage durations with hrtime precision", async () => {
    const collector = new ExecutionTimingCollector("01TEST");
    await collector.measureAsync("intent_extraction", async () => {
      await new Promise((r) => setTimeout(r, 5));
    });
    const audit = collector.toAudit();
    assert.equal(audit.requestId, "01TEST");
    assert.equal(audit.stages.length, 1);
    assert.equal(audit.stages[0]?.stage, "intent_extraction");
    assert.ok(audit.stages[0]!.durationMs >= 4);
    assert.ok(audit.totalLatency >= audit.stages[0]!.durationMs);
  });

  it("measures all canonical query pipeline stages", async () => {
    const stages = [
      "query_received",
      "intent_extraction",
      "metadata_filtering",
      "vector_search",
      "keyword_search",
      "relationship_expansion",
      "fact_resolution",
      "domain_resolution",
      "reranking",
      "compression",
      "context_assembly",
      "response",
    ];
    const collector = new ExecutionTimingCollector("01PIPELINE");
    for (const stage of stages) {
      collector.startStage(stage);
      collector.endStage(stage);
    }
    const audit = collector.toAudit();
    assert.equal(audit.stages.length, stages.length);
    assert.deepEqual(
      audit.stages.map((s) => s.stage),
      stages,
    );
  });
});
