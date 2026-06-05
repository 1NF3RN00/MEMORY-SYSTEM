import { z } from "zod";
import {
  ANALYSIS_SPEC_KEYS,
  type AnalysisSpecKey,
} from "@memory-middleware/shared-types";

export const analysisSeveritySchema = z.enum([
  "critical",
  "high",
  "medium",
  "low",
  "info",
]);

export const analysisTaskStatusSchema = z.enum(["determined", "insufficient_data"]);

export const analysisFindingSchema = z.object({
  taskId: z.string().min(1),
  status: analysisTaskStatusSchema,
  metric: z.string().optional(),
  observedValue: z.unknown().optional(),
  assessment: z.string().max(280),
  severity: analysisSeveritySchema,
  evidenceObservationIds: z.array(z.string()),
  evidenceFactKeys: z.array(z.string()),
});

export const analysisGapSchema = z.object({
  taskId: z.string().min(1),
  status: analysisTaskStatusSchema,
  metric: z.string().min(1),
  subjectValue: z.unknown().optional(),
  benchmarkValue: z.unknown().optional(),
  gapDescription: z.string().max(280),
  evidenceObservationIds: z.array(z.string()),
});

export const analysisRecommendationSchema = z.object({
  taskId: z.string().min(1),
  status: analysisTaskStatusSchema,
  priority: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
  ]),
  action: z.string().max(140),
  rationale: z.string().max(280),
  supportedByObservationIds: z.array(z.string()),
  supportedByFactKeys: z.array(z.string()),
});

export const workflowAnalysisOutputMetadataSchema = z.object({
  observationCount: z.number().int().nonnegative(),
  factCount: z.number().int().nonnegative(),
  modelId: z.string().min(1),
  traceId: z.string().min(1),
});

const workflowAnalysisOutputBaseSchema = z.object({
  workflowKey: z.string().min(1),
  analysisSpecKey: z.string().min(1),
  generatedAt: z.string().min(1),
  findings: z.array(analysisFindingSchema),
  gaps: z.array(analysisGapSchema),
  recommendations: z.array(analysisRecommendationSchema),
  metadata: workflowAnalysisOutputMetadataSchema,
});

export const SEO_AUDIT_V1_FINDING_TASK_IDS = [
  "seo_pages_indexed",
  "seo_title_coverage",
  "seo_schema",
  "seo_mobile_performance",
  "seo_lcp",
  "seo_cls",
  "seo_content_depth",
  "seo_internal_links",
] as const;

export const SEO_AUDIT_V1_GAP_TASK_IDS = ["seo_perf_gap"] as const;

export const SEO_AUDIT_V1_RECOMMENDATION_TASK_IDS = [
  "seo_title_rec",
  "seo_schema_rec",
  "seo_perf_rec",
] as const;

export const COMPETITIVE_GAP_V1_GAP_TASK_IDS = [
  "gap_reviews",
  "gap_rating",
  "gap_speed",
  "gap_pages",
  "gap_rank",
  "gap_social_engagement",
] as const;

export const COMPETITIVE_GAP_V1_RECOMMENDATION_TASK_IDS = ["gap_summary_rec"] as const;

export const MONTHLY_MARKETING_REVIEW_V1_FINDING_TASK_IDS = [
  "mkt_social_facebook",
  "mkt_social_instagram",
  "mkt_social_tiktok",
  "mkt_reputation",
  "mkt_seo_visibility",
  "mkt_brand_alignment",
  "mkt_strategy_alignment",
] as const;

export const MONTHLY_MARKETING_REVIEW_V1_RECOMMENDATION_TASK_IDS = [
  "mkt_social_rec",
  "mkt_reputation_rec",
  "mkt_priority_rec",
] as const;

function hasExactTaskIds<T extends { taskId: string }>(
  items: T[],
  expected: readonly string[],
): boolean {
  if (items.length !== expected.length) return false;
  const actual = new Set(items.map((item) => item.taskId));
  return expected.every((taskId) => actual.has(taskId));
}

function findingHasEvidenceWhenDetermined(finding: z.infer<typeof analysisFindingSchema>): boolean {
  if (finding.status !== "determined") return true;
  return finding.evidenceObservationIds.length > 0 || finding.evidenceFactKeys.length > 0;
}

