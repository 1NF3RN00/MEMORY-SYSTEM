import type {
  Domain,
  Fact,
  Instruction,
  NormalizedObservation,
  ObservationFilter,
  OperationalObject,
  WorkflowExecutionContext,
} from "@memory-middleware/shared-types";
import type { WorkflowExecutionContextLoadResult } from "./store.js";

export interface WorkflowObservationPort {
  retrieveObservations(scope: {
    workspaceId: string;
    filters: ObservationFilter[];
  }): Promise<NormalizedObservation[]>;
}

/** Union observationFilters from all workflow domains. */
export function collectWorkflowObservationFilters(domains: Domain[]): ObservationFilter[] {
  const filters: ObservationFilter[] = [];
  for (const domain of domains) {
    if (domain.observationFilters.length > 0) {
      filters.push(...domain.observationFilters);
    }
  }
  return filters;
}

export async function loadWorkflowObservations(
  port: WorkflowObservationPort,
  workspaceId: string,
  domains: Domain[],
): Promise<NormalizedObservation[]> {
  const filters = collectWorkflowObservationFilters(domains);
  if (filters.length === 0) return [];
  return port.retrieveObservations({ workspaceId, filters });
}

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
    observations: [],
    retrievedContext: opts?.retrievedContext ?? [],
    previousWorkflowRuns: loaded.previousWorkflowRuns,
    resolvedAt: new Date().toISOString(),
  };
}
