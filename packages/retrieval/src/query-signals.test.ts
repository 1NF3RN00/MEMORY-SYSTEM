import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { preprocessQuery } from "./preprocessing.js";
import { buildRetrievalEmbeddingText, extractQuerySignals } from "./query-signals.js";

describe("query signal extraction", () => {
  it("extracts operational domains from query", () => {
    const signals = extractQuerySignals(
      "What operational incidents affected trading systems?",
      "what operational incidents affected trading systems",
      ["operational", "incidents", "affected", "trading", "systems"],
    );

    assert.ok(signals.domains.includes("incident"));
    assert.ok(signals.domains.includes("trading"));
    assert.ok(signals.workflowTerms.includes("incident"));
  });

  it("builds enriched embedding text with anchors", () => {
    const text = buildRetrievalEmbeddingText({
      normalizedQuery: "recent liquidity policy changes",
      operationalConcepts: ["liquidity", "policy", "changes"],
      domains: ["liquidity", "compliance"],
    });

    assert.ok(text.startsWith("["));
    assert.ok(text.includes("liquidity"));
    assert.ok(text.includes("recent liquidity policy changes"));
  });

  it("preprocessQuery attaches embedding text and concepts", () => {
    const result = preprocessQuery("Describe API retrieval pipeline architecture", {
      expansionTerms: ["middleware", "vector"],
      decomposition: {
        operationalConcepts: ["retrieval pipeline"],
        entities: [],
        domains: ["architecture"],
        timeReferences: [],
        contextualPriorities: [],
      },
    });

    assert.ok(result.embeddingText);
    assert.ok((result.operationalConcepts ?? []).length > 0);
    assert.ok((result.domains ?? []).includes("architecture"));
  });
});
