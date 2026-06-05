import type { EventEmitter } from "@memory-middleware/observability";
import type {
  ContextPackage,
  ExecuteWorkflowInput,
  NormalizedObservation,
  WorkflowRunDetail,
} from "@memory-middleware/shared-types";
import {
  DEFAULT_WORKFLOW_PREVIOUS_RUN_LIMIT,
  OBSERVATION_EVENT_TYPES,
  WORKFLOW_ANALYSIS_EVENT_TYPES,
  WORKFLOW_ENGINE_EVENT_TYPES,
} from "@memory-middleware/shared-types";
import { DomainEngineError } from "./errors.js";
import { emitDomainEngineEvent } from "./events.js";
import type { DomainEngineStore } from "./store.js";
import {
  buildWorkflowExecutionContextFromLoad,
  loadWorkflowObservations,
  type WorkflowObservationPort,
} from "./workflow-context-builder.js";
import { buildWorkflowAnalysisInput } from "./workflow-analysis-input.js";
import { buildOutputsFromAnalysis } from "./workflow-analysis-render.js";
import {
  buildRunWorkflowAnalysisConfig,
  runWorkflowAnalysis,
  type StructuredJsonCaller,
} from "./workflow-analysis.js";
import { buildWorkflowOutputs } from "./workflow-output-builder.js";

export interface WorkflowEngineDeps {
  store: DomainEngineStore;
  events: EventEmitter;
  traceId: string;
}

export interface WorkflowRetrievalInput {
  workspaceId: string;
  query: string;
  domainKey: string;
  domainAction?: string;
  tokenBudget: number;
  traceId: string;
}

export interface WorkflowRetrievalPort {
  retrieveForDomain(input: WorkflowRetrievalInput): Promise<ContextPackage>;
}

export type { WorkflowObservationPort };

export interface WorkflowAnalysisPort {
  caller: StructuredJsonCaller;
  modelId: string;
}

function findDomainAction(
  instructionRefs: Array<{ domainKey: string; actionKey: string }>,
  domainKey: string,
): string | undefined {
  return instructionRefs.find((ref) => ref.domainKey === domainKey)?.actionKey;
}

async function emitObservationRetrievedEvents(
  events: EventEmitter,
  traceId: string,
  workspaceId: string,
  workflowRunId: string,
  observations: NormalizedObservation[],
): Promise<void> {
  for (const observation of observations) {
    await events.emit({
      event_type: OBSERVATION_EVENT_TYPES.OBSERVATION_RETRIEVED,
      trace_id: traceId,
      workspace_id: workspaceId,
      severity: "info",
      metadata: {
        operation: "observation",
        observation_id: observation.observationId,
        provider: observation.provider,
        category: observation.category,
        metric: observation.metric,
        workflow_run_id: workflowRunId,
        context: "workflow",
      },
    });
  }
}

async function emitWorkflowAnalysisEvent(
  events: EventEmitter,
  eventType: string,
  traceId: string,
  workspaceId: string,
  workflowRunId: string,
  extra?: Record<string, unknown>,
  severity: "info" | "error" = "info",
): Promise<void> {
  await events.emit({
    event_type: eventType,
    trace_id: traceId,
    workspace_id: workspaceId,
    severity,
    metadata: {
      operation: "workflow_analysis",
      workflow_run_id: workflowRunId,
      ...extra,
    },
  });
}

