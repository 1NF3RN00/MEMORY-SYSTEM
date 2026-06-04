import type { EventEmitter } from "@memory-middleware/observability";
import type { Workflow, WorkflowInstructionRef } from "@memory-middleware/shared-types";
import { WORKFLOW_ENGINE_EVENT_TYPES } from "@memory-middleware/shared-types";
import { assertDomainSlug, DomainEngineError } from "./errors.js";
import { emitDomainEngineEvent } from "./events.js";
import type { CreateWorkflowInput, DomainEngineStore, UpdateWorkflowInput } from "./store.js";

export interface WorkflowEngineDeps {
  store: DomainEngineStore;
  events: EventEmitter;
  traceId: string;
}

function validateSlugList(values: string[] | undefined, label: string): void {
  for (const value of values ?? []) {
    assertDomainSlug(value, label);
  }
}

function validateInstructionRefs(refs: WorkflowInstructionRef[] | undefined): void {
  for (const ref of refs ?? []) {
    assertDomainSlug(ref.domainKey, "domainKey");
    assertDomainSlug(ref.actionKey, "actionKey");
  }
}

export async function createWorkflow(
  deps: WorkflowEngineDeps,
  input: CreateWorkflowInput,
): Promise<Workflow> {
  if (!input.name.trim()) {
    throw new DomainEngineError("name is required", "validation");
  }
  validateSlugList(input.domains, "domainKey");
  validateSlugList(input.packages, "packageKey");
  validateSlugList(input.objectTypeFilters, "objectType");
  validateInstructionRefs(input.instructionRefs);

  const workflow = await deps.store.createWorkflow(input);
  await emitDomainEngineEvent(deps.events, WORKFLOW_ENGINE_EVENT_TYPES.WORKFLOW_CREATED, {
    traceId: deps.traceId,
    workspaceId: input.workspaceId,
    extra: { workflowId: workflow.workflowId, name: workflow.name },
  });
  return workflow;
}

export async function updateWorkflow(
  deps: WorkflowEngineDeps,
  workflowId: string,
  input: UpdateWorkflowInput,
): Promise<Workflow> {
  validateSlugList(input.domains, "domainKey");
  validateSlugList(input.packages, "packageKey");
  validateSlugList(input.objectTypeFilters, "objectType");
  validateInstructionRefs(input.instructionRefs);

  const workflow = await deps.store.updateWorkflow(workflowId, input);
  if (!workflow) {
    throw new DomainEngineError(`Workflow not found: ${workflowId}`, "not_found");
  }
  await emitDomainEngineEvent(deps.events, WORKFLOW_ENGINE_EVENT_TYPES.WORKFLOW_UPDATED, {
    traceId: deps.traceId,
    workspaceId: workflow.workspaceId,
    extra: { workflowId: workflow.workflowId, name: workflow.name },
  });
  return workflow;
}

export async function archiveWorkflow(
  deps: WorkflowEngineDeps,
  workflowId: string,
): Promise<Workflow> {
  const workflow = await deps.store.archiveWorkflow(workflowId);
  if (!workflow) {
    throw new DomainEngineError(`Workflow not found: ${workflowId}`, "not_found");
  }
  await emitDomainEngineEvent(deps.events, WORKFLOW_ENGINE_EVENT_TYPES.WORKFLOW_ARCHIVED, {
    traceId: deps.traceId,
    workspaceId: workflow.workspaceId,
    extra: { workflowId: workflow.workflowId, name: workflow.name },
  });
  return workflow;
}

export async function deleteWorkflow(
  deps: WorkflowEngineDeps,
  workflowId: string,
): Promise<void> {
  const existing = await deps.store.getWorkflow(workflowId);
  if (!existing) {
    throw new DomainEngineError(`Workflow not found: ${workflowId}`, "not_found");
  }
  const deleted = await deps.store.deleteWorkflow(workflowId);
  if (!deleted) {
    throw new DomainEngineError(`Failed to delete workflow: ${workflowId}`, "delete_failed");
  }
}
