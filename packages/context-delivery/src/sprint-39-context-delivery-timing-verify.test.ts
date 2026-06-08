import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const here = dirname(fileURLToPath(import.meta.url));
const pipelineSource = readFileSync(join(here, "pipeline.ts"), "utf8");
const bridgeSource = readFileSync(
  join(here, "..", "..", "observability", "src", "timing", "bridge.ts"),
  "utf8",
);

describe("sprint-39 context delivery timing wrappers verify", () => {
  it("wraps prepareContextPackageForDelivery with fact_resolution measurePipelineStage", () => {
    assert.match(pipelineSource, /measurePipelineStage\(deliveryId, "context_rendering"/);
    assert.match(
      pipelineSource,
      /measurePipelineStage\(deliveryId, "fact_resolution", timing, async \(\) =>\s*\n\s*prepareContextPackageForDelivery/,
    );
  });

  it("preserves legacy fact_precedence ContextRenderStageRecord pushStage calls", () => {
    assert.match(pipelineSource, /pushStage\(stages, "fact_precedence", "started"/);
    assert.match(pipelineSource, /pushStage\(stages, "fact_precedence", "completed"/);
    assert.match(pipelineSource, /overrideCount: prepared\.domainMetadata\.factOverrides\.length/);
  });

  it("maps legacy fact_precedence stage name to fact_resolution in timing bridge", () => {
    assert.match(bridgeSource, /fact_precedence:\s*"fact_resolution"/);
    assert.match(bridgeSource, /rendering:\s*"context_rendering"/);
  });
});
