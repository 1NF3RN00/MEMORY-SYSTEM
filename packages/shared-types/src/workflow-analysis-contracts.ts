/**
 * Structured workflow LLM analysis contracts (Phase 1).
 * @see docs/observation-system/LLM_ANALYSIS_CONTRACT.md
 */

import type { NormalizedObservation, ObservationValue } from "./observation-contracts.js";

export const ANALYSIS_SPEC_KEYS = {
  SEO_AUDIT_V1: "seo_audit_v1",
  COMPETITIVE_GAP_V1: "competitive_gap_v1",
  MONTHLY_MARKETING_REVIEW_V1: "monthly_marketing_review_v1",
} as const;

export type AnalysisSpecKey =
  (typeof ANALYSIS_SPEC_KEYS)[keyof typeof ANALYSIS_SPEC_KEYS];

export type AnalysisSeverity = "critical" | "high" | "medium" | "low" | "info";

export type AnalysisTaskStatus = "determined" | "insufficient_data";

export interface WorkflowAnalysisFactInput {
  key: string;
  content: string;
}

export interface WorkflowAnalysisDomainFactInput {
  domainKey: string;
  key: string;
  content: string;
}

export interface WorkflowAnalysisInstructionInput {
  domainKey: string;
  actionKey: string;
  content: string;
}

export interface WorkflowAnalysisObjectInput {
  objectType: string;
  name: string;
  metadata: Record<string, unknown>;
}

export interface WorkflowAnalysisPreviousOutputInput {
  workflowRunId: string;
  title: string;
  outputType: string;
  summary: string;
}

export interface WorkflowAnalysisInput {
  workflowKey: string;
  workflowName: string;
  query: string;
  businessId?: string;
  analysisSpecKey: string;
  globalFacts: WorkflowAnalysisFactInput[];
  domainFacts: WorkflowAnalysisDomainFactInput[];
  instructions: WorkflowAnalysisInstructionInput[];
  objects: WorkflowAnalysisObjectInput[];
  observations: NormalizedObservation[];
  previousOutputs: WorkflowAnalysisPreviousOutputInput[];
}

export interface AnalysisFinding {
  taskId: string;
  status: AnalysisTaskStatus;
  metric?: string;
  observedValue?: ObservationValue;
  assessment: string;
  severity: AnalysisSeverity;
  evidenceObservationIds: string[];
  evidenceFactKeys: string[];
}

export interface AnalysisGap {
  taskId: string;
  status: AnalysisTaskStatus;
  metric: string;
  subjectValue?: ObservationValue;
  benchmarkValue?: ObservationValue;
  gapDescription: string;
  evidenceObservationIds: string[];
}

export interface AnalysisRecommendation {
  taskId: string;
  status: AnalysisTaskStatus;
  priority: 1 | 2 | 3 | 4 | 5;
  action: string;
  rationale: string;
  supportedByObservationIds: string[];
  supportedByFactKeys: string[];
}

export interface WorkflowAnalysisOutputMetadata {
  observationCount: number;
  factCount: number;
  modelId: string;
  traceId: string;
}

export interface WorkflowAnalysisOutput {
  workflowKey: string;
  analysisSpecKey: string;
  generatedAt: string;
  findings: AnalysisFinding[];
  gaps: AnalysisGap[];
  recommendations: AnalysisRecommendation[];
  metadata: WorkflowAnalysisOutputMetadata;
}

export interface RunWorkflowAnalysisConfig {
  modelId: string;
  temperature: 0;
  maxTokens: number;
  responseFormat: "json_schema";
  jsonSchema: Record<string, unknown>;
}

/** Fixed system prompt — do not customize per workspace. */
export const WORKFLOW_ANALYSIS_SYSTEM_PROMPT = `You are a structured business analyst. You analyze ONLY the JSON input provided.

Rules:
1. Every finding, gap, and recommendation MUST cite observationId(s) or fact key(s) from the input.
2. If required data for an analysis task is missing from the input, output status "insufficient_data" for that task item. Do not guess.
3. Do not introduce metrics, entities, or facts not present in the input.
4. Do not use outside knowledge.
5. Return ONLY valid JSON matching the output schema. No prose outside JSON.
6. Severity must be one of: critical, high, medium, low, info.
7. Numeric comparisons must use values exactly as given in observations.`;

export const WORKFLOW_ANALYSIS_EVENT_TYPES = {
  WORKFLOW_ANALYSIS_INPUT: "workflow_analysis_input",
  WORKFLOW_ANALYSIS_STARTED: "workflow_analysis_started",
  WORKFLOW_ANALYSIS_COMPLETED: "workflow_analysis_completed",
  WORKFLOW_ANALYSIS_FAILED: "workflow_analysis_failed",
} as const;

export type WorkflowAnalysisEventType =
  (typeof WORKFLOW_ANALYSIS_EVENT_TYPES)[keyof typeof WORKFLOW_ANALYSIS_EVENT_TYPES];
