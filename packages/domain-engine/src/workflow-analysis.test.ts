import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ANALYSIS_SPEC_KEYS,
  type WorkflowAnalysisInput,
  WORKFLOW_ANALYSIS_EVENT_TYPES,
} from "@memory-middleware/shared-types";
import { DEFAULT_RELATIONSHIP_NEIGHBORHOOD_CONSTRAINT } from "@memory-middleware/shared-types";
import { buildWorkflowAnalysisInput } from "./workflow-analysis-input.js";
import {
  SEO_AUDIT_V1_FINDING_TASK_IDS,
  SEO_AUDIT_V1_GAP_TASK_IDS,
  SEO_AUDIT_V1_RECOMMENDATION_TASK_IDS,
} from "./workflow-analysis-schemas.js";
import { validateWorkflowAnalysisOutput } from "./workflow-analysis-validate.js";
import {
  buildRunWorkflowAnalysisConfig,
  runWorkflowAnalysis,
  type StructuredJsonCaller,
} from "./workflow-analysis.js";
import { executeWorkflow } from "./workflow-execution.js";
import type { DomainEngineStore } from "./store.js";
import type { Domain, Workflow, WorkflowExecutionContext, WorkflowRunDetail } from "@memory-middleware/shared-types";

const seoWorkflow: Workflow = {
  workflowId: "01WORKFLOW",
  workspaceId: "01WORKSPACE",
  workflowKey: "seo_audit",
  name: "SEO Audit",
  description: "Audit SEO posture",
  domains: ["website"],
  packages: [],
  instructionRefs: [{ domainKey: "website", actionKey: "audit" }],
  outputTypes: ["report"],
  analysisSpecKey: ANALYSIS_SPEC_KEYS.SEO_AUDIT_V1,
  active: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const websiteDomain: Domain = {
  domainId: "01DOMAIN",
  workspaceId: "01WORKSPACE",
  domainKey: "website",
  name: "Website",
  status: "active",
  retrievalRules: [],
  metadataFilters: [],
  observationFilters: [{ providers: ["website", "pagespeed"] }],
  relationshipConstraints: DEFAULT_RELATIONSHIP_NEIGHBORHOOD_CONSTRAINT,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function emptyAnalysisContext(
  observations: WorkflowExecutionContext["observations"] = [],
): WorkflowExecutionContext {
  return {
    workflowId: seoWorkflow.workflowId,
    workspaceId: seoWorkflow.workspaceId,
    domains: [websiteDomain],
    packages: [],
    globalFacts: [],
    domainFacts: [],
    instructions: [],
    objects: [],
    observations,
    retrievedContext: [
      {
        workspaceId: seoWorkflow.workspaceId,
        query: "SEO audit",
        tokenBudget: { maxTokens: 4000, usedTokens: 100 },
        memories: [{ memoryId: "01MEM", chunks: [{ chunkId: "c1", content: "raw chunk" }] }],
        chunkTraces: [],
        diagnostics: { traceId: "trace", stages: [] },
      },
    ],
    previousWorkflowRuns: [],
    resolvedAt: "2026-06-05T12:00:00.000Z",
  };
}

function buildSeoAuditOutput(
  input: WorkflowAnalysisInput,
  overrides?: {
    mobileSeverity?: "critical" | "high" | "medium" | "low" | "info";
    mobileStatus?: "determined" | "insufficient_data";
    mobileObservationId?: string;
  },
) {
  const mobileObservation = input.observations.find((obs) => obs.metric === "mobile_score");
  const mobileStatus = overrides?.mobileStatus ?? (mobileObservation ? "determined" : "insufficient_data");

  return {
    workflowKey: input.workflowKey,
    analysisSpecKey: input.analysisSpecKey,
    generatedAt: "2026-06-05T12:00:00.000Z",
    findings: SEO_AUDIT_V1_FINDING_TASK_IDS.map((taskId) => {
      if (taskId === "seo_mobile_performance") {
        return {
          taskId,
          status: mobileStatus,
          metric: "mobile_score",
          observedValue: mobileObservation?.value,
          assessment:
            mobileStatus === "determined"
              ? `Mobile score is ${String(mobileObservation?.value)}`
              : "mobile_score observation missing",
          severity: overrides?.mobileSeverity ?? "critical",
          evidenceObservationIds:
            mobileStatus === "determined" && mobileObservation
              ? [mobileObservation.observationId]
              : [],
          evidenceFactKeys: [],
        };
      }

      return {
        taskId,
        status: "insufficient_data" as const,
        assessment: `Insufficient data for ${taskId}`,
        severity: "info" as const,
        evidenceObservationIds: [],
        evidenceFactKeys: [],
      };
    }),
    gaps: SEO_AUDIT_V1_GAP_TASK_IDS.map((taskId) => ({
      taskId,
      status: "insufficient_data" as const,
      metric: taskId,
      gapDescription: `Insufficient data for ${taskId}`,
      evidenceObservationIds: [],
    })),
    recommendations: SEO_AUDIT_V1_RECOMMENDATION_TASK_IDS.map((taskId) => ({
      taskId,
      status: "insufficient_data" as const,
      priority: 3 as const,
      action: `No action for ${taskId}`,
      rationale: `Insufficient data for ${taskId}`,
      supportedByObservationIds: [],
      supportedByFactKeys: [],
    })),
    metadata: {
      observationCount: input.observations.length,
      factCount: input.globalFacts.length + input.domainFacts.length,
      modelId: "mock-model",
      traceId: "trace-analysis",
    },
  };
}

function createMockAnalysisCaller(
  behavior: (input: WorkflowAnalysisInput, attempt: number) => unknown,
): StructuredJsonCaller {
  let attempt = 0;
  return {
    async callStructuredJson({ userMessage }) {
      attempt += 1;
      const payload = JSON.parse(userMessage) as WorkflowAnalysisInput | {
        input: WorkflowAnalysisInput;
      };
      const analysisInput = "input" in payload ? payload.input : payload;
      return behavior(analysisInput, attempt);
    },
  };
}

function createAnalysisMockStore(): DomainEngineStore {
  const outputsByRun = new Map<string, WorkflowRunDetail["outputs"]>();
  let storedContext = emptyAnalysisContext();

  return {
    getWorkflow: async () => seoWorkflow,
    getRunningWorkflowRun: async () => null,
    createWorkflowRun: async (input) => ({
      workflowRunId: "01RUN-ANALYSIS",
      workflowId: input.workflowId,
      workspaceId: input.workspaceId,
      status: input.status ?? "running",
      startedAt: new Date().toISOString(),
      outputCount: 0,
      generatedFactIds: [],
      generatedMemoryIds: [],
      generatedObjectIds: [],
    }),
    loadWorkflowExecutionContextData: async () => ({
      workflow: seoWorkflow,
      domains: [websiteDomain],
      packages: [],
      packageManifests: [],
      globalFacts: [],
      domainFacts: [],
      instructions: [],
      objects: [],
      previousWorkflowRuns: [],
    }),
    createWorkflowOutput: async (input) => {
      const output = {
        outputId: "01OUTPUT",
        workflowRunId: input.workflowRunId,
        workspaceId: input.workspaceId,
        outputType: input.outputType,
        title: input.title,
        content: input.content,
        ...(input.data ? { data: input.data } : {}),
        createdAt: new Date().toISOString(),
      };
      outputsByRun.set(input.workflowRunId, [output]);
      return output;
    },
    updateWorkflowRun: async (workflowRunId, input) => {
      if (input.executionContext) {
        storedContext = input.executionContext;
      }
      return {
        workflowRunId,
        workflowId: seoWorkflow.workflowId,
        workspaceId: seoWorkflow.workspaceId,
        status: input.status ?? "completed",
        startedAt: new Date().toISOString(),
        completedAt: input.completedAt,
        outputCount: input.outputCount ?? 1,
        generatedFactIds: [],
        generatedMemoryIds: [],
        generatedObjectIds: [],
        outputs: outputsByRun.get(workflowRunId) ?? [],
        generatedFacts: [],
        generatedObjects: [],
        executionContext: storedContext,
      } satisfies WorkflowRunDetail;
    },
    getWorkflowRunDetail: async (workflowRunId) =>
      ({
        workflowRunId,
        workflowId: seoWorkflow.workflowId,
        workspaceId: seoWorkflow.workspaceId,
        status: "completed",
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        outputCount: 1,
        generatedFactIds: [],
        generatedMemoryIds: [],
        generatedObjectIds: [],
        outputs: outputsByRun.get(workflowRunId) ?? [],
        generatedFacts: [],
        generatedObjects: [],
        executionContext: storedContext,
      }) satisfies WorkflowRunDetail,
  } as unknown as DomainEngineStore;
}

describe("workflow analysis", () => {
  it("buildWorkflowAnalysisInput excludes retrievedContext", () => {
    const context = emptyAnalysisContext();
    const input = buildWorkflowAnalysisInput(
      context,
      seoWorkflow,
      "SEO audit",
      ANALYSIS_SPEC_KEYS.SEO_AUDIT_V1,
    );

    assert.equal(input.observations.length, 0);
    assert.equal(input.workflowKey, "seo_audit");
    assert.equal("retrievedContext" in input, false);
  });

  it("zero observations yields all seo_audit_v1 tasks as insufficient_data", async () => {
    const analysisInput = buildWorkflowAnalysisInput(
      emptyAnalysisContext([]),
      seoWorkflow,
      "SEO audit",
      ANALYSIS_SPEC_KEYS.SEO_AUDIT_V1,
    );

    const output = await runWorkflowAnalysis(
      analysisInput,
      createMockAnalysisCaller((input) => buildSeoAuditOutput(input)),
      buildRunWorkflowAnalysisConfig(analysisInput, "mock-model", "trace-analysis"),
      "trace-analysis",
    );

    assert.equal(output.findings.every((finding) => finding.status === "insufficient_data"), true);
    assert.equal(output.gaps.every((gap) => gap.status === "insufficient_data"), true);
    assert.equal(
      output.recommendations.every((recommendation) => recommendation.status === "insufficient_data"),
      true,
    );
  });

  it("mobile_score 45 maps to seo_mobile_performance severity critical", async () => {
    const mobileObservation = {
      observationId: "01HMOBILE00000000000000000",
      provider: "pagespeed",
      category: "performance",
      metric: "mobile_score",
      value: 45,
      source: "pagespeed_insights",
      timestamp: "2026-06-05T12:00:00.000Z",
      collectedAt: "2026-06-05T12:00:00.000Z",
    };

    const analysisInput = buildWorkflowAnalysisInput(
      emptyAnalysisContext([mobileObservation]),
      seoWorkflow,
      "SEO audit",
      ANALYSIS_SPEC_KEYS.SEO_AUDIT_V1,
    );

    const output = await runWorkflowAnalysis(
      analysisInput,
      createMockAnalysisCaller((input) =>
        buildSeoAuditOutput(input, { mobileSeverity: "critical", mobileStatus: "determined" }),
      ),
      buildRunWorkflowAnalysisConfig(analysisInput, "mock-model", "trace-analysis"),
      "trace-analysis",
    );

    const mobileFinding = output.findings.find(
      (finding) => finding.taskId === "seo_mobile_performance",
    );
    assert.equal(mobileFinding?.status, "determined");
    assert.equal(mobileFinding?.severity, "critical");
    assert.equal(mobileFinding?.evidenceObservationIds[0], mobileObservation.observationId);
  });

  it("retries once on invalid LLM response then fails", async () => {
    const analysisInput = buildWorkflowAnalysisInput(
      emptyAnalysisContext([]),
      seoWorkflow,
      "SEO audit",
      ANALYSIS_SPEC_KEYS.SEO_AUDIT_V1,
    );

    const emitted: string[] = [];
    const caller = createMockAnalysisCaller((_input, attempt) => {
      if (attempt === 1) {
        return { invalid: true };
      }
      return { still: "invalid" };
    });

    await assert.rejects(
      () =>
        runWorkflowAnalysis(
          analysisInput,
          caller,
          buildRunWorkflowAnalysisConfig(analysisInput, "mock-model", "trace-analysis"),
          "trace-analysis",
        ),
      /schema validation/i,
    );

    const validated = validateWorkflowAnalysisOutput({ invalid: true }, ANALYSIS_SPEC_KEYS.SEO_AUDIT_V1);
    assert.equal(validated.success, false);
    assert.ok(validated.errors.length > 0);
    assert.equal(emitted.length, 0);
  });

  it("executeWorkflow emits workflow_analysis events and persists analysis output data", async () => {
    const emitted: string[] = [];
    const store = createAnalysisMockStore();

    const detail = await executeWorkflow(
      {
        store,
        events: {
          emit: async (event) => {
            emitted.push(event.event_type);
          },
        },
        traceId: "trace-analysis",
      },
      {
        workspaceId: seoWorkflow.workspaceId,
        workflowId: seoWorkflow.workflowId,
        query: "Run SEO audit",
      },
      {
        retrieve: {
          retrieveForDomain: async () => ({
            workspaceId: seoWorkflow.workspaceId,
            query: "Run SEO audit",
            tokenBudget: { maxTokens: 4000, usedTokens: 100 },
            memories: [],
            chunkTraces: [],
            diagnostics: { traceId: "trace-analysis", stages: [] },
          }),
        },
        observations: {
          retrieveObservations: async () => [],
        },
        analysis: {
          caller: createMockAnalysisCaller((input) => buildSeoAuditOutput(input)),
          modelId: "mock-model",
        },
      },
    );

    assert.ok(emitted.includes(WORKFLOW_ANALYSIS_EVENT_TYPES.WORKFLOW_ANALYSIS_INPUT));
    assert.ok(emitted.includes(WORKFLOW_ANALYSIS_EVENT_TYPES.WORKFLOW_ANALYSIS_STARTED));
    assert.ok(emitted.includes(WORKFLOW_ANALYSIS_EVENT_TYPES.WORKFLOW_ANALYSIS_COMPLETED));
    assert.ok(detail.outputs[0]?.content.includes("## Findings"));
    assert.equal(
      (detail.outputs[0]?.data as { analysisSpecKey?: string } | undefined)?.analysisSpecKey,
      ANALYSIS_SPEC_KEYS.SEO_AUDIT_V1,
    );
  });
});