const seoAuditV1OutputSchema = workflowAnalysisOutputBaseSchema.extend({
  analysisSpecKey: z.literal(ANALYSIS_SPEC_KEYS.SEO_AUDIT_V1),
  findings: z
    .array(analysisFindingSchema)
    .length(SEO_AUDIT_V1_FINDING_TASK_IDS.length)
    .refine(
      (findings) => hasExactTaskIds(findings, SEO_AUDIT_V1_FINDING_TASK_IDS),
      "findings must contain exactly the seo_audit_v1 task checklist",
    )
    .refine(
      (findings) => findings.every(findingHasEvidenceWhenDetermined),
      "determined findings must cite observation or fact evidence",
    ),
  gaps: z
    .array(analysisGapSchema)
    .length(SEO_AUDIT_V1_GAP_TASK_IDS.length)
    .refine(
      (gaps) => hasExactTaskIds(gaps, SEO_AUDIT_V1_GAP_TASK_IDS),
      "gaps must contain exactly the seo_audit_v1 task checklist",
    ),
  recommendations: z
    .array(analysisRecommendationSchema)
    .length(SEO_AUDIT_V1_RECOMMENDATION_TASK_IDS.length)
    .refine(
      (recommendations) => hasExactTaskIds(recommendations, SEO_AUDIT_V1_RECOMMENDATION_TASK_IDS),
      "recommendations must contain exactly the seo_audit_v1 task checklist",
    ),
});

const competitiveGapV1OutputSchema = workflowAnalysisOutputBaseSchema.extend({
  analysisSpecKey: z.literal(ANALYSIS_SPEC_KEYS.COMPETITIVE_GAP_V1),
  findings: z.array(analysisFindingSchema).length(0),
  gaps: z
    .array(analysisGapSchema)
    .length(COMPETITIVE_GAP_V1_GAP_TASK_IDS.length)
    .refine(
      (gaps) => hasExactTaskIds(gaps, COMPETITIVE_GAP_V1_GAP_TASK_IDS),
      "gaps must contain exactly the competitive_gap_v1 task checklist",
    ),
  recommendations: z
    .array(analysisRecommendationSchema)
    .length(COMPETITIVE_GAP_V1_RECOMMENDATION_TASK_IDS.length)
    .refine(
      (recommendations) =>
        hasExactTaskIds(recommendations, COMPETITIVE_GAP_V1_RECOMMENDATION_TASK_IDS),
      "recommendations must contain exactly the competitive_gap_v1 task checklist",
    ),
});

const monthlyMarketingReviewV1OutputSchema = workflowAnalysisOutputBaseSchema.extend({
  analysisSpecKey: z.literal(ANALYSIS_SPEC_KEYS.MONTHLY_MARKETING_REVIEW_V1),
  findings: z
    .array(analysisFindingSchema)
    .length(MONTHLY_MARKETING_REVIEW_V1_FINDING_TASK_IDS.length)
    .refine(
      (findings) => hasExactTaskIds(findings, MONTHLY_MARKETING_REVIEW_V1_FINDING_TASK_IDS),
      "findings must contain exactly the monthly_marketing_review_v1 task checklist",
    )
    .refine(
      (findings) => findings.every(findingHasEvidenceWhenDetermined),
      "determined findings must cite observation or fact evidence",
    ),
  gaps: z.array(analysisGapSchema).length(0),
  recommendations: z
    .array(analysisRecommendationSchema)
    .length(MONTHLY_MARKETING_REVIEW_V1_RECOMMENDATION_TASK_IDS.length)
    .refine(
      (recommendations) =>
        hasExactTaskIds(recommendations, MONTHLY_MARKETING_REVIEW_V1_RECOMMENDATION_TASK_IDS),
      "recommendations must contain exactly the monthly_marketing_review_v1 task checklist",
    ),
});

const OUTPUT_SCHEMA_BY_SPEC: Record<AnalysisSpecKey, z.ZodTypeAny> = {
  [ANALYSIS_SPEC_KEYS.SEO_AUDIT_V1]: seoAuditV1OutputSchema,
  [ANALYSIS_SPEC_KEYS.COMPETITIVE_GAP_V1]: competitiveGapV1OutputSchema,
  [ANALYSIS_SPEC_KEYS.MONTHLY_MARKETING_REVIEW_V1]: monthlyMarketingReviewV1OutputSchema,
};

export function isAnalysisSpecKey(value: string): value is AnalysisSpecKey {
  return value in OUTPUT_SCHEMA_BY_SPEC;
}

export function getWorkflowAnalysisOutputSchema(analysisSpecKey: string): z.ZodTypeAny {
  if (!isAnalysisSpecKey(analysisSpecKey)) {
    throw new Error(`Unknown analysisSpecKey: ${analysisSpecKey}`);
  }
  return OUTPUT_SCHEMA_BY_SPEC[analysisSpecKey as AnalysisSpecKey];
}

