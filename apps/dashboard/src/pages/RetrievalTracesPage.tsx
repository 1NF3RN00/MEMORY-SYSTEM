import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { apiGet, apiPost } from "../lib/api.js";
import { StatusPanel } from "../components/StatusPanel.js";
import { SelectField } from "../components/SelectField.js";
import { Button } from "../components/ui/Button.js";
import { PageHeader } from "../components/ui/PageHeader.js";
import { TextAreaField, TextField } from "../components/ui/TextField.js";
import { Panel } from "../components/ui/Panel.js";
import { Badge, statusToBadge } from "../components/ui/Badge.js";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
} from "../components/ui/DataTable.js";
import { MetricCell, MetricStrip } from "../components/ui/MetricCell.js";
import { TraceObservabilityPanel } from "../components/observability/TraceObservabilityPanel.js";
import {
  observabilityTraceHref,
  parseObservabilitySubview,
} from "../lib/traceObservability.js";
import type {
  ExecutionTimingAudit,
  LlmCallAudit,
  RetrievalDbObservability,
} from "@memory-middleware/shared-types";
import { ContextAssembly, TokenBudgetVisualizer } from "../components/observability/ContextAssembly.js";
import { ExplainabilityPanel, ReinforcementScoringPanel } from "../components/observability/ExplainabilityPanel.js";
import { RetrievalHeatmap } from "../components/observability/RetrievalHeatmap.js";
import { staggerContainer, staggerItem } from "../design-system/motion.js";
import { RetrievalAugmentationViewer } from "../components/relationship-map/RetrievalAugmentationViewer.js";
import { RetrievalThresholdPanel } from "../components/RetrievalThresholdPanel.js";

interface TraceSummary {
  retrievalTraceId: string;
  workspaceId: string;
  query: string;
  status: string;
  createdAt: string;
  completedAt?: string;
}

