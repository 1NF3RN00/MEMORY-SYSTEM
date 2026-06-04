import type { EventEmitter } from "@memory-middleware/observability";
import type {
  ContextPackage,
  ExecuteWorkflowInput,
  WorkflowRunDetail,
} from "@memory-middleware/shared-types";
import {
  DEFAULT_WORKFLOW_PREVIOUS_RUN_LIMIT,
  WORKFLOW_ENGINE_EVENT_TYPES,
} from "@memory-middleware/shared-types";
import { DomainEngineError } from "./errors.js";
import { emitDomainEngineEvent } from "./events.js";
import type { DomainEngineStore } from "./store.js";
import { buildWorkflowExecutionContextFromLoad } from "./workflow-context-builder.js";
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

function findDomainAction(
  instructionRefs: Array<{ domainKey: string; actionKey: string }>,
  domainKey: string,
): string | undefined {
  return instructionRefs.find((ref) => ref.domainKey === domainKey)?.actionKey;
}

export async function executeWorkflow(
  deps: WorkflowEngineDeps,
  input: ExecuteWorkflowInput,
  ports: { retrieve: WorkflowRetrievalPort },
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

    const outputInputs = buildWorkflowOutputs(
      context,
      input.query.trim(),
      loaded.workflow,
      run.workflowRunId,
      input.workspaceId,
    );

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
