# Workflow LLM Analysis Contract

**Authority:** This document defines the **only** way workflows may use an LLM. If implementation code passes raw memory chunks, Apify payloads, or open-ended prompts to the model, that code is wrong.

---

## Principle

The LLM is a **structured analyst**, not a researcher.

It receives:

1. A fixed `WorkflowAnalysisInput` JSON object (normalized fields only).
2. An `analysisSpecKey` that defines **exactly** what to determine.
3. A system prompt that forbids inference beyond supplied data.

It returns:

1. A `WorkflowAnalysisOutput` JSON object matching the schema for that `analysisSpecKey`.
2. Nothing else — no markdown essays, no uncited claims, no new metrics.

---

## What the LLM MUST NOT receive

| Forbidden | Why |
|-----------|-----|
| Raw Apify actor output | Unnormalized; may contain PII and noise |
| Memory chunk text from vector retrieval | Unbounded; may contradict facts |
| URLs not already in `NormalizedObservation.source` | External lookup |
| Provider implementation details | Layer violation |
| Full `WorkflowExecutionContext` blob | Contains non-normalized fields |
| User free-text beyond `query` | Uncontrolled scope |
| Instructions to "browse", "search", or "use general knowledge" | Hallucination vector |

---

## Pipeline placement

```
executeWorkflow()
  → resolve context (facts, instructions, objects, observations, retrievedContext, previousRuns)
  → buildWorkflowAnalysisInput()     // strips to WorkflowAnalysisInput
  → runWorkflowAnalysis()            // LLM call with structured output
  → validateWorkflowAnalysisOutput() // JSON schema enforcement
  → buildWorkflowOutputs()           // render report from validated output
  → persist outputs + optional generated facts
```

File: `packages/domain-engine/src/workflow-analysis.ts`

The deterministic markdown builder in `workflow-output-builder.ts` becomes a **renderer** of `WorkflowAnalysisOutput`, not the analyst.

---

## System prompt (fixed — do not customize per workspace)

```
You are a structured business analyst. You analyze ONLY the JSON input provided.

Rules:
1. Every finding, gap, and recommendation MUST cite observationId(s) or fact key(s) from the input.
2. If required data for an analysis task is missing from the input, output status "insufficient_data" for that task item. Do not guess.
3. Do not introduce metrics, entities, or facts not present in the input.
4. Do not use outside knowledge.
5. Return ONLY valid JSON matching the output schema. No prose outside JSON.
6. Severity must be one of: critical, high, medium, low, info.
7. Numeric comparisons must use values exactly as given in observations.
```

---

## Input builder

File: `packages/domain-engine/src/workflow-analysis-input.ts`

```ts
export function buildWorkflowAnalysisInput(
  context: WorkflowExecutionContext,
  workflow: Workflow,
  query: string,
  analysisSpecKey: string,
): WorkflowAnalysisInput
```

Transform rules:

| Source field | Input field | Transform |
|--------------|-------------|-----------|
| `context.globalFacts` | `globalFacts` | `{ key, content }` only |
| `context.domainFacts` | `domainFacts` | `{ domainKey, key, content }` — resolve domainKey from store |
| `context.instructions` | `instructions` | `{ domainKey, actionKey, content }` |
| `context.objects` | `objects` | `{ objectType, name, metadata }` |
| `context.observations` | `observations` | pass through (already `NormalizedObservation[]`) |
| `context.previousWorkflowRuns` | `previousOutputs` | map outputs to `{ workflowRunId, title, outputType, summary }` where summary = first 200 chars of content |
| `workflow.workflowKey` | `workflowKey` | direct |
| `workflow.name` | `workflowName` | direct |

**Do not include** `context.retrievedContext` in LLM input unless a future analysisSpec explicitly adds a `supplementalExcerpts` field. Default: excluded.

---

## Output schema (base)

All analysis specs extend this base:

