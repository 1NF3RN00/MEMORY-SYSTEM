import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Observation } from "@memory-middleware/shared-types";
import { buildObservationBody, buildObservationPipelineInput } from "./memory-builder.js";

const observation: Observation = {
  observationId: "01OBSERVATION",
  workspaceId: "01WORKSPACE",
  metric: "mobile_score",
  value: 72,
  source: "pagespeed_insights",
  timestamp: "2026-06-05T12:00:00.000Z",
  metadata: {
    provider: "pagespeed",
    category: "performance",
    metric: "mobile_score",
    collectedAt: "2026-06-05T12:00:00.000Z",
    unit: "score_0_100",
  },
};

describe("buildObservationPipelineInput", () => {
  it("produces single-chunk observation pipeline input", () => {
    const input = buildObservationPipelineInput(observation, "01TRACE");
    assert.equal(input.memoryType, "observation");
    assert.equal(input.sourceType, "json");
    assert.equal(input.memoryId, "01OBSERVATION");
    assert.equal(input.fixedChunks?.length, 1);
    assert.equal(input.metadataPatch?.isObservation, true);
    assert.equal(input.metadataPatch?.observation?.metric, "mobile_score");
    assert.deepEqual(JSON.parse(buildObservationBody(observation)), {
      metric: "mobile_score",
      value: 72,
      source: "pagespeed_insights",
      timestamp: "2026-06-05T12:00:00.000Z",
    });
  });
});
