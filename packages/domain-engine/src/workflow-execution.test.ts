import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type {
  Domain,
  Workflow,
  WorkflowExecutionContext,
  WorkflowRunDetail,
} from "@memory-middleware/shared-types";
import { DEFAULT_RELATIONSHIP_NEIGHBORHOOD_CONSTRAINT } from "@memory-middleware/shared-types";
import { executeWorkflow } from "./workflow-execution.js";
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

function completedRunDetail(runId: string, context: WorkflowExecutionContext): WorkflowRunDetail {
  return {
    workflowRunId: runId,
    workflowId: workflow.workflowId,
    workspaceId: workflow.workspaceId,
    status: "completed",
    startedAt: "2026-01-01T00:00:00.000Z",
    completedAt: "2026-01-01T00:01:00.000Z",
    outputCount: 1,
    generatedFactIds: [],
    generatedMemoryIds: [],
    generatedObjectIds: [],
    outputs: [
      {
        outputId: `${runId}-out`,
        workflowRunId: runId,
        workspaceId: workflow.workspaceId,
        outputType: "report",
        title: "Report",
        content: "Prior run output",
        createdAt: "2026-01-01T00:01:00.000Z",
      },
    ],
    generatedFacts: [],
    generatedObjects: [],
    executionContext: context,
  };
}

function createMockStore(previousRuns: WorkflowRunDetail[] = []): DomainEngineStore {
  let runCounter = 0;
  const runs = new Map<string, WorkflowRunDetail>();
  const outputsByRun = new Map<string, WorkflowRunDetail["outputs"]>();

  return {
    getWorkflow: async () => workflow,
    getRunningWorkflowRun: async () => null,
    createWorkflowRun: async (input) => {
      runCounter += 1;
      const workflowRunId = `01RUN${runCounter}`;
      return {
        workflowRunId,
        workflowId: input.workflowId,
        workspaceId: input.workspaceId,
        status: input.status ?? "running",
        startedAt: new Date().toISOString(),
        outputCount: 0,
        generatedFactIds: [],
        generatedMemoryIds: [],
        generatedObjectIds: [],
      };
    },
    loadWorkflowExecutionContextData: async () => ({
      workflow,
      domains: [domain],
      packages: [],
      packageManifests: [],
      globalFacts: [],
      domainFacts: [],
      instructions: [],
      objects: [],
      previousWorkflowRuns: previousRuns,
    }),
    createWorkflowOutput: async (input) => {
      const output = {
        outputId: `${input.workflowRunId}-output-${outputsByRun.get(input.workflowRunId)?.length ?? 0}`,
        workflowRunId: input.workflowRunId,
        workspaceId: input.workspaceId,
        outputType: input.outputType,
        title: input.title,
        content: input.content,
        createdAt: new Date().toISOString(),
        ...(input.data ? { data: input.data } : {}),
      };
      const list = outputsByRun.get(input.workflowRunId) ?? [];
      list.push(output);
      outputsByRun.set(input.workflowRunId, list);
      return output;
    },
    updateWorkflowRun: async (workflowRunId, input) => {
      const existing = runs.get(workflowRunId);
      const base: WorkflowRunDetail =
        existing ??
        ({
          workflowRunId,
          workflowId: workflow.workflowId,
          workspaceId: workflow.workspaceId,
          status: "running",
          startedAt: new Date().toISOString(),
          outputCount: 0,
          generatedFactIds: [],
          generatedMemoryIds: [],
          generatedObjectIds: [],
          outputs: [],
          generatedFacts: [],
          generatedObjects: [],
          executionContext: {
            workflowId: workflow.workflowId,
            workspaceId: workflow.workspaceId,
            domains: [domain],
            packages: [],
            globalFacts: [],
            domainFacts: [],
            instructions: [],
            objects: [],
            retrievedContext: [],
            previousWorkflowRuns: previousRuns,
            resolvedAt: new Date().toISOString(),
          },
        } satisfies WorkflowRunDetail);

      const updated: WorkflowRunDetail = {
        ...base,
        outputs: outputsByRun.get(workflowRunId) ?? [],
        ...(input.status ? { status: input.status } : {}),
        ...(input.outputCount != null ? { outputCount: input.outputCount } : {}),
        ...(input.executionContext ? { executionContext: input.executionContext } : {}),
        ...(input.completedAt ? { completedAt: input.completedAt } : {}),
      };
      runs.set(workflowRunId, updated);
      return updated;
    },
    getWorkflowRunDetail: async (workflowRunId) => runs.get(workflowRunId) ?? null,
  } as unknown as DomainEngineStore;
}

describe("executeWorkflow", () => {
  it("includes prior completed runs in execution context on subsequent runs", async () => {
    const priorContext: WorkflowExecutionContext = {
      workflowId: workflow.workflowId,
      workflowRunId: "01RUN1",
      workspaceId: workflow.workspaceId,
      domains: [domain],
      packages: [],
      globalFacts: [],
      domainFacts: [],
      instructions: [],
      objects: [],
      retrievedContext: [],
      previousWorkflowRuns: [],
      resolvedAt: "2026-01-01T00:01:00.000Z",
    };
    const store = createMockStore([completedRunDetail("01RUN1", priorContext)]);

    const detail = await executeWorkflow(
      { store, events: { emit: async () => {} }, traceId: "trace-2" },
      {
        workspaceId: workflow.workspaceId,
        workflowId: workflow.workflowId,
        query: "What changed?",
      },
      {
        retrieve: {
          retrieveForDomain: async () => ({
            workspaceId: workflow.workspaceId,
            query: "What changed?",
            tokenBudget: { maxTokens: 4000, usedTokens: 100 },
            memories: [],
            chunkTraces: [],
            diagnostics: { traceId: "trace-2", stages: [] },
          }),
        },
      },
    );

    assert.equal(detail.executionContext.previousWorkflowRuns.length, 1);
    assert.equal(detail.executionContext.previousWorkflowRuns[0]?.workflowRunId, "01RUN1");
    assert.ok(detail.outputs.length >= 1);
  });
});