```ts
interface AnalysisFinding {
  taskId: string;           // from analysis spec checklist
  status: "determined" | "insufficient_data";
  metric?: string;
  observedValue?: ObservationValue;
  assessment: string;       // max 280 chars
  severity: "critical" | "high" | "medium" | "low" | "info";
  evidenceObservationIds: string[];
  evidenceFactKeys: string[];
}

interface AnalysisGap {
  taskId: string;
  status: "determined" | "insufficient_data";
  metric: string;
  subjectValue?: ObservationValue;
  benchmarkValue?: ObservationValue;
  gapDescription: string;   // max 280 chars
  evidenceObservationIds: string[];
}

interface AnalysisRecommendation {
  taskId: string;
  status: "determined" | "insufficient_data";
  priority: 1 | 2 | 3 | 4 | 5;
  action: string;           // max 140 chars, imperative verb
  rationale: string;        // max 280 chars
  supportedByObservationIds: string[];
  supportedByFactKeys: string[];
}
```

Validation: `packages/domain-engine/src/workflow-analysis-validate.ts` uses Zod schemas generated from this doc.

---

## Analysis specs (exactly what to find out)

Each workflow's `analysisSpecKey` maps to a **closed checklist** of `taskId`s. The LLM must produce one finding (or gap/recommendation where noted) per task. No additional tasks.

### `seo_audit_v1`

**Purpose:** Determine technical SEO and performance posture from website + pagespeed observations.

**Required observation metrics** (if missing → `insufficient_data` for that task):

| taskId | Type | Determine exactly |
|--------|------|-------------------|
| `seo_pages_indexed` | finding | Is `page_count` present? State count and whether it implies adequate site coverage for a service business (based only on facts stating expected page count, if any). |
| `seo_title_coverage` | finding | From `pages_missing_title` and `duplicate_titles`: state whether title tag coverage is acceptable. |
| `seo_schema` | finding | From `schema_present`: boolean — is structured data present? |
| `seo_mobile_performance` | finding | From `mobile_score`: state score and classify severity using thresholds: &lt;50 critical, 50–69 high, 70–89 medium, ≥90 info. |
| `seo_lcp` | finding | From `largest_contentful_paint`: state value in ms and classify: &gt;4000 critical, 2500–4000 high, &lt;2500 info. |
| `seo_cls` | finding | From `cumulative_layout_shift`: state value; &gt;0.25 critical, 0.1–0.25 high, &lt;0.1 info. |
| `seo_content_depth` | finding | From `average_word_count`: state value. Compare to domain fact `target-word-count` if present. |
| `seo_internal_links` | finding | From `internal_link_count`: state value. |
| `seo_perf_gap` | gap | If both `mobile_score` (subject) and competitor observation `competitor_speed_score` exist: state numeric gap. |
| `seo_title_rec` | recommendation | If `pages_missing_title` &gt; 0 OR `duplicate_titles` &gt; 0: recommend fixing titles. Priority 1 if missing &gt; 5. |
| `seo_schema_rec` | recommendation | If `schema_present` is false: recommend adding schema. Priority 2. |
| `seo_perf_rec` | recommendation | If `mobile_score` &lt; 70: recommend performance remediation. Priority 1 if &lt; 50. |

**Domains consumed:** `website`, `competitor` (optional), `strategy` (facts only).

---

### `competitive_gap_v1`

**Purpose:** Determine numeric gaps between subject business and competitors.

**Required observation metrics:**

| taskId | Type | Determine exactly |
|--------|------|-------------------|
| `gap_reviews` | gap | `review_count` vs `competitor_review_count` for same competitorId |
| `gap_rating` | gap | `average_rating` vs `competitor_rating` |
| `gap_speed` | gap | `mobile_score` vs `competitor_speed_score` |
| `gap_pages` | gap | `page_count` vs `competitor_page_count` |
| `gap_rank` | gap | `keyword_rank` vs `competitor_rankings` (if array, use best rank) |
| `gap_social_engagement` | gap | Subject `engagement_rate` vs competitor `engagement_rate` where platform matches |
| `gap_summary_rec` | recommendation | Identify the single largest numeric gap by percentage difference; recommend one action targeting that gap. |

