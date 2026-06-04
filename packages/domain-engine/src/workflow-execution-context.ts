import type { EventEmitter } from "@memory-middleware/observability";
import type { WorkflowExecutionContext } from "@memory-middleware/shared-types";
import {
  DEFAULT_WORKFLOW_PREVIOUS_RUN_LIMIT,
  WORKFLOW_ENGINE_EVENT_TYPES,
} from "@memory-middleware/shared-types";
import { DomainEngineError } from "./errors.js";
import { emitDomainEngineEvent } from "./events.js";
import type { DomainEngineStore } from "./store.js";
import { buildWorkflowExecutionContextFromLoad } from "./workflow-context-builder.js";

export interface ResolveWorkflowExecutionContextInput {
  workspaceId: string;
  workflowId: string;
  previousRunLimit?: number;
}

export interface ResolveWorkflowExecutionContextDeps {
  store: DomainEngineStore;
  events?: EventEmitter;
  traceId?: string;
}

export async function resolveWorkflowExecutionContext(
  deps: ResolveWorkflowExecutionContextDeps,
  input: ResolveWorkflowExecutionContextInput,
): Promise<WorkflowExecutionContext> {
  const loaded = await deps.store.loadWorkflowExecutionContextData({
    workspaceId: input.workspaceId,
    workflowId: input.workflowId,
    previousRunLimit: input.previousRunLimit ?? DEFAULT_WORKFLOW_PREVIOUS_RUN_LIMIT,
  });

  if (loaded.workflow.workspaceId !== input.workspaceId) {
    throw new DomainEngineError(`Workflow not found: ${input.workflowId}`, "not_found");
  }

  if (!loaded.workflow.active) {
    throw new DomainEngineError(`Workflow is not active: ${input.workflowId}`, "invalid_request");
  }

  const context = buildWorkflowExecutionContextFromLoad(loaded);

  if (deps.events && deps.traceId) {
    await emitDomainEngineEvent(deps.events, WORKFLOW_ENGINE_EVENT_TYPES.WORKFLOW_CONTEXT_BUILT, {
      traceId: deps.traceId,
      workspaceId: input.workspaceId,
      extra: {
        workflowId: context.workflowId,
        domainCount: context.domains.length,
        packageCount: context.packages.length,
        globalFactCount: context.globalFacts.length,
        domainFactCount: context.domainFacts.length,
        instructionCount: context.instructions.length,
        objectCount: context.objects.length,
        previousRunCount: context.previousWorkflowRuns.length,
      },
    });
  }

  return context;
}
