import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type {
  Domain,
  Fact,
  Instruction,
  OperationalObject,
  Workflow,
} from "@memory-middleware/shared-types";
import { DEFAULT_RELATIONSHIP_NEIGHBORHOOD_CONSTRAINT } from "@memory-middleware/shared-types";
import { resolveWorkflowExecutionContext } from "./workflow-execution-context.js";
import { getWorkflowContextLayerOrder } from "./workflow-precedence.js";
import type { DomainEngineStore } from "./store.js";

const workflow: Workflow = {
  workflowId: "01WORKFLOW",
  workspaceId: "01WORKSPACE",
  name: "Competitor Analysis",
  description: "Scan competitors",
  domains: ["competitor"],
  packages: [],
  instructionRefs: [{ domainKey: "competitor", actionKey: "analyze" }],
  outputTypes: ["report"],
  objectTypeFilters: ["competitor"],
  active: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const domain: Domain = {
  domainId: "01DOMAIN",
  workspaceId: "01WORKSPACE",
  domainKey: "competitor",
  name: "Competitor",
  status: "active",
  retrievalRules: [],
  metadataFilters: [],
  relationshipConstraints: DEFAULT_RELATIONSHIP_NEIGHBORHOOD_CONSTRAINT,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const globalFact: Fact = {
  factId: "g1",
  workspaceId: "01WORKSPACE",
  scope: "global",
  key: "area",
  title: "Area",
  content: "Connecticut",
  priority: 10,
  status: "active",
  version: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const domainFact: Fact = {
  factId: "d1",
  workspaceId: "01WORKSPACE",
  scope: "domain",
  domainId: "01DOMAIN",
  key: "focus",
  title: "Focus",
  content: "Pricing",
  priority: 5,
  status: "active",
  version: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const instruction: Instruction = {
  instructionId: "i1",
  workspaceId: "01WORKSPACE",
  domainId: "01DOMAIN",
  actionKey: "analyze",
  title: "Analyze",
  content: "Compare pricing",
  status: "active",
  version: 1,
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const object: OperationalObject = {
  objectId: "o1",
  workspaceId: "01WORKSPACE",
  objectType: "competitor",
  name: "Rival Co",
  status: "active",
  metadata: { region: "CT" },
  objectStatus: "active",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function mockStore(): DomainEngineStore {
  return {
    loadWorkflowExecutionContextData: async () => ({
      workflow,
      domains: [domain],
      packages: [],
      packageManifests: [],
      globalFacts: [globalFact],
      domainFacts: [domainFact],
      instructions: [instruction],
      objects: [object],
      previousWorkflowRuns: [],
    }),
  } as unknown as DomainEngineStore;
}

describe("resolveWorkflowExecutionContext", () => {
  it("returns deterministic layer ordering with facts before objects", async () => {
    const context = await resolveWorkflowExecutionContext(
      { store: mockStore() },
      { workspaceId: "01WORKSPACE", workflowId: "01WORKFLOW" },
    );

    assert.equal(context.workflowId, "01WORKFLOW");
    assert.equal(context.globalFacts[0]?.factId, "g1");
    assert.equal(context.domainFacts[0]?.factId, "d1");
    assert.equal(context.instructions[0]?.instructionId, "i1");
    assert.equal(context.objects[0]?.objectId, "o1");
    assert.deepEqual(context.retrievedContext, []);
    assert.deepEqual(context.previousWorkflowRuns, []);
    assert.deepEqual(getWorkflowContextLayerOrder(context), [
      "globalFacts",
      "domainFacts",
      "instructions",
      "objects",
    ]);
  });
});
