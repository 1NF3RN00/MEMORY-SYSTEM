import type {
  Domain,
  Workflow,
  WorkflowAnalysisInput,
  WorkflowExecutionContext,
} from "@memory-middleware/shared-types";

const PREVIOUS_OUTPUT_SUMMARY_MAX = 200;

function resolveDomainKey(domainId: string | undefined, domains: Domain[]): string | undefined {
  if (!domainId) return undefined;
  return domains.find((domain) => domain.domainId === domainId)?.domainKey;
}

export function buildWorkflowAnalysisInput(
  context: WorkflowExecutionContext,
  workflow: Workflow,
  query: string,
  analysisSpecKey: string,
): WorkflowAnalysisInput {
  const workflowKey = workflow.workflowKey ?? workflow.workflowId;

  const input: WorkflowAnalysisInput = {
    workflowKey,
    workflowName: workflow.name,
    query: query.trim(),
    analysisSpecKey,
    globalFacts: context.globalFacts.map((fact) => ({
      key: fact.key,
      content: fact.content,
    })),
    domainFacts: context.domainFacts.flatMap((fact) => {
      const domainKey = resolveDomainKey(fact.domainId, context.domains);
      if (!domainKey) return [];
      return [{ domainKey, key: fact.key, content: fact.content }];
    }),
    instructions: context.instructions.flatMap((instruction) => {
      const domainKey = resolveDomainKey(instruction.domainId, context.domains);
      if (!domainKey) return [];
      return [
        {
          domainKey,
          actionKey: instruction.actionKey,
          content: instruction.content,
        },
      ];
    }),
    objects: context.objects.map((object) => ({
      objectType: object.objectType,
      name: object.name,
      metadata: object.metadata,
    })),
    observations: context.observations,
    previousOutputs: context.previousWorkflowRuns.flatMap((run) =>
      run.outputs.map((output) => ({
        workflowRunId: run.workflowRunId,
        title: output.title,
        outputType: output.outputType,
        summary: output.content.slice(0, PREVIOUS_OUTPUT_SUMMARY_MAX),
      })),
    ),
  };

  return input;
}