**Domains consumed:** `competitor`, `website`, `reputation`, `social`.

---

### `monthly_marketing_review_v1`

**Purpose:** Determine month-over-month marketing health signals.

**Required observation metrics:**

| taskId | Type | Determine exactly |
|--------|------|-------------------|
| `mkt_social_facebook` | finding | `follower_count`, `posts_per_month`, `average_post_reactions` for platform=facebook |
| `mkt_social_instagram` | finding | `follower_count`, `posts_per_month`, `engagement_rate` for platform=instagram |
| `mkt_social_tiktok` | finding | `average_views`, `engagement_rate`, `monthly_follower_growth` for platform=tiktok |
| `mkt_reputation` | finding | `review_count`, `average_rating`, `review_velocity` |
| `mkt_seo_visibility` | finding | `top10_keywords`, `average_rank` if present |
| `mkt_brand_alignment` | finding | Read domain facts under domainKey=brand. State whether social activity metrics align with brand fact `posting-cadence-target` if that fact exists. insufficient_data if fact missing. |
| `mkt_strategy_alignment` | finding | Read global/domain facts under strategy domain. State whether reputation and visibility findings align with fact `primary-growth-goal` if present. |
| `mkt_social_rec` | recommendation | Lowest `engagement_rate` platform: recommend one improvement action. |
| `mkt_reputation_rec` | recommendation | If `review_velocity` declining (compare two most recent observations by collectedAt): recommend review generation. |
| `mkt_priority_rec` | recommendation | Rank top 3 actions across all findings by severity. Priority 1–3. |

**Domains consumed:** `brand`, `strategy`, `social`, `website`, `reputation`.

---

## Model call configuration

File: `packages/domain-engine/src/workflow-analysis.ts`

```ts
interface RunWorkflowAnalysisConfig {
  modelId: string;          // from workspace config or env WORKFLOW_ANALYSIS_MODEL
  temperature: 0;
  maxTokens: 4096;
  responseFormat: "json_schema";
  jsonSchema: object;       // generated from analysisSpecKey
}
```

- **temperature: 0** — non-negotiable.
- **responseFormat: json_schema** — use provider structured output (OpenAI `response_format`, Anthropic tool use with strict schema, etc.).
- Retry once on schema validation failure with error message appended to user payload.

---

## Persistence

After validation:

1. `WorkflowOutput.content` = rendered markdown from `WorkflowAnalysisOutput` (deterministic template).
2. `WorkflowOutput.data` = full `WorkflowAnalysisOutput` JSON.
3. Optional: create `domain_facts` from recommendations with `sourceWorkflowRunId` when `workflow.persistRecommendationsAsFacts` is true (default false).

---

## Renderer template

File: `packages/domain-engine/src/workflow-analysis-render.ts`

Deterministic — no LLM. Sections:

```markdown
# {workflowName}
Query: {query}
Generated: {generatedAt}

## Findings
{foreach finding: - [{severity}] {taskId}: {assessment} (evidence: {ids})}

## Gaps
{foreach gap: - {metric}: {gapDescription}}

## Recommendations
{foreach recommendation sorted by priority: - P{priority}: {action} — {rationale}}
```

---

## Adding a new analysis spec

1. Add task table to this document with closed `taskId` checklist.
2. Add Zod schema in `workflow-analysis-schemas.ts`.
3. Add `analysisSpecKey` to a workflow in a package manifest.
4. Do not add free-form prompt fields.

---

## Exit criteria (Phase 8)

1. LLM receives JSON matching `WorkflowAnalysisInput` — verified by trace log `workflow_analysis_input` event.
2. Output passes Zod validation for assigned `analysisSpecKey`.
3. Every finding with `status: "determined"` has ≥1 evidence ID.
4. Running `seo_audit_v1` with zero observations yields all tasks `insufficient_data` — no hallucinated findings.
5. Running with fixture observations produces deterministic assessments for threshold-based tasks (e.g. `mobile_score: 45` → severity `critical`).
