import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_RELATIONSHIP_NEIGHBORHOOD_CONSTRAINT,
} from "@memory-middleware/shared-types";
import type { DomainExecutionContext } from "@memory-middleware/shared-types";
import { buildDomainVectorScope, resolveDomainRetrievalScope } from "./domain-scope.js";

const baseContext: DomainExecutionContext = {
  workspaceId: "01WS",
  domainId: "01DOM",
  domainKey: "seo",
  globalFacts: [],
  domainFacts: [],
  instructions: [],
  retrievalRules: [],
  metadataFilters: [],
  observationFilters: [],
  relationshipConstraints: DEFAULT_RELATIONSHIP_NEIGHBORHOOD_CONSTRAINT,
  resolvedAt: new Date().toISOString(),
};

describe("resolveDomainRetrievalScope", () => {
  it("returns unchanged filter when no domain context", () => {
    const query = {
      workspaceId: "01WS",
      query: "test",
      tokenBudget: 1000,
      retrievalMode: "precision" as const,
    };
    const resolved = resolveDomainRetrievalScope(query, undefined);
    assert.equal(resolved.filter.workspaceId, "01WS");
    assert.equal(resolved.filter.domainScope, undefined);
    assert.equal(resolved.query.tokenBudget, 1000);
  });

  it("applies metadata filters and merged memory types", () => {
    const context: DomainExecutionContext = {
      ...baseContext,
      metadataFilters: ["seo", "website"],
      retrievalRules: [
        {
          ruleId: "r1",
          domainId: "01DOM",
          name: "semantic",
          memoryTypes: ["semantic"],
        },
      ],
    };
    const query = {
      workspaceId: "01WS",
      query: "audit",
      tokenBudget: 4000,
      retrievalMode: "precision" as const,
    };
    const resolved = resolveDomainRetrievalScope(query, context);
    assert.deepEqual(resolved.filter.domainScope?.metadataFilters, ["seo", "website"]);
    assert.deepEqual(resolved.query.memoryTypes, ["semantic"]);
    const scope = buildDomainVectorScope(context);
    assert.ok(scope?.rules.length);
  });
});
