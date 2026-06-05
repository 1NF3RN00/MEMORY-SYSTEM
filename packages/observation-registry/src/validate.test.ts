import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Observation } from "@memory-middleware/shared-types";
import { bootstrapDefaultRegistry } from "./bootstrap.js";
import { ObservationRegistry } from "./registry.js";
import { normalizeObservation } from "./normalize.js";

function baseObservation(overrides: Partial<Observation> = {}): Observation {
  const now = "2026-06-05T12:00:00.000Z";
  return {
    observationId: "01OBSERVATION",
    workspaceId: "01WORKSPACE",
    metric: "mobile_score",
    value: 72,
    source: "pagespeed_insights",
    timestamp: now,
    metadata: {
      provider: "pagespeed",
      category: "performance",
      metric: "mobile_score",
      collectedAt: now,
      unit: "score_0_100",
    },
    ...overrides,
  };
}

describe("validateObservation", () => {
  const registry = new ObservationRegistry();
  bootstrapDefaultRegistry(registry);

  it("accepts a valid pagespeed observation", () => {
    const result = registry.validateObservation(baseObservation());
    assert.equal(result.valid, true);
    assert.deepEqual(result.errors, []);
  });

  it("rejects unknown provider/category/metric triple", () => {
    const result = registry.validateObservation(
      baseObservation({
        metric: "unknown_metric",
        metadata: {
          provider: "pagespeed",
          category: "performance",
          metric: "unknown_metric",
          collectedAt: "2026-06-05T12:00:00.000Z",
        },
      }),
    );
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes("unknown metric")));
  });

  it("rejects wrong value type", () => {
    const result = registry.validateObservation(
      baseObservation({
        value: "not-a-number",
      }),
    );
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes("must be a number")));
  });

  it("rejects score out of range", () => {
    const result = registry.validateObservation(
      baseObservation({
        value: 150,
      }),
    );
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes("between 0 and 100")));
  });

  it("rejects mismatched top-level metric and metadata.metric", () => {
    const result = registry.validateObservation(
      baseObservation({
        metric: "desktop_score",
        metadata: {
          provider: "pagespeed",
          category: "performance",
          metric: "mobile_score",
          collectedAt: "2026-06-05T12:00:00.000Z",
        },
      }),
    );
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes("must match metadata.metric")));
  });
});

describe("normalizeObservation", () => {
  const registry = new ObservationRegistry();
  bootstrapDefaultRegistry(registry);

  it("fills observationId and aligns metadata.metric", () => {
    const obs = registry.normalizeObservation(
      {
        workspaceId: "01WORKSPACE",
        metric: "schema_present",
        value: true,
        source: "website_crawl",
        metadata: { category: "technical_seo" },
      },
      "website",
      { categoryKey: "technical_seo", metricKey: "schema_present" },
    );

    assert.ok(obs.observationId.length > 0);
    assert.equal(obs.metric, "schema_present");
    assert.equal(obs.metadata.metric, "schema_present");
    assert.equal(obs.metadata.provider, "website");
    assert.equal(obs.metadata.category, "technical_seo");
    assert.equal(obs.value, true);
  });

  it("clamps mobile_score to 0-100 during normalization", () => {
    const obs = normalizeObservation(
      {
        workspaceId: "01WORKSPACE",
        metric: "mobile_score",
        value: 150,
        metadata: { category: "performance", provider: "pagespeed" },
      },
      "pagespeed",
      {
        metric: registry.getMetric("pagespeed", "performance", "mobile_score"),
      },
    );
    assert.equal(obs.value, 100);
  });
});
