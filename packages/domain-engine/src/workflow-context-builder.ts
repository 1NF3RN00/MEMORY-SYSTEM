import type {
  Fact,
  Instruction,
  OperationalObject,
  WorkflowExecutionContext,
} from "@memory-middleware/shared-types";
import type { WorkflowExecutionContextLoadResult } from "./store.js";

function dedupeInstructions(items: Instruction[]): Instruction[] {
  const seen = new Set<string>();
  const result: Instruction[] = [];
  for (const item of items) {
    if (seen.has(item.instructionId)) continue;
    seen.add(item.instructionId);
    result.push(item);
  }
  return result;
}

function dedupeObjects(items: OperationalObject[]): OperationalObject[] {
  const seen = new Set<string>();
  const result: OperationalObject[] = [];
  for (const item of items) {
    if (seen.has(item.objectId)) continue;
    seen.add(item.objectId);
    result.push(item);
  }
  return result;
}

export function sortWorkflowFacts(facts: Fact[]): Fact[] {
  return [...facts].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    const scopeRank = (scope: Fact["scope"]) => (scope === "global" ? 1 : 2);
    if (scopeRank(a.scope) !== scopeRank(b.scope)) {
      return scopeRank(a.scope) - scopeRank(b.scope);
    }
    return a.key.localeCompare(b.key);
  });
}

export function buildWorkflowExecutionContextFromLoad(
  loaded: WorkflowExecutionContextLoadResult,
  opts?: {
    workflowRunId?: string;
    retrievedContext?: WorkflowExecutionContext["retrievedContext"];
  },
): WorkflowExecutionContext {
  return {
    workflowId: loaded.workflow.workflowId,
    ...(opts?.workflowRunId ? { workflowRunId: opts.workflowRunId } : {}),
    workspaceId: loaded.workflow.workspaceId,
    domains: loaded.domains,
    packages: loaded.packages,
    globalFacts: sortWorkflowFacts(loaded.globalFacts),
    domainFacts: sortWorkflowFacts(loaded.domainFacts),
    instructions: dedupeInstructions(loaded.instructions),
    objects: dedupeObjects(loaded.objects),
    retrievedContext: opts?.retrievedContext ?? [],
    previousWorkflowRuns: loaded.previousWorkflowRuns,
    resolvedAt: new Date().toISOString(),
  };
}
