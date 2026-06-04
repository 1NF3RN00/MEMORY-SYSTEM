import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SemanticSurface } from "@memory-middleware/shared-types";
import { scoreSemanticSurfaceQuality } from "./signal-scoring.js";

describe("scoreSemanticSurfaceQuality", () => {
  it("scores richer surfaces higher", () => {
    const sparse: SemanticSurface = {
      primaryConcepts: ["a"],
      operationalDomains: [],
      semanticAliases: [],
      contextualKeywords: ["b"],
    };
    const rich: SemanticSurface = {
      primaryConcepts: ["trading", "incident", "compliance", "audit", "runbook"],
      operationalDomains: ["trading", "incident", "compliance"],
      semanticAliases: ["trade", "trades"],
      contextualKeywords: ["execution", "outage", "policy", "alert"],
      hierarchyPath: ["ops", "trading", "incidents"],
    };

    assert.ok(scoreSemanticSurfaceQuality(rich) > scoreSemanticSurfaceQuality(sparse));
  });
});
