import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  aggregateStages,
  FIXED_BENCHMARK_QUERIES,
  MOCK_RETRIEVAL_STAGE_MS,
  percentile,
  summarize,
  type BenchmarkSample,
} from "./benchmark-retrieval.js";

describe("benchmark-retrieval helpers", () => {
  it("computes linear-interpolation percentiles", () => {
    const values = [10, 20, 30, 40, 50];
    assert.equal(percentile(values, 0), 10);
    assert.equal(percentile(values, 50), 30);
    assert.equal(percentile(values, 100), 50);
    assert.ok(percentile(values, 95) > 45);
  });

  it("summarizes latency arrays", () => {
    const summary = summarize([100, 200, 300, 400, 500]);
    assert.equal(summary.count, 5);
    assert.equal(summary.min, 100);
    assert.equal(summary.max, 500);
    assert.equal(summary.mean, 300);
    assert.equal(summary.p50, 300);
  });

  it("aggregates stage durations across samples", () => {
    const samples: BenchmarkSample[] = [
      {
        index: 0,
        query: FIXED_BENCHMARK_QUERIES[0],
        httpStatus: 200,
        wallClockMs: 40,
        retrievalTraceId: "t1",
        error: null,
        timingAudit: {
          requestId: "r1",
          totalLatency: 40,
          stages: [
            { stage: "retrieval", startTime: "", endTime: "", durationMs: 30 },
            { stage: "vector_search:embedding", startTime: "", endTime: "", durationMs: 12 },
          ],
        },
      },
      {
        index: 1,
        query: FIXED_BENCHMARK_QUERIES[1],
        httpStatus: 200,
        wallClockMs: 60,
        retrievalTraceId: "t2",
        error: null,
        timingAudit: {
          requestId: "r2",
          totalLatency: 60,
          stages: [
            { stage: "retrieval", startTime: "", endTime: "", durationMs: 50 },
            { stage: "vector_search:embedding", startTime: "", endTime: "", durationMs: 20 },
          ],
        },
      },
    ];

    const aggregates = aggregateStages(samples);
    const retrieval = aggregates.find((s) => s.stage === "retrieval");
    const embedding = aggregates.find((s) => s.stage === "vector_search:embedding");
    assert.ok(retrieval);
    assert.ok(embedding);
    assert.equal(retrieval!.meanMs, 40);
    assert.equal(retrieval!.percentOfRetrievalMean, 100);
    assert.ok(embedding!.percentOfRetrievalMean! > 0);
    assert.ok(embedding!.percentOfRetrievalMean! < 100);
  });

  it("uses a fixed multi-query benchmark set", () => {
    assert.ok(FIXED_BENCHMARK_QUERIES.length >= 3);
    assert.equal(MOCK_RETRIEVAL_STAGE_MS, 27.54);
  });
});
