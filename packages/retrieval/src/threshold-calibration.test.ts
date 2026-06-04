import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_RETRIEVAL_RUNTIME_CONFIG } from "@memory-middleware/shared-types";
import { resolveCalibratedRetrievalParams } from "./threshold-calibration.js";

describe("resolveCalibratedRetrievalParams", () => {
  it("uses mode-specific top-K defaults", () => {
    const strict = resolveCalibratedRetrievalParams(
      { thresholdMode: "strict" },
      "precision",
      DEFAULT_RETRIEVAL_RUNTIME_CONFIG,
    );
    const calibration = resolveCalibratedRetrievalParams(
      { thresholdMode: "calibration" },
      "precision",
      DEFAULT_RETRIEVAL_RUNTIME_CONFIG,
    );

    assert.ok(strict.topK < calibration.topK);
    assert.equal(strict.thresholdMode, "strict");
    assert.equal(calibration.thresholdMode, "calibration");
  });

  it("lowers threshold in calibration mode deterministically", () => {
    const balanced = resolveCalibratedRetrievalParams(
      { thresholdMode: "balanced", semanticThreshold: 0.6 },
      "precision",
      DEFAULT_RETRIEVAL_RUNTIME_CONFIG,
    );
    const calibration = resolveCalibratedRetrievalParams(
      { thresholdMode: "calibration", semanticThreshold: 0.6 },
      "precision",
      DEFAULT_RETRIEVAL_RUNTIME_CONFIG,
    );

    assert.ok(calibration.similarityThreshold < balanced.similarityThreshold);
  });

  it("applies breadth multiplier to top-K", () => {
    const base = resolveCalibratedRetrievalParams(
      { thresholdMode: "balanced", breadthMultiplier: 1 },
      "expanded",
      DEFAULT_RETRIEVAL_RUNTIME_CONFIG,
    );
    const wide = resolveCalibratedRetrievalParams(
      { thresholdMode: "balanced", breadthMultiplier: 1.5 },
      "expanded",
      DEFAULT_RETRIEVAL_RUNTIME_CONFIG,
    );

    assert.ok(wide.topK > base.topK);
  });
});
