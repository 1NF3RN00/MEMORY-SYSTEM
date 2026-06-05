import type { WorkflowAnalysisOutput } from "@memory-middleware/shared-types";
import { getWorkflowAnalysisOutputSchema } from "./workflow-analysis-schemas.js";

export interface WorkflowAnalysisValidationResult {
  success: boolean;
  output?: WorkflowAnalysisOutput;
  errors: string[];
}

export function validateWorkflowAnalysisOutput(
  raw: unknown,
  analysisSpecKey: string,
): WorkflowAnalysisValidationResult {
  const schema = getWorkflowAnalysisOutputSchema(analysisSpecKey);
  const parsed = schema.safeParse(raw);

  if (!parsed.success) {
    return {
      success: false,
      errors: parsed.error.issues.map(
        (issue) => `${issue.path.join(".") || "root"}: ${issue.message}`,
      ),
    };
  }

  return {
    success: true,
    output: parsed.data as WorkflowAnalysisOutput,
    errors: [],
  };
}