export async function executeWorkflow(
  deps: WorkflowEngineDeps,
  input: ExecuteWorkflowInput,
  ports: {
    retrieve: WorkflowRetrievalPort;
    observations: WorkflowObservationPort;
    analysis?: WorkflowAnalysisPort;
  },
): Promise<WorkflowRunDetail> {
  if (!input.query.trim()) {
    throw new DomainEngineError("query is required", "validation");
  }

  const workflow = await deps.store.getWorkflow(input.workflowId);
  if (!workflow || workflow.workspaceId !== input.workspaceId) {
    throw new DomainEngineError(`Workflow not found: ${input.workflowId}`, "not_found");
  }
  if (!workflow.active) {
    throw new DomainEngineError(`Workflow is not active: ${input.workflowId}`, "invalid_request");
  }

  const running = await deps.store.getRunningWorkflowRun(input.workflowId);
  if (running) {
    throw new DomainEngineError(
      `Workflow already has a running execution: ${running.workflowRunId}`,
      "conflict",
    );
  }

  const startedAtMs = Date.now();
  const tokenBudget = input.tokenBudget ?? 4000;
  const run = await deps.store.createWorkflowRun({
    workflowId: input.workflowId,
    workspaceId: input.workspaceId,
    status: "running",
  });

  await emitDomainEngineEvent(deps.events, WORKFLOW_ENGINE_EVENT_TYPES.WORKFLOW_STARTED, {
    traceId: deps.traceId,
    workspaceId: input.workspaceId,
    extra: {
      workflowId: input.workflowId,
      workflowRunId: run.workflowRunId,
    },
  });

  try {
    const loaded = await deps.store.loadWorkflowExecutionContextData({
      workspaceId: input.workspaceId,
      workflowId: input.workflowId,
      previousRunLimit: input.previousRunLimit ?? DEFAULT_WORKFLOW_PREVIOUS_RUN_LIMIT,
    });

    let context = buildWorkflowExecutionContextFromLoad(loaded, {
      workflowRunId: run.workflowRunId,
    });

    const observations = await loadWorkflowObservations(
      ports.observations,
      input.workspaceId,
      context.domains,
    );
    if (observations.length > 0) {
      context = {
        ...context,
        observations,
        resolvedAt: new Date().toISOString(),
      };
      await emitObservationRetrievedEvents(
        deps.events,
        deps.traceId,
        input.workspaceId,
        run.workflowRunId,
        observations,
      );
    }

    await emitDomainEngineEvent(deps.events, WORKFLOW_ENGINE_EVENT_TYPES.WORKFLOW_CONTEXT_BUILT, {
      traceId: deps.traceId,
      workspaceId: input.workspaceId,
      extra: {
        workflowRunId: run.workflowRunId,
        executionContext: context,
      },
    });

    const retrievedContext: ContextPackage[] = [];
    for (const domain of context.domains) {
      const domainAction = findDomainAction(loaded.workflow.instructionRefs, domain.domainKey);
      const retrievalInput: WorkflowRetrievalInput = {
        workspaceId: input.workspaceId,
        query: input.query.trim(),
        domainKey: domain.domainKey,
        tokenBudget,
        traceId: `${deps.traceId}:${domain.domainKey}`,
      };
      if (domainAction) retrievalInput.domainAction = domainAction;
      retrievedContext.push(await ports.retrieve.retrieveForDomain(retrievalInput));
    }

    context = {
      ...context,
      retrievedContext,
      resolvedAt: new Date().toISOString(),
    };

    await emitDomainEngineEvent(
      deps.events,
      WORKFLOW_ENGINE_EVENT_TYPES.WORKFLOW_RETRIEVAL_COMPLETED,
      {
        traceId: deps.traceId,
        workspaceId: input.workspaceId,
        extra: {
          workflowRunId: run.workflowRunId,
          retrievedContextCount: retrievedContext.length,
          domainKeys: context.domains.map((domain) => domain.domainKey),
        },
      },
    );

    let outputInputs;
    if (loaded.workflow.analysisSpecKey) {
      if (!ports.analysis?.modelId || !ports.analysis.caller) {
        throw new DomainEngineError(
          "Workflow analysis requires WORKFLOW_ANALYSIS_MODEL and a configured analysis caller",
          "invalid_request",
        );
      }

      const analysisInput = buildWorkflowAnalysisInput(
        context,
        loaded.workflow,
        input.query.trim(),
        loaded.workflow.analysisSpecKey,
      );

      await emitWorkflowAnalysisEvent(
        deps.events,
        WORKFLOW_ANALYSIS_EVENT_TYPES.WORKFLOW_ANALYSIS_INPUT,
        deps.traceId,
        input.workspaceId,
        run.workflowRunId,
        {
          analysisSpecKey: analysisInput.analysisSpecKey,
          workflowKey: analysisInput.workflowKey,
          observationCount: analysisInput.observations.length,
          factCount: analysisInput.globalFacts.length + analysisInput.domainFacts.length,
          analysisInput,
        },
      );

      await emitWorkflowAnalysisEvent(
        deps.events,
        WORKFLOW_ANALYSIS_EVENT_TYPES.WORKFLOW_ANALYSIS_STARTED,
        deps.traceId,
        input.workspaceId,
        run.workflowRunId,
        {
          analysisSpecKey: analysisInput.analysisSpecKey,
          modelId: ports.analysis.modelId,
        },
      );

      let analysisOutput;
      try {
        const analysisConfig = buildRunWorkflowAnalysisConfig(
          analysisInput,
          ports.analysis.modelId,
          deps.traceId,
        );
        analysisOutput = await runWorkflowAnalysis(
          analysisInput,
          ports.analysis.caller,
          analysisConfig,
          deps.traceId,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Workflow analysis failed";
        await emitWorkflowAnalysisEvent(
          deps.events,
          WORKFLOW_ANALYSIS_EVENT_TYPES.WORKFLOW_ANALYSIS_FAILED,
          deps.traceId,
          input.workspaceId,
          run.workflowRunId,
          { analysisSpecKey: analysisInput.analysisSpecKey, errorMessage: message },
          "error",
        );
        throw error;
      }

      await emitWorkflowAnalysisEvent(
        deps.events,
        WORKFLOW_ANALYSIS_EVENT_TYPES.WORKFLOW_ANALYSIS_COMPLETED,
        deps.traceId,
        input.workspaceId,
        run.workflowRunId,
        {
          analysisSpecKey: analysisOutput.analysisSpecKey,
          findingCount: analysisOutput.findings.length,
          gapCount: analysisOutput.gaps.length,
          recommendationCount: analysisOutput.recommendations.length,
        },
      );

      outputInputs = buildOutputsFromAnalysis(
        analysisOutput,
        input.query.trim(),
        loaded.workflow,
        run.workflowRunId,
        input.workspaceId,
      );
    } else {
      outputInputs = buildWorkflowOutputs(
        context,
        input.query.trim(),
        loaded.workflow,
        run.workflowRunId,
        input.workspaceId,
      );
    }

    const outputs = [];
    for (const outputInput of outputInputs) {
      const output = await deps.store.createWorkflowOutput(outputInput);
      outputs.push(output);
      await emitDomainEngineEvent(
        deps.events,
        WORKFLOW_ENGINE_EVENT_TYPES.WORKFLOW_OUTPUT_GENERATED,
        {
          traceId: deps.traceId,
          workspaceId: input.workspaceId,
          extra: {
            workflowRunId: run.workflowRunId,
            outputId: output.outputId,
            outputType: output.outputType,
          },
        },
      );
    }

    await deps.store.updateWorkflowRun(run.workflowRunId, {
      status: "completed",
      completedAt: new Date().toISOString(),
      outputCount: outputs.length,
      generatedFactIds: [],
      generatedMemoryIds: [],
      generatedObjectIds: [],
      executionContext: context,
    });

    await emitDomainEngineEvent(
      deps.events,
      WORKFLOW_ENGINE_EVENT_TYPES.WORKFLOW_EXECUTION_COMPLETED,
      {
        traceId: deps.traceId,
        workspaceId: input.workspaceId,
        extra: {
          workflowRunId: run.workflowRunId,
          outputCount: outputs.length,
          durationMs: Date.now() - startedAtMs,
        },
      },
    );

    const detail = await deps.store.getWorkflowRunDetail(run.workflowRunId);
    if (!detail) {
      throw new DomainEngineError(
        `Workflow run not found after execution: ${run.workflowRunId}`,
        "not_found",
      );
    }
    return detail;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Workflow execution failed";
    await deps.store.updateWorkflowRun(run.workflowRunId, {
      status: "failed",
      completedAt: new Date().toISOString(),
      errorMessage: message,
    });
    await emitDomainEngineEvent(deps.events, WORKFLOW_ENGINE_EVENT_TYPES.WORKFLOW_FAILED, {
      traceId: deps.traceId,
      workspaceId: input.workspaceId,
      severity: "error",
      extra: {
        workflowRunId: run.workflowRunId,
        errorMessage: message,
        stage: "execution",
      },
    });
    throw error;
  }
}

export async function archiveWorkflowRun(
  deps: WorkflowEngineDeps,
  workflowRunId: string,
): Promise<WorkflowRunDetail> {
  const run = await deps.store.archiveWorkflowRun(workflowRunId);
  if (!run) {
    throw new DomainEngineError(`Workflow run not found: ${workflowRunId}`, "not_found");
  }
  await emitDomainEngineEvent(deps.events, WORKFLOW_ENGINE_EVENT_TYPES.WORKFLOW_RUN_ARCHIVED, {
    traceId: deps.traceId,
    workspaceId: run.workspaceId,
    extra: { workflowRunId: run.workflowRunId },
  });
  const detail = await deps.store.getWorkflowRunDetail(workflowRunId);
  if (!detail) {
    throw new DomainEngineError(`Workflow run not found: ${workflowRunId}`, "not_found");
  }
  return detail;
}
