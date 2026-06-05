import type {
  CreateWorkflowOutputInput,
  Workflow,
  WorkflowAnalysisOutput,
} from "@memory-middleware/shared-types";

export function renderWorkflowAnalysisMarkdown(
  output: WorkflowAnalysisOutput,
  query: string,
  workflowName: string,
): string {
  const findingLines =
    output.findings.length === 0
      ? "None"
      : output.findings
          .map((finding) => {
            const evidence = [
              ...finding.evidenceObservationIds,
              ...finding.evidenceFactKeys,
            ].join(", ");
            return `- [${finding.severity}] ${finding.taskId}: ${finding.assessment} (evidence: ${evidence || "none"})`;
          })
          .join("\n");

  const gapLines =
    output.gaps.length === 0
      ? "None"
      : output.gaps
          .map((gap) => `- ${gap.metric}: ${gap.gapDescription}`)
          .join("\n");

  const sortedRecommendations = [...output.recommendations].sort(
    (left, right) => left.priority - right.priority,
  );
  const recommendationLines =
    sortedRecommendations.length === 0
      ? "None"
      : sortedRecommendations
          .map(
            (recommendation) =>
              `- P${recommendation.priority}: ${recommendation.action} — ${recommendation.rationale}`,
          )
          .join("\n");

  return [
    `# ${workflowName}`,
    `Query: ${query}`,
    `Generated: ${output.generatedAt}`,
    "",
    "## Findings",
    findingLines,
    "",
    "## Gaps",
    gapLines,
    "",
    "## Recommendations",
    recommendationLines,
  ].join("\n");
}

export function buildOutputsFromAnalysis(
  output: WorkflowAnalysisOutput,
  query: string,
  workflow: Workflow,
  workflowRunId: string,
  workspaceId: string,
): CreateWorkflowOutputInput[] {
  const outputTypes = workflow.outputTypes.length > 0 ? workflow.outputTypes : ["report"];
  const content = renderWorkflowAnalysisMarkdown(output, query, workflow.name);

  return outputTypes.map((outputType) => ({
    workflowRunId,
    workspaceId,
    outputType,
    title: `${workflow.name} — ${outputType}`,
    content,
    data: output as unknown as Record<string, unknown>,
    metadata: {
      workflowRunId,
      analysisSpecKey: output.analysisSpecKey,
    },
  }));
}
