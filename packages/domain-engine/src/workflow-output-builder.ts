import type {
  CreateWorkflowOutputInput,
  Workflow,
  WorkflowExecutionContext,
} from "@memory-middleware/shared-types";
import { summarizeWorkflowContextLayers } from "./workflow-precedence.js";

function formatFactLines(facts: WorkflowExecutionContext["globalFacts"]): string {
  if (facts.length === 0) return "None";
  return facts.map((fact) => `- [${fact.scope}] ${fact.key}: ${fact.content}`).join("\n");
}

function formatInstructionLines(instructions: WorkflowExecutionContext["instructions"]): string {
  if (instructions.length === 0) return "None";
  return instructions
    .map((instruction) => `- ${instruction.actionKey}: ${instruction.content}`)
    .join("\n");
}

function formatObjectLines(objects: WorkflowExecutionContext["objects"]): string {
  if (objects.length === 0) return "None";
  return objects
    .map(
      (object) =>
        `- ${object.objectType}/${object.name} (${object.status}) metadata=${JSON.stringify(object.metadata)}`,
    )
    .join("\n");
}

function formatPreviousRunLines(runs: WorkflowExecutionContext["previousWorkflowRuns"]): string {
  if (runs.length === 0) return "None";
  return runs
    .map(
      (run) =>
        `- Run ${run.workflowRunId} @ ${run.startedAt}: ${run.outputCount} output(s), status=${run.status}`,
    )
    .join("\n");
}

export function buildWorkflowReportContent(
  context: WorkflowExecutionContext,
  query: string,
  workflow: Workflow,
): string {
  const layers = summarizeWorkflowContextLayers(context);
  const retrievedMemoryCount = context.retrievedContext.reduce(
    (sum, pkg) => sum + pkg.memories.length,
    0,
  );

  return [
    `# ${workflow.name}`,
    "",
    `Query: ${query}`,
    "",
    "## Context layers (precedence order)",
    layers.map((layer) => `- ${layer.layer}: ${layer.count}`).join("\n"),
    "",
    "## Global facts",
    formatFactLines(context.globalFacts),
    "",
    "## Domain facts",
    formatFactLines(context.domainFacts),
    "",
    "## Instructions",
    formatInstructionLines(context.instructions),
    "",
    "## Operational objects",
    formatObjectLines(context.objects),
    "",
    "## Retrieved context",
    `${context.retrievedContext.length} package(s), ${retrievedMemoryCount} memory(ies)`,
    "",
    "## Previous workflow runs",
    formatPreviousRunLines(context.previousWorkflowRuns),
  ].join("\n");
}

export function buildWorkflowOutputs(
  context: WorkflowExecutionContext,
  query: string,
  workflow: Workflow,
  workflowRunId: string,
  workspaceId: string,
): CreateWorkflowOutputInput[] {
  const outputTypes = workflow.outputTypes.length > 0 ? workflow.outputTypes : ["report"];
  const report = buildWorkflowReportContent(context, query, workflow);
  const layers = summarizeWorkflowContextLayers(context);

  return outputTypes.map((outputType) => ({
    workflowRunId,
    workspaceId,
    outputType,
    title: `${workflow.name} — ${outputType}`,
    content: outputType === "insight"
      ? `Insight for "${query}": ${context.globalFacts.length} global fact(s), ${context.domainFacts.length} domain fact(s), ${context.objects.length} object(s), ${context.previousWorkflowRuns.length} prior run(s).`
      : report,
    data: {
      query,
      workflowId: workflow.workflowId,
      layers,
      retrievedPackageCount: context.retrievedContext.length,
    },
    metadata: {
      workflowRunId,
    },
  }));
}
