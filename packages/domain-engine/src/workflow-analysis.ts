import type {
  RunWorkflowAnalysisConfig,
  WorkflowAnalysisInput,
  WorkflowAnalysisOutput,
} from "@memory-middleware/shared-types";
import {
  WORKFLOW_ANALYSIS_SYSTEM_PROMPT,
} from "@memory-middleware/shared-types";
import { DomainEngineError } from "./errors.js";
import { getWorkflowAnalysisJsonSchema } from "./workflow-analysis-schemas.js";
import { validateWorkflowAnalysisOutput } from "./workflow-analysis-validate.js";

export interface StructuredJsonCallInput {
  systemPrompt: string;
  userMessage: string;
  modelId: string;
  temperature: 0;
  maxTokens: number;
  jsonSchema: Record<string, unknown>;
}

export interface StructuredJsonCaller {
  callStructuredJson(input: StructuredJsonCallInput): Promise<unknown>;
}

export function buildRunWorkflowAnalysisConfig(
  input: WorkflowAnalysisInput,
  modelId: string,
  traceId: string,
): RunWorkflowAnalysisConfig {
  return {
    modelId,
    temperature: 0,
    maxTokens: 4096,
    responseFormat: "json_schema",
    jsonSchema: getWorkflowAnalysisJsonSchema(input.analysisSpecKey),
  };
}

function buildUserMessage(
  input: WorkflowAnalysisInput,
  validationErrors?: string[],
): string {
  if (!validationErrors?.length) {
    return JSON.stringify(input);
  }

  return JSON.stringify({
    input,
    validationErrors,
    instruction: "Fix the output JSON to satisfy the schema. Return only corrected JSON.",
  });
}

function attachOutputMetadata(
  raw: WorkflowAnalysisOutput,
  input: WorkflowAnalysisInput,
  config: RunWorkflowAnalysisConfig,
  traceId: string,
): WorkflowAnalysisOutput {
  return {
    ...raw,
    workflowKey: input.workflowKey,
    analysisSpecKey: input.analysisSpecKey,
    generatedAt: raw.generatedAt || new Date().toISOString(),
    metadata: {
      observationCount: input.observations.length,
      factCount: input.globalFacts.length + input.domainFacts.length,
      modelId: config.modelId,
      traceId,
    },
  };
}

export async function runWorkflowAnalysis(
  input: WorkflowAnalysisInput,
  caller: StructuredJsonCaller,
  config: RunWorkflowAnalysisConfig,
  traceId: string,
): Promise<WorkflowAnalysisOutput> {
  let validationErrors: string[] | undefined;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const raw = await caller.callStructuredJson({
      systemPrompt: WORKFLOW_ANALYSIS_SYSTEM_PROMPT,
      userMessage: buildUserMessage(input, validationErrors),
      modelId: config.modelId,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      jsonSchema: config.jsonSchema,
    });

    const validated = validateWorkflowAnalysisOutput(raw, input.analysisSpecKey);
    if (validated.success && validated.output) {
      return attachOutputMetadata(validated.output, input, config, traceId);
    }

    validationErrors = validated.errors;
  }

  throw new DomainEngineError(
    `Workflow analysis output failed schema validation: ${validationErrors?.join("; ") ?? "unknown error"}`,
    "validation",
  );
}