interface StageRecord {
  stage: string;
  status: string;
  startedAt?: string;
  completedAt?: string;
  latencyMs?: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

interface RankingRow {
  memoryId: string;
  chunkId: string;
  semanticSimilarity: number;
  importanceBoost: number;
  recencyBoost: number;
  reinforcementBoost: number;
  semanticDensityBoost: number;
  finalScore: number;
  rankingRank: number;
}

interface RejectedRow {
  memoryId: string;
  chunkId: string;
  reason: string;
  detail: string;
  semanticSimilarity?: number;
  finalScore?: number;
}

interface ContextPackageView {
  query: string;
  retrievalTraceId: string;
  tokenBudget: { maxTokens: number; usedTokens: number; trimmedTokens: number };
  retrievalMetadata: {
    retrievalLatencyMs: number;
    retrievedChunkCount: number;
    deduplicatedChunkCount: number;
    finalChunkCount: number;
    expansion?: {
      metadataExpansion: {
        expandedTags: string[];
        matchedMetadataKeys: string[];
        enrichmentScore: number;
      };
      contextualNeighbors: Array<{
        sourceChunkId: string;
        neighborChunkId: string;
        relationship: string;
        hintWeight: number;
      }>;
      expansionApplied: boolean;
    };
  };
  memories: Array<{
    memoryId: string;
    title: string;
    memoryType: string;
    memoryScore: number;
    chunks: Array<{ chunkId: string; chunkIndex: number; tokenCount: number; finalScore: number }>;
  }>;
  rejectedCandidates: RejectedRow[];
  rankingBreakdown: RankingRow[];
  chunkTraces: Array<{
    chunkId: string;
    deduplicationDecision: string;
    tokenBudgetDecision: string;
    finalScore: number;
    rankingRank: number;
  }>;
}

interface TraceDetail {
  trace: {
    retrievalTraceId: string;
    workspaceId: string;
    query: string;
    status: string;
    retrievalMode: string;
    tokenBudget: number;
    stages: StageRecord[];
    timingAudit?: ExecutionTimingAudit;
    llmCallAudit?: LlmCallAudit;
    dbObservability?: RetrievalDbObservability;
    contextPackage?: ContextPackageView;
    preprocessedQuery?: { normalizedQuery: string; keywords: string[] };
    createdAt: string;
    completedAt?: string;
  };
}

interface EventItem {
  eventId: string;
  eventType: string;
  timestamp: string;
  severity: string;
  success: boolean;
  latencyMs?: number;
  metadata: Record<string, unknown>;
}

interface HeatmapEntry {
  memoryId: string;
  accessCount: number;
  averageRank: number;
  averageScore: number;
}

interface PlanSummary {
  planId: string;
  query: string;
  retrievalMode: string;
  status: string;
  createdAt: string;
}

interface ImportedPlan {
  planId: string;
  query: string;
  retrievalMode: "precision" | "expanded" | "exploratory" | "incident-response";
}

export function RetrievalTracesPage() {
  const { traceId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const observabilityRef = useRef<HTMLDivElement>(null);
  const observabilitySubview = parseObservabilitySubview(searchParams.get("view"));
  const highlightObservability = searchParams.get("view") === "observability";
  const [traces, setTraces] = useState<TraceSummary[]>([]);
  const [detail, setDetail] = useState<TraceDetail | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapEntry[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [queryText, setQueryText] = useState("");
  const [tokenBudget, setTokenBudget] = useState(4096);
  const [retrievalMode, setRetrievalMode] = useState<
    "precision" | "expanded" | "exploratory" | "incident-response"
  >("precision");
  const [submitting, setSubmitting] = useState(false);
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [importedPlan, setImportedPlan] = useState<ImportedPlan | null>(null);
  const [planIdInput, setPlanIdInput] = useState(() => searchParams.get("planId") ?? "");
  const [planImportError, setPlanImportError] = useState<string | null>(null);
  const [planImportLoading, setPlanImportLoading] = useState(false);
  const [augmentation, setAugmentation] = useState<{
    augmentation: {
      neighborsExpanded: Array<{ memoryId: string; relationshipType: string; confidence: number; generatedFrom: string[]; inCandidateSet: boolean; rankingImpact: number }>;
      rankingImpacts: Array<{ memoryId: string; chunkId: string; previousScore: number; augmentedScore: number; relationshipType: string; confidence: number }>;
      augmentationApplied: boolean;
      maxDepth: 1;
      neighborCount: number;
      confidenceThreshold: number;
      reasoning: string[];
    };
  } | null>(null);

  useEffect(() => {
    apiGet<{ id: string }>("/workspaces/default")
      .then((ws) => setWorkspaceId(ws.id))
      .catch(() => setWorkspaceId(null));
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);

    if (traceId) {
      Promise.all([
        apiGet<TraceDetail>(`/retrieval/${traceId}`),
        apiGet<{ events: EventItem[] }>(`/events/${traceId}`),
        apiGet<{ augmentation: typeof augmentation extends { augmentation: infer A } | null ? A : never }>(`/augmentation/${traceId}`).catch(() => null),
      ])
        .then(([traceData, eventData, augData]) => {
          setDetail(traceData);
          setEvents(eventData.events);
          setAugmentation(augData);
        })
        .catch((e: Error) => setError(e.message))
        .finally(() => setLoading(false));
    } else {
      Promise.all([
        apiGet<{ traces: TraceSummary[] }>("/retrieval?limit=50"),
        workspaceId
          ? apiGet<{ entries: HeatmapEntry[] }>(
              `/retrieval/heatmaps?workspaceId=${workspaceId}&limit=30`,
            )
          : Promise.resolve({ entries: [] }),
        workspaceId
          ? apiGet<{ plans: PlanSummary[] }>(
              `/retrieval/plans?workspaceId=${workspaceId}&limit=30`,
            )
          : Promise.resolve({ plans: [] }),
      ])
        .then(([traceData, heatmapData, planData]) => {
          setTraces(traceData.traces);
          setHeatmap(heatmapData.entries);
          setPlans(planData.plans);
        })
        .catch((e: Error) => setError(e.message))
        .finally(() => setLoading(false));
    }
  }, [traceId, workspaceId]);

  useEffect(() => {
    if (!traceId || !searchParams.get("view")?.startsWith("observ")) return;
    observabilityRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [traceId, searchParams, detail]);

  useEffect(() => {
    const planId = searchParams.get("planId")?.trim();
    if (!planId || traceId || planId === importedPlan?.planId) return;

    setPlanIdInput(planId);
    void importPlanById(planId);
  }, [searchParams, traceId, importedPlan?.planId]);

  async function importPlanById(planId: string) {
    const trimmed = planId.trim();
    if (!trimmed) {
      setImportedPlan(null);
      setPlanImportError(null);
      return;
    }

    setPlanImportLoading(true);
    setPlanImportError(null);
    try {
      const result = await apiGet<{ plan: ImportedPlan }>(`/retrieval/plan/${trimmed}`);
      const plan = result.plan;
      setImportedPlan(plan);
      setQueryText(plan.query);
      setRetrievalMode(plan.retrievalMode);
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("planId", trimmed);
          return next;
        },
        { replace: true },
      );
    } catch (err) {
      setImportedPlan(null);
      setPlanImportError(err instanceof Error ? err.message : String(err));
    } finally {
      setPlanImportLoading(false);
    }
  }

  function clearImportedPlan() {
    setImportedPlan(null);
    setPlanIdInput("");
    setPlanImportError(null);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("planId");
        return next;
      },
      { replace: true },
    );
  }

  async function handleRetrieve(e: FormEvent) {
    e.preventDefault();
    if (!workspaceId || !queryText.trim()) return;

    setSubmitting(true);
    setError(null);
    try {
      const result = await apiPost<{ retrievalTraceId: string }>("/retrieve", {
        workspaceId,
        query: queryText.trim(),
        tokenBudget,
        retrievalMode,
        ...(importedPlan ? { planId: importedPlan.planId } : {}),
      });
      navigate(`/retrieval-traces/${result.retrievalTraceId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <StatusPanel title="Loading retrieval data…" loading />;
  }

  if (error && !traceId) {
    return <StatusPanel title="Retrieval observability" description={error} />;
  }

  if (!traceId) {
    return (
      <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="max-w-[1200px]">
        <motion.div variants={staggerItem}>
          <PageHeader
            code="RET.04"
            title="Retrieval Observability"
            lede="Deterministic contextual retrieval — ranking, deduplication, token budgeting, and explainability."
          />
        </motion.div>

        <motion.div variants={staggerItem} className="mb-6">
          <MetricStrip columns={3}>
            <MetricCell label="Total Traces" value={traces.length} />
            <MetricCell label="Heatmap Entries" value={heatmap.length} accent />
            <MetricCell label="Mode" value="Precision-first" />
          </MetricStrip>
        </motion.div>

        <motion.div variants={staggerItem} className="mb-6">
          <Panel
            code="RET.TUNE"
            title="Similarity Threshold"
            description="Workspace-level base threshold for vector retrieval. Mode-specific deltas apply automatically; zero-result retry relaxes by 0.05 down to 0.45."
          >
            <div className="mt-4">
              <RetrievalThresholdPanel workspaceId={workspaceId} />
            </div>
          </Panel>
        </motion.div>

        <motion.div variants={staggerItem} className="mb-6">
          <Panel
            code="RET.RUN"
            title="Execute Retrieval"
            description="Submit a query to the retrieval pipeline. Import an existing retrieval plan to apply its decomposition, expansion, and weighting hints."
          >
            <div className="mt-4 rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] p-4">
              <p className="mb-3 font-metric text-[0.625rem] uppercase tracking-[0.06em] text-[var(--color-text-tertiary)]">
                Import retrieval plan
              </p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <SelectField
                  label="Recent plans"
                  value={importedPlan?.planId ?? ""}
                  onChange={(value) => {
                    if (!value) {
                      clearImportedPlan();
                      return;
                    }
                    setPlanIdInput(value);
                    void importPlanById(value);
                  }}
                  options={[
                    { value: "", label: "No plan — run query only" },
                    ...plans.map((p) => ({
                      value: p.planId,
                      label: `${p.planId.slice(0, 10)}… — ${p.query.slice(0, 48)}${p.query.length > 48 ? "…" : ""}`,
                    })),
                  ]}
                />
                <TextField
                  label="Plan ID"
                  hint="Paste a plan ID or open /retrieval-traces?planId=… from Planning."
                  value={planIdInput}
                  onChange={(e) => setPlanIdInput(e.target.value)}
                  onBlur={() => {
                    const trimmed = planIdInput.trim();
                    if (trimmed && trimmed !== importedPlan?.planId) {
                      void importPlanById(trimmed);
                    }
                  }}
                  placeholder="01J…"
                />
              </div>
              {planImportLoading && (
                <p className="mt-3 text-xs text-[var(--color-text-secondary)]">Loading plan…</p>
              )}
              {planImportError && (
                <p className="mt-3 font-metric text-xs text-[var(--color-danger)]">{planImportError}</p>
              )}
              {importedPlan && (
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-[rgba(74,222,128,0.2)] bg-[rgba(74,222,128,0.06)] px-3 py-2">
                  <Badge>Plan imported</Badge>
                  <span className="font-mono text-xs text-[var(--color-text-secondary)]">
                    {importedPlan.planId}
                  </span>
                  <Link
                    to={`/planning/${importedPlan.planId}`}
                    className="text-xs text-[var(--color-accent)] no-underline hover:underline"
                  >
                    View plan
                  </Link>
                  <button
                    type="button"
                    onClick={clearImportedPlan}
                    className="ml-auto font-metric text-[0.625rem] uppercase tracking-[0.04em] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>

            <form onSubmit={handleRetrieve} className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <TextAreaField
                className="md:col-span-2"
                label="Query"
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                rows={3}
                required
              />
              <TextField
                label="Token budget"
                type="number"
                min={100}
                value={tokenBudget}
                onChange={(e) => setTokenBudget(Number(e.target.value))}
              />
              <SelectField
                label="Retrieval mode"
                value={retrievalMode}
                onChange={(v) =>
                  setRetrievalMode(
                    v as "precision" | "expanded" | "exploratory" | "incident-response",
                  )
                }
                options={[
                  { value: "precision", label: "Precision" },
                  { value: "expanded", label: "Expanded" },
                  { value: "exploratory", label: "Exploratory" },
                  { value: "incident-response", label: "Incident Response" },
                ]}
              />
              <div className="md:col-span-2">
                <Button type="submit" disabled={submitting || !workspaceId} loading={submitting}>
                  Execute retrieval
                </Button>
              </div>
            </form>
            {error && <p className="mt-3 font-metric text-xs text-[var(--color-danger)]">{error}</p>}
          </Panel>
        </motion.div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <motion.div variants={staggerItem}>
            <Panel code="RET.HEAT" title="Access Heatmap" description="Memory access frequency from completed retrieval traces.">
              <RetrievalHeatmap entries={heatmap} />
            </Panel>
          </motion.div>

          <motion.div variants={staggerItem}>
            <Panel code="RET.LOG" title="Recent Operations" description="Retrieval transactions ordered by execution time.">
              <DataTable dense>
                <DataTableHead>
                  <DataTableHeaderCell>Trace</DataTableHeaderCell>
                  <DataTableHeaderCell>Query</DataTableHeaderCell>
                  <DataTableHeaderCell>Status</DataTableHeaderCell>
                  <DataTableHeaderCell>Time</DataTableHeaderCell>
                  <DataTableHeaderCell>Audits</DataTableHeaderCell>
                </DataTableHead>
                <DataTableBody>
                  {traces.map((t) => (
                    <DataTableRow key={t.retrievalTraceId}>
                      <DataTableCell mono>
                        <Link to={`/retrieval-traces/${t.retrievalTraceId}`} className="text-[var(--color-accent)] no-underline hover:underline">
                          {t.retrievalTraceId.slice(0, 10)}…
                        </Link>
                      </DataTableCell>
                      <DataTableCell>{t.query.slice(0, 40)}{t.query.length > 40 ? "…" : ""}</DataTableCell>
                      <DataTableCell><Badge variant={statusToBadge(t.status)}>{t.status}</Badge></DataTableCell>
                      <DataTableCell mono>{new Date(t.createdAt).toLocaleString()}</DataTableCell>
                      <DataTableCell>
                        <Link
                          to={observabilityTraceHref(t.retrievalTraceId)}
                          className="font-metric text-[0.625rem] uppercase tracking-[0.04em] text-[var(--color-accent)] no-underline hover:underline"
                        >
                          Observability
                        </Link>
                      </DataTableCell>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
            </Panel>
          </motion.div>
        </div>
      </motion.div>
    );
  }

  if (!detail?.trace) {
    return <StatusPanel title="Trace not found" {...(error ? { description: error } : {})} />;
  }

  const { trace } = detail;
  const pkg = trace.contextPackage;

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="max-w-[1200px]">
      <motion.div variants={staggerItem}>
        <Link to="/retrieval-traces" className="mb-4 inline-flex items-center gap-1 font-metric text-[0.625rem] uppercase tracking-[0.06em] text-[var(--color-text-tertiary)] no-underline hover:text-[var(--color-accent)]">
          ← All retrievals
        </Link>
        <PageHeader
          code="RET.TRACE"
          title="Retrieval Operation"
          lede={trace.query}
          action={
            <div className="flex items-center gap-2">
              <Badge variant={statusToBadge(trace.status)}>{trace.status}</Badge>
              <Badge>{trace.retrievalMode}</Badge>
            </div>
          }
        />
        <p className="-mt-4 mb-6 font-metric text-xs text-[var(--color-text-muted)]">
          {trace.retrievalTraceId}
        </p>
      </motion.div>

      {trace.status === "completed" && !pkg && (
        <motion.div variants={staggerItem} className="mb-6">
          <Panel>
            <p className="font-metric text-xs text-[var(--color-danger)]">
              Context package missing — re-run the query to create a retrievable trace.
            </p>
          </Panel>
        </motion.div>
      )}

      {trace.status === "completed" && pkg && (
        <motion.div variants={staggerItem} className="mb-6">
          <Panel code="CMP.NEXT" title="Next Step" description="Compression optimizes the context package in a separate deterministic step.">
            <Link
              to={`/compression-traces?retrievalTraceId=${trace.retrievalTraceId}`}
              className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border-default)] bg-[var(--color-surface-2)] px-4 py-2 font-metric text-xs uppercase tracking-[0.04em] text-[var(--color-text-primary)] no-underline transition-colors hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-3)]"
            >
              Compress this retrieval →
            </Link>
          </Panel>
        </motion.div>
      )}

      <motion.div variants={staggerItem} className="mb-4" ref={observabilityRef}>
        <Panel
          code="OBS.UNIFIED"
          title="Unified Observability"
          description="Execution timing, LLM call audit, and database query observability correlated by trace ID."
        >
          <TraceObservabilityPanel
            traceId={trace.retrievalTraceId}
            stages={trace.stages}
            {...(trace.timingAudit ? { timingAudit: trace.timingAudit } : {})}
            {...(trace.llmCallAudit ? { llmCallAudit: trace.llmCallAudit } : {})}
            {...(trace.dbObservability ? { dbObservability: trace.dbObservability } : {})}
            {...(pkg ? { legacyTotalLatencyMs: pkg.retrievalMetadata.retrievalLatencyMs } : {})}
            {...(observabilitySubview ? { initialSubview: observabilitySubview } : {})}
            highlight={highlightObservability}
          />
        </Panel>
      </motion.div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {pkg && (
          <motion.div variants={staggerItem}>
            <Panel code="CTX.ASM" title="Context Assembly" description="Token budget allocation and memory composition.">
              <ContextAssembly
                memories={pkg.memories}
                tokenBudget={pkg.tokenBudget}
                retrievedCount={pkg.retrievalMetadata.retrievedChunkCount}
                deduplicatedCount={pkg.retrievalMetadata.deduplicatedChunkCount}
                finalCount={pkg.retrievalMetadata.finalChunkCount}
              />
            </Panel>
          </motion.div>
        )}
      </div>

      {pkg && (
        <>
          <motion.div variants={staggerItem} className="mt-4">
            <Panel code="CTX.BUDGET" title="Token Budget Visualizer">
              <TokenBudgetVisualizer {...pkg.tokenBudget} />
            </Panel>
          </motion.div>

          <motion.div variants={staggerItem} className="mt-4">
            <Panel code="RET.EXPLAIN" title="Explainability" description="Forensic ranking decomposition and rejection analysis.">
              <ExplainabilityPanel
                rankingBreakdown={pkg.rankingBreakdown}
                rejectedCandidates={pkg.rejectedCandidates}
              />
            </Panel>
          </motion.div>

          <motion.div variants={staggerItem} className="mt-4">
            <Panel code="RET.AUG" title="Relationship Augmentation" description="Bounded depth-1 neighbor expansion and ranking impacts.">
              <RetrievalAugmentationViewer
                {...(augmentation?.augmentation
                  ? { augmentation: augmentation.augmentation }
                  : {})}
                traceId={trace.retrievalTraceId}
              />
            </Panel>
          </motion.div>

          <motion.div variants={staggerItem} className="mt-4">
            <Panel code="RET.REINF" title="Reinforcement Scoring">
              <ReinforcementScoringPanel rows={pkg.rankingBreakdown} />
            </Panel>
          </motion.div>
        </>
      )}

      {trace.preprocessedQuery && (
        <motion.div variants={staggerItem} className="mt-4">
          <Panel code="RET.PRE" title="Query Preprocessing">
            <p className="text-sm text-[var(--color-text-secondary)]">
              Keywords: {trace.preprocessedQuery.keywords.length > 0 ? trace.preprocessedQuery.keywords.join(", ") : "—"}
            </p>
          </Panel>
        </motion.div>
      )}

      <motion.div variants={staggerItem} className="mt-4">
        <Panel code="RET.EVENTS" title="Event Timeline" description="Append-only event stream for this operation.">
          <ul className="mt-2 divide-y divide-[var(--color-border-subtle)]">
            {events.map((e) => (
              <li
                key={e.eventId}
                className={`flex items-center justify-between gap-4 py-2.5 ${!e.success ? "text-[var(--color-danger)]" : ""}`}
              >
                <span className="font-metric text-xs">{e.eventType}</span>
                <span className="font-metric text-[0.625rem] text-[var(--color-text-muted)]">
                  {new Date(e.timestamp).toLocaleString()}
                </span>
                {e.latencyMs != null && (
                  <span className="font-metric text-[0.625rem] tabular-nums text-[var(--color-text-tertiary)]">
                    {e.latencyMs}ms
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      </motion.div>
    </motion.div>
  );
}
