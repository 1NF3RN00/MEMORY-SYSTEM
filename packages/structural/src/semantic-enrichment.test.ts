import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildChunkRetrievalSurface,
  extractSemanticSurface,
} from "./semantic-enrichment.js";

describe("semantic enrichment", () => {
  it("extracts deterministic semantic surface from chunk content", () => {
    const content = `# Incident Response\n\nOperational outage during trading window. Alert escalated to oncall.`;
    const surface = extractSemanticSurface({
      content,
      memoryType: "incident",
      tags: ["trading"],
    });

    assert.ok(surface.primaryConcepts.length > 0);
    assert.ok(surface.operationalDomains.includes("incident"));
    assert.ok(surface.contextualKeywords.length > 0);
  });

  it("builds lightweight retrieval surface without bloating content", () => {
    const surface = buildChunkRetrievalSurface({
      content: "## Liquidity Policy\nCapital allocation rules for treasury operations.",
      memoryType: "policy",
    });

    assert.ok(surface.semanticHeader.length > 0);
    assert.ok(surface.retrievalTags.length > 0);
    assert.ok(surface.semanticSurface.primaryConcepts.length > 0);
    assert.ok(surface.semanticHeader.length <= 200);
  });

  it("includes hierarchy path when lineage present", () => {
    const rich = extractSemanticSurface({
      content: "Trading execution incident remediation.",
      memoryType: "incident",
      lineage: {
        sectionPath: ["ops", "trading"],
        headingHierarchy: ["Operations", "Trading"],
      },
    });

    assert.deepEqual(rich.hierarchyPath, ["ops", "trading"]);
  });
});