/** OpenAI-compatible JSON schema for structured output mode. */
export function getWorkflowAnalysisJsonSchema(analysisSpecKey: string): Record<string, unknown> {
  if (!isAnalysisSpecKey(analysisSpecKey)) {
    throw new Error(`Unknown analysisSpecKey: ${analysisSpecKey}`);
  }

  const findingItem = {
    type: "object",
    additionalProperties: false,
    properties: {
      taskId: { type: "string" },
      status: { type: "string", enum: ["determined", "insufficient_data"] },
      metric: { type: "string" },
      observedValue: {},
      assessment: { type: "string" },
      severity: { type: "string", enum: ["critical", "high", "medium", "low", "info"] },
      evidenceObservationIds: { type: "array", items: { type: "string" } },
      evidenceFactKeys: { type: "array", items: { type: "string" } },
    },
    required: [
      "taskId",
      "status",
      "assessment",
      "severity",
      "evidenceObservationIds",
      "evidenceFactKeys",
    ],
  };

  const gapItem = {
    type: "object",
    additionalProperties: false,
    properties: {
      taskId: { type: "string" },
      status: { type: "string", enum: ["determined", "insufficient_data"] },
      metric: { type: "string" },
      subjectValue: {},
      benchmarkValue: {},
      gapDescription: { type: "string" },
      evidenceObservationIds: { type: "array", items: { type: "string" } },
    },
    required: ["taskId", "status", "metric", "gapDescription", "evidenceObservationIds"],
  };

  const recommendationItem = {
    type: "object",
    additionalProperties: false,
    properties: {
      taskId: { type: "string" },
      status: { type: "string", enum: ["determined", "insufficient_data"] },
      priority: { type: "integer", minimum: 1, maximum: 5 },
      action: { type: "string" },
      rationale: { type: "string" },
      supportedByObservationIds: { type: "array", items: { type: "string" } },
      supportedByFactKeys: { type: "array", items: { type: "string" } },
    },
    required: [
      "taskId",
      "status",
      "priority",
      "action",
      "rationale",
      "supportedByObservationIds",
      "supportedByFactKeys",
    ],
  };

  const specChecklists: Record<
    AnalysisSpecKey,
    { findings: number; gaps: number; recommendations: number }
  > = {
    [ANALYSIS_SPEC_KEYS.SEO_AUDIT_V1]: {
      findings: SEO_AUDIT_V1_FINDING_TASK_IDS.length,
      gaps: SEO_AUDIT_V1_GAP_TASK_IDS.length,
      recommendations: SEO_AUDIT_V1_RECOMMENDATION_TASK_IDS.length,
    },
    [ANALYSIS_SPEC_KEYS.COMPETITIVE_GAP_V1]: {
      findings: 0,
      gaps: COMPETITIVE_GAP_V1_GAP_TASK_IDS.length,
      recommendations: COMPETITIVE_GAP_V1_RECOMMENDATION_TASK_IDS.length,
    },
    [ANALYSIS_SPEC_KEYS.MONTHLY_MARKETING_REVIEW_V1]: {
      findings: MONTHLY_MARKETING_REVIEW_V1_FINDING_TASK_IDS.length,
      gaps: 0,
      recommendations: MONTHLY_MARKETING_REVIEW_V1_RECOMMENDATION_TASK_IDS.length,
    },
  };

  const checklist = specChecklists[analysisSpecKey as AnalysisSpecKey];
  if (!checklist) {
    throw new Error(`Unknown analysisSpecKey: ${analysisSpecKey}`);
  }

  return {
    type: "object",
    additionalProperties: false,
    properties: {
      workflowKey: { type: "string" },
      analysisSpecKey: { type: "string", const: analysisSpecKey },
      generatedAt: { type: "string" },
      findings: {
        type: "array",
        minItems: checklist.findings,
        maxItems: checklist.findings,
        items: findingItem,
      },
      gaps: {
        type: "array",
        minItems: checklist.gaps,
        maxItems: checklist.gaps,
        items: gapItem,
      },
      recommendations: {
        type: "array",
        minItems: checklist.recommendations,
        maxItems: checklist.recommendations,
        items: recommendationItem,
      },
      metadata: {
        type: "object",
        additionalProperties: false,
        properties: {
          observationCount: { type: "integer" },
          factCount: { type: "integer" },
          modelId: { type: "string" },
          traceId: { type: "string" },
        },
        required: ["observationCount", "factCount", "modelId", "traceId"],
      },
    },
    required: [
      "workflowKey",
      "analysisSpecKey",
      "generatedAt",
      "findings",
      "gaps",
      "recommendations",
      "metadata",
    ],
  };
}
