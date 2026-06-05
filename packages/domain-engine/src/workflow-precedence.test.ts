import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { WorkflowExecutionContext } from "@memory-middleware/shared-types";
import { DEFAULT_RELATIONSHIP_NEIGHBORHOOD_CONSTRAINT } from "@memory-middleware/shared-types";
import {
  getWorkflowContextLayerOrder,
  summarizeWorkflowContextLayers,
  workflowLayerPrecedes,
} from "./workflow-precedence.js";

function emptyContext(overrides: Partial<WorkflowExecutionContext> = {}): WorkflowExecutionContext {
  return {
    workflowId: "01WORKFLOW",
    workspaceId: "01WORKSPACE",
    domains: [],
    packages: [],
    globalFacts: [],
    domainFacts: [],
    instructions: [],
    objects: [],
    observations: [],
    retrievedContext: [],
    previousWorkflowRuns: [],
    resolvedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("workflow precedence", () => {
  it("places observations after objects and before retrievedContext", () => {
    assert.equal(workflowLayerPrecedes("objects", "observations"), true);
    assert.equal(workflowLayerPrecedes("observations", "retrievedContext"), true);
    assert.equal(workflowLayerPrecedes("observations", "objects"), false);
  });

  it("orders populated layers by mandatory workflow precedence", () => {
    const context = emptyContext({
      globalFacts: [
        {
          factId: "g1",
          workspaceId: "01WORKSPACE",
          scope: "global",
          key: "area",
          title: "Area",
          content: "CT",
          priority: 1,
          status: "active",
          version: 1,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      domainFacts: [
        {
          factId: "d1",
          workspaceId: "01WORKSPACE",
          scope: "domain",
          domainId: "01DOMAIN",
          key: "keyword",
          title: "Keyword",
          content: "HVAC",
          priority: 1,
          status: "active",
          version: 1,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      instructions: [
        {
          instructionId: "i1",
          workspaceId: "01WORKSPACE",
          domainId: "01DOMAIN",
          actionKey: "audit",
          title: "Audit",
          content: "Run audit",
          status: "active",
          version: 1,
          isActive: true,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      objects: [
        {
          objectId: "o1",
          workspaceId: "01WORKSPACE",
          objectType: "competitor",
          name: "Rival Co",
          status: "active",
          metadata: {},
          objectStatus: "active",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      domains: [
        {
          domainId: "01DOMAIN",
          workspaceId: "01WORKSPACE",
          domainKey: "competitor",
          name: "Competitor",
          status: "active",
          retrievalRules: [],
          metadataFilters: [],
          observationFilters: [],
          relationshipConstraints: DEFAULT_RELATIONSHIP_NEIGHBORHOOD_CONSTRAINT,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });

    assert.deepEqual(getWorkflowContextLayerOrder(context), [
      "globalFacts",
      "domainFacts",
      "instructions",
      "objects",
    ]);
    assert.deepEqual(summarizeWorkflowContextLayers(context), [
      { layer: "globalFacts", count: 1 },
      { layer: "domainFacts", count: 1 },
      { layer: "instructions", count: 1 },
      { layer: "objects", count: 1 },
    ]);
  });

  it("ensures facts precede instructions and objects", () => {
    assert.equal(workflowLayerPrecedes("globalFacts", "instructions"), true);
    assert.equal(workflowLayerPrecedes("domainFacts", "objects"), true);
    assert.equal(workflowLayerPrecedes("objects", "previousWorkflowRuns"), true);
    assert.equal(workflowLayerPrecedes("instructions", "globalFacts"), false);
  });
});
