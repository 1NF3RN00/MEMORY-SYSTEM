import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { apiGet, apiPost } from "../lib/api.js";
import { StatusPanel } from "../components/StatusPanel.js";
import { SelectField } from "../components/SelectField.js";
import { Button } from "../components/ui/Button.js";
import { PageHeader } from "../components/ui/PageHeader.js";
import { TextAreaField } from "../components/ui/TextField.js";
import { Panel } from "../components/ui/Panel.js";
import { Badge } from "../components/ui/Badge.js";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
} from "../components/ui/DataTable.js";
import { MetricCell, MetricStrip } from "../components/ui/MetricCell.js";
import { staggerContainer, staggerItem } from "../design-system/motion.js";

type PlanningMode = "precision" | "expanded" | "exploratory" | "incident-response";
type TabId = "decomposition" | "planning" | "expansion" | "modes" | "replay" | "tuning" | "benchmark";

interface RetrievalModeDefinition {
  mode: PlanningMode;
  label: string;
  description: string;
  optimizesFor: string[];
  topKMultiplier: number;
  similarityThresholdDelta: number;
  breadthDescription: string;
  precisionProtection: string;
}

interface RetrievalPlanView {
  planId: string;
  query: string;
  retrievalMode: PlanningMode;
  decomposedConcepts: string[];
  retrievalHints: string[];
  expansionTerms: string[];
  weightingAdjustments: {
    operational: number;
    recency: number;
    semanticDensity: number;
    reinforcement: number;
  };
  metadataExpansion: {
    tags: string[];
    relationships: string[];
    operationalDomains: string[];
  };
  generatedAt: string;
  decomposition: {
    operationalConcepts: string[];
    entities: string[];
    domains: string[];
    timeReferences: string[];
    contextualPriorities: string[];
  };
  explainability: {
    decompositionReasons: string[];
    expansionReasons: Array<{ term: string; source: string; reason: string }>;
    weightingReasons: string[];
    modeImpacts: string[];
  };
}

interface PlanSummary {
  planId: string;
  query: string;
  retrievalMode: string;
  status: string;
  createdAt: string;
}

interface ReplayResult {
  planId: string;
  matches: boolean;
  differences: string[];
  replayedAt: string;
  originalPlan: RetrievalPlanView;
  replayedPlan: RetrievalPlanView;
}

interface ModeTuningEntry {
  mode: PlanningMode;
  precisionIntegrityOk: boolean;
  metrics: {
    precisionScore: number;
    pollutionScore: number;
    pollutionRisk: string;
    expansionTermCount: number;
    expansionTermDeltaVsPrecision: number;
    hintCount: number;
  };
}

interface TuningResult {
  tuningId: string;
  recommendedMode: PlanningMode;
  recommendationReason: string;
  precisionIntegrityProtected: boolean;
  entries: ModeTuningEntry[];
}

interface BenchmarkResult {
  benchmarkId: string;
  replayMatches: boolean;
  replayDifferences: string[];
  pollutionControlled: boolean;
  precisionImprovedVsBaseline: boolean;
  summary: string;
  selectedMode: PlanningMode;
  precisionBaseline: { precisionScore: number; pollutionScore: number; pollutionRisk: string };
  selectedModeMetrics: { precisionScore: number; pollutionScore: number; pollutionRisk: string };
  modeBenchmarks: Array<{
    mode: PlanningMode;
    metrics: {
      precisionScore: number;
      pollutionScore: number;
      pollutionRisk: string;
      pollutionControlled: boolean;
      determinismMatch: boolean;
    };
  }>;
}

interface BatchBenchmarkResult {
  totalPlans: number;
  deterministicMatches: number;
  determinismRate: number;
  averagePrecisionScore: number;
  averagePollutionScore: number;
  pollutionControlledCount: number;
}

const TABS: Array<{ id: TabId; label: string; code: string }> = [
  { id: "decomposition", label: "Query Decomposition", code: "PLAN.01" },
  { id: "planning", label: "Retrieval Planning", code: "PLAN.02" },
  { id: "expansion", label: "Expansion Inspector", code: "PLAN.03" },
  { id: "modes", label: "Retrieval Modes", code: "PLAN.04" },
  { id: "replay", label: "Planning Replay", code: "PLAN.05" },
  { id: "tuning", label: "Mode Tuning", code: "PLAN.06" },
  { id: "benchmark", label: "Replay Benchmark", code: "PLAN.07" },
];

const MODE_OPTIONS = [
  { value: "precision", label: "Precision" },
  { value: "expanded", label: "Expanded" },
  { value: "exploratory", label: "Exploratory" },
  { value: "incident-response", label: "Incident Response" },
];

export function PlanningPage() {
  const { planId } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>("decomposition");
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [plan, setPlan] = useState<RetrievalPlanView | null>(null);
  const [modes, setModes] = useState<RetrievalModeDefinition[]>([]);
  const [replay, setReplay] = useState<ReplayResult | null>(null);
  const [queryText, setQueryText] = useState("");
  const [retrievalMode, setRetrievalMode] = useState<PlanningMode>("precision");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tuning, setTuning] = useState<TuningResult | null>(null);
  const [benchmark, setBenchmark] = useState<BenchmarkResult | null>(null);
  const [batchBenchmark, setBatchBenchmark] = useState<BatchBenchmarkResult | null>(null);
  const [tuningLoading, setTuningLoading] = useState(false);
  const [benchmarkLoading, setBenchmarkLoading] = useState(false);

  useEffect(() => {
    apiGet<{ id: string }>("/workspaces/default")
      .then((ws) => setWorkspaceId(ws.id))
      .catch(() => setWorkspaceId(null));
    apiGet<{ modes: RetrievalModeDefinition[] }>("/retrieval/modes")
      .then((data) => setModes(data.modes))
      .catch(() => setModes([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);

    if (planId) {
      Promise.all([
        apiGet<{ plan: RetrievalPlanView }>(`/retrieval/plan/${planId}`),
        apiGet<{ replay: ReplayResult }>(`/retrieval/plan/${planId}/replay`),
      ])
        .then(([planData, replayData]) => {
          setPlan(planData.plan);
          setReplay(replayData.replay);
        })
        .catch((e: Error) => setError(e.message))
        .finally(() => setLoading(false));
    } else if (workspaceId) {
      apiGet<{ plans: PlanSummary[] }>(`/retrieval/plans?workspaceId=${workspaceId}&limit=50`)
        .then((data) => setPlans(data.plans))
        .catch((e: Error) => setError(e.message))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [planId, workspaceId]);

  async function handleCreatePlan(e: FormEvent) {
    e.preventDefault();
    if (!workspaceId || !queryText.trim()) return;

    setSubmitting(true);
    setError(null);
    try {
      const result = await apiPost<{ planId: string }>("/retrieval/plan", {
        workspaceId,
        query: queryText.trim(),
        retrievalMode,
      });
      navigate(`/planning/${result.planId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTuneModes() {
    if (!workspaceId || !queryText.trim()) return;
    setTuningLoading(true);
    setError(null);
    try {
      const result = await apiPost<{ tuning: TuningResult }>("/retrieval/plan/tune", {
        workspaceId,
        query: queryText.trim(),
      });
      setTuning(result.tuning);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setTuningLoading(false);
    }
  }

  async function handleBatchBenchmark() {
    if (!workspaceId) return;
    setBenchmarkLoading(true);
    setError(null);
    try {
      const result = await apiPost<{ batch: BatchBenchmarkResult }>(
        `/retrieval/plans/benchmark?workspaceId=${workspaceId}&limit=20`,
        {},
      );
      setBatchBenchmark(result.batch);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBenchmarkLoading(false);
    }
  }

  async function handlePlanBenchmark() {
    if (!planId || !plan) return;
    setBenchmarkLoading(true);
    setError(null);
    try {
      const result = await apiPost<{ benchmark: BenchmarkResult }>(
        `/retrieval/plan/${planId}/benchmark`,
        {},
      );
      setBenchmark(result.benchmark);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBenchmarkLoading(false);
    }
  }

  if (loading) {
    return <StatusPanel title="Loading planning data…" loading />;
  }

  if (!planId) {
    return (
      <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-6">
        <motion.div variants={staggerItem}>
          <PageHeader
            title="Retrieval Planning"
            lede="Deterministic preprocessing, metadata expansion, and retrieval plan artifacts"
            code="SPRINT.06"
          />
        </motion.div>

        {error && (
          <motion.div variants={staggerItem}>
            <Panel title="Error">
              <p className="text-sm text-[var(--color-danger)]">{error}</p>
            </Panel>
          </motion.div>
        )}

        <motion.div variants={staggerItem}>
          <Panel title="Create Retrieval Plan" code="POST /retrieval/plan">
            <form onSubmit={handleCreatePlan} className="space-y-4">
              <TextAreaField
                label="Query"
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                placeholder="What operational systems improved liquidity response during overnight volatility?"
                rows={3}
              />
              <SelectField
                label="Retrieval Mode"
                value={retrievalMode}
                onChange={(v) => setRetrievalMode(v as PlanningMode)}
                options={MODE_OPTIONS}
              />
              <Button type="submit" disabled={submitting || !workspaceId}>
                {submitting ? "Planning…" : "Generate Plan"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={tuningLoading || !workspaceId || !queryText.trim()}
                onClick={handleTuneModes}
              >
                {tuningLoading ? "Tuning…" : "Tune All Modes"}
              </Button>
            </form>
          </Panel>
        </motion.div>

        {tuning && (
          <motion.div variants={staggerItem}>
            <Panel title="Mode Tuning Result" code="POST /retrieval/plan/tune">
              <MetricStrip>
                <MetricCell label="Recommended" value={tuning.recommendedMode} accent />
                <MetricCell
                  label="Precision Protected"
                  value={tuning.precisionIntegrityProtected ? "Yes" : "No"}
                />
              </MetricStrip>
              <p className="mt-3 text-xs text-[var(--color-text-secondary)]">
                {tuning.recommendationReason}
              </p>
              <DataTable className="mt-4">
                <DataTableHead>
                  <DataTableRow>
                    <DataTableHeaderCell>Mode</DataTableHeaderCell>
                    <DataTableHeaderCell>Precision</DataTableHeaderCell>
                    <DataTableHeaderCell>Pollution</DataTableHeaderCell>
                    <DataTableHeaderCell>Risk</DataTableHeaderCell>
                    <DataTableHeaderCell>Expansion Δ</DataTableHeaderCell>
                    <DataTableHeaderCell>Integrity OK</DataTableHeaderCell>
                  </DataTableRow>
                </DataTableHead>
                <DataTableBody>
                  {tuning.entries.map((entry) => (
                    <DataTableRow key={entry.mode}>
                      <DataTableCell>
                        <Badge>{entry.mode}</Badge>
                      </DataTableCell>
                      <DataTableCell className="font-mono">
                        {entry.metrics.precisionScore.toFixed(3)}
                      </DataTableCell>
                      <DataTableCell className="font-mono">
                        {entry.metrics.pollutionScore.toFixed(3)}
                      </DataTableCell>
                      <DataTableCell>{entry.metrics.pollutionRisk}</DataTableCell>
                      <DataTableCell>{entry.metrics.expansionTermDeltaVsPrecision}</DataTableCell>
                      <DataTableCell>
                        {entry.precisionIntegrityOk ? "Yes" : "No"}
                      </DataTableCell>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
            </Panel>
          </motion.div>
        )}

        <motion.div variants={staggerItem}>
          <Panel title="Batch Replay Benchmark" code="POST /retrieval/plans/benchmark">
            <p className="mb-3 text-xs text-[var(--color-text-secondary)]">
              Benchmark determinism and precision/pollution scores across recent stored plans.
            </p>
            <Button
              type="button"
              variant="secondary"
              disabled={benchmarkLoading || !workspaceId}
              onClick={handleBatchBenchmark}
            >
              {benchmarkLoading ? "Benchmarking…" : "Run Batch Benchmark"}
            </Button>
            {batchBenchmark && (
              <MetricStrip className="mt-4">
                <MetricCell
                  label="Determinism Rate"
                  value={`${(batchBenchmark.determinismRate * 100).toFixed(0)}%`}
                  accent
                />
                <MetricCell label="Plans" value={String(batchBenchmark.totalPlans)} />
                <MetricCell
                  label="Avg Precision"
                  value={batchBenchmark.averagePrecisionScore.toFixed(3)}
                />
                <MetricCell
                  label="Avg Pollution"
                  value={batchBenchmark.averagePollutionScore.toFixed(3)}
                />
                <MetricCell
                  label="Pollution Controlled"
                  value={`${batchBenchmark.pollutionControlledCount}/${batchBenchmark.totalPlans}`}
                />
              </MetricStrip>
            )}
          </Panel>
        </motion.div>

        <motion.div variants={staggerItem}>
          <Panel title="Recent Plans" code="GET /retrieval/plans">
            {plans.length === 0 ? (
              <p className="text-sm text-[var(--color-text-secondary)]">No plans yet.</p>
            ) : (
              <DataTable>
                <DataTableHead>
                  <DataTableRow>
                    <DataTableHeaderCell>Plan ID</DataTableHeaderCell>
                    <DataTableHeaderCell>Query</DataTableHeaderCell>
                    <DataTableHeaderCell>Mode</DataTableHeaderCell>
                    <DataTableHeaderCell>Status</DataTableHeaderCell>
                    <DataTableHeaderCell>Created</DataTableHeaderCell>
                    <DataTableHeaderCell>Retrieve</DataTableHeaderCell>
                  </DataTableRow>
                </DataTableHead>
                <DataTableBody>
                  {plans.map((p) => (
                    <DataTableRow key={p.planId}>
                      <DataTableCell>
                        <Link
                          to={`/planning/${p.planId}`}
                          className="font-mono text-xs text-[var(--color-accent)] hover:underline"
                        >
                          {p.planId.slice(0, 12)}…
                        </Link>
                      </DataTableCell>
                      <DataTableCell className="max-w-xs truncate">{p.query}</DataTableCell>
                      <DataTableCell>
                        <Badge>{p.retrievalMode}</Badge>
                      </DataTableCell>
                      <DataTableCell>{p.status}</DataTableCell>
                      <DataTableCell className="font-mono text-xs">
                        {new Date(p.createdAt).toLocaleString()}
                      </DataTableCell>
                      <DataTableCell>
                        <Link
                          to={`/retrieval-traces?planId=${p.planId}`}
                          className="font-metric text-xs text-[var(--color-accent)] no-underline hover:underline"
                        >
                          Use plan
                        </Link>
                      </DataTableCell>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
            )}
          </Panel>
        </motion.div>

        {modes.length > 0 && (
          <motion.div variants={staggerItem}>
            <Panel title="Retrieval Mode Reference" code="GET /retrieval/modes">
              <div className="grid gap-3 md:grid-cols-2">
                {modes.map((mode) => (
                  <div
                    key={mode.mode}
                    className="rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] p-4"
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <Badge>{mode.mode}</Badge>
                      <span className="text-sm font-medium">{mode.label}</span>
                    </div>
                    <p className="text-xs text-[var(--color-text-secondary)]">{mode.description}</p>
                  </div>
                ))}
              </div>
            </Panel>
          </motion.div>
        )}
      </motion.div>
    );
  }

  if (!plan) {
    return (
      <StatusPanel
        title="Plan not found"
        {...(error ? { description: error } : {})}
      />
    );
  }

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={staggerItem}>
        <PageHeader
          title="Retrieval Plan"
          lede={plan.query}
          code={`PLAN ${plan.planId.slice(0, 8)}`}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Link to={`/retrieval-traces?planId=${plan.planId}`}>
                <Button>Execute retrieval</Button>
              </Link>
              <Link to="/planning">
                <Button variant="secondary">All Plans</Button>
              </Link>
            </div>
          }
        />
      </motion.div>

      <motion.div variants={staggerItem}>
        <MetricStrip>
          <MetricCell label="Mode" value={plan.retrievalMode} />
          <MetricCell label="Concepts" value={String(plan.decomposedConcepts.length)} />
          <MetricCell label="Hints" value={String(plan.retrievalHints.length)} />
          <MetricCell label="Expansion Terms" value={String(plan.expansionTerms.length)} />
        </MetricStrip>
      </motion.div>

      <motion.div variants={staggerItem} className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-[var(--color-accent-muted)] text-[var(--color-text-primary)]"
                : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)]"
            }`}
          >
            {tab.label}
            <span className="ml-1.5 font-metric text-[0.5625rem] text-[var(--color-text-muted)]">
              {tab.code}
            </span>
          </button>
        ))}
      </motion.div>

      {activeTab === "decomposition" && (
        <motion.div variants={staggerItem} className="grid gap-4 lg:grid-cols-2">
          <Panel title="Extracted Concepts" code="PLAN.01.A">
            <TagList items={plan.decomposedConcepts} empty="No concepts extracted" />
          </Panel>
          <Panel title="Operational Concepts" code="PLAN.01.B">
            <TagList items={plan.decomposition.operationalConcepts} />
          </Panel>
          <Panel title="Operational Domains" code="PLAN.01.C">
            <TagList items={plan.decomposition.domains} />
          </Panel>
          <Panel title="Contextual Priorities" code="PLAN.01.D">
            <TagList items={plan.decomposition.contextualPriorities} />
          </Panel>
          <Panel title="Entities" code="PLAN.01.E">
            <TagList items={plan.decomposition.entities} empty="No named entities detected" />
          </Panel>
          <Panel title="Time References" code="PLAN.01.F">
            <TagList items={plan.decomposition.timeReferences} empty="No time references detected" />
          </Panel>
          <Panel title="Decomposition Explainability" code="PLAN.01.G" className="lg:col-span-2">
            <ReasonList items={plan.explainability.decompositionReasons} />
          </Panel>
        </motion.div>
      )}

      {activeTab === "planning" && (
        <motion.div variants={staggerItem} className="grid gap-4 lg:grid-cols-2">
          <Panel title="Retrieval Hints" code="PLAN.02.A">
            <TagList items={plan.retrievalHints} />
          </Panel>
          <Panel title="Weighting Adjustments" code="PLAN.02.B">
            <DataTable>
              <DataTableBody>
                {Object.entries(plan.weightingAdjustments).map(([key, value]) => (
                  <DataTableRow key={key}>
                    <DataTableCell className="capitalize">{key}</DataTableCell>
                    <DataTableCell className="font-mono">{value.toFixed(3)}</DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          </Panel>
          <Panel title="Weighting Explainability" code="PLAN.02.C" className="lg:col-span-2">
            <ReasonList items={plan.explainability.weightingReasons} />
          </Panel>
        </motion.div>
      )}

      {activeTab === "expansion" && (
        <motion.div variants={staggerItem} className="grid gap-4 lg:grid-cols-2">
          <Panel title="Metadata Tags" code="PLAN.03.A">
            <TagList items={plan.metadataExpansion.tags} />
          </Panel>
          <Panel title="Relationship Expansion" code="PLAN.03.B">
            <TagList items={plan.metadataExpansion.relationships} empty="No relationship expansion" />
          </Panel>
          <Panel title="Operational Domain Expansion" code="PLAN.03.C">
            <TagList items={plan.metadataExpansion.operationalDomains} />
          </Panel>
          <Panel title="All Expansion Terms" code="PLAN.03.D">
            <TagList items={plan.expansionTerms} />
          </Panel>
          <Panel title="Expansion Explainability" code="PLAN.03.E" className="lg:col-span-2">
            {plan.explainability.expansionReasons.length === 0 ? (
              <p className="text-sm text-[var(--color-text-secondary)]">No expansion terms added.</p>
            ) : (
              <DataTable>
                <DataTableHead>
                  <DataTableRow>
                    <DataTableHeaderCell>Term</DataTableHeaderCell>
                    <DataTableHeaderCell>Source</DataTableHeaderCell>
                    <DataTableHeaderCell>Reason</DataTableHeaderCell>
                  </DataTableRow>
                </DataTableHead>
                <DataTableBody>
                  {plan.explainability.expansionReasons.map((r) => (
                    <DataTableRow key={`${r.term}-${r.source}`}>
                      <DataTableCell className="font-mono text-xs">{r.term}</DataTableCell>
                      <DataTableCell>
                        <Badge>{r.source}</Badge>
                      </DataTableCell>
                      <DataTableCell className="text-xs">{r.reason}</DataTableCell>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
            )}
          </Panel>
        </motion.div>
      )}

      {activeTab === "modes" && (
        <motion.div variants={staggerItem} className="space-y-4">
          <Panel title="Active Mode Impacts" code="PLAN.04.A">
            <ReasonList items={plan.explainability.modeImpacts} />
          </Panel>
          <div className="grid gap-4 md:grid-cols-2">
            {modes.map((mode) => (
              <Panel
                key={mode.mode}
                title={mode.label}
                code={`PLAN.04.${mode.mode}`}
                className={mode.mode === plan.retrievalMode ? "ring-1 ring-[var(--color-accent)]" : ""}
              >
                <p className="mb-3 text-xs text-[var(--color-text-secondary)]">{mode.description}</p>
                <div className="space-y-1 text-xs">
                  <p>
                    <span className="text-[var(--color-text-muted)]">Top-K: </span>
                    {mode.topKMultiplier}x
                  </p>
                  <p>
                    <span className="text-[var(--color-text-muted)]">Threshold delta: </span>
                    {mode.similarityThresholdDelta}
                  </p>
                  <p className="text-[var(--color-text-secondary)]">{mode.breadthDescription}</p>
                  <p className="text-[var(--color-success)]">{mode.precisionProtection}</p>
                </div>
              </Panel>
            ))}
          </div>
        </motion.div>
      )}

      {activeTab === "replay" && replay && (
        <motion.div variants={staggerItem} className="space-y-4">
          <Panel title="Replay Result" code="GET /retrieval/plan/:id/replay">
            <MetricStrip>
              <MetricCell label="Deterministic Match" value={replay.matches ? "Yes" : "No"} />
              <MetricCell label="Differences" value={String(replay.differences.length)} />
              <MetricCell
                label="Replayed At"
                value={new Date(replay.replayedAt).toLocaleTimeString()}
              />
            </MetricStrip>
            {!replay.matches && replay.differences.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-medium text-[var(--color-text-secondary)]">
                  Differences detected:
                </p>
                <TagList items={replay.differences} />
              </div>
            )}
          </Panel>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Original Plan" code="PLAN.05.A">
              <PlanSummaryView plan={replay.originalPlan} />
            </Panel>
            <Panel title="Replayed Plan" code="PLAN.05.B">
              <PlanSummaryView plan={replay.replayedPlan} />
            </Panel>
          </div>
        </motion.div>
      )}

      {activeTab === "tuning" && (
        <motion.div variants={staggerItem} className="space-y-4">
          <Panel title="Mode Tuning" code="POST /retrieval/plan/tune">
            <p className="mb-3 text-xs text-[var(--color-text-secondary)]">
              Compare all retrieval modes for this query with precision protection bounds.
            </p>
            <Button
              type="button"
              disabled={tuningLoading || !workspaceId}
              onClick={async () => {
                if (!workspaceId || !plan) return;
                setTuningLoading(true);
                try {
                  const result = await apiPost<{ tuning: TuningResult }>("/retrieval/plan/tune", {
                    workspaceId,
                    query: plan.query,
                  });
                  setTuning(result.tuning);
                } catch (err) {
                  setError(err instanceof Error ? err.message : String(err));
                } finally {
                  setTuningLoading(false);
                }
              }}
            >
              {tuningLoading ? "Tuning…" : "Run Mode Tuning"}
            </Button>
            {tuning && (
              <>
                <MetricStrip className="mt-4">
                  <MetricCell label="Recommended" value={tuning.recommendedMode} accent />
                  <MetricCell
                    label="Current Mode"
                    value={plan.retrievalMode}
                  />
                </MetricStrip>
                <p className="mt-3 text-xs text-[var(--color-text-secondary)]">
                  {tuning.recommendationReason}
                </p>
                <DataTable className="mt-4">
                  <DataTableHead>
                    <DataTableRow>
                      <DataTableHeaderCell>Mode</DataTableHeaderCell>
                      <DataTableHeaderCell>Precision</DataTableHeaderCell>
                      <DataTableHeaderCell>Pollution</DataTableHeaderCell>
                      <DataTableHeaderCell>Risk</DataTableHeaderCell>
                    </DataTableRow>
                  </DataTableHead>
                  <DataTableBody>
                    {tuning.entries.map((entry) => (
                      <DataTableRow key={entry.mode}>
                        <DataTableCell><Badge>{entry.mode}</Badge></DataTableCell>
                        <DataTableCell className="font-mono">{entry.metrics.precisionScore.toFixed(3)}</DataTableCell>
                        <DataTableCell className="font-mono">{entry.metrics.pollutionScore.toFixed(3)}</DataTableCell>
                        <DataTableCell>{entry.metrics.pollutionRisk}</DataTableCell>
                      </DataTableRow>
                    ))}
                  </DataTableBody>
                </DataTable>
              </>
            )}
          </Panel>
        </motion.div>
      )}

      {activeTab === "benchmark" && (
        <motion.div variants={staggerItem} className="space-y-4">
          <Panel title="Replay Benchmark" code="POST /retrieval/plan/:id/benchmark">
            <p className="mb-3 text-xs text-[var(--color-text-secondary)]">
              Measure replay determinism, precision scores, and pollution control across all modes.
            </p>
            <Button type="button" disabled={benchmarkLoading} onClick={handlePlanBenchmark}>
              {benchmarkLoading ? "Benchmarking…" : "Run Benchmark"}
            </Button>
            {benchmark && (
              <>
                <MetricStrip className="mt-4">
                  <MetricCell label="Replay Deterministic" value={benchmark.replayMatches ? "Yes" : "No"} accent />
                  <MetricCell label="Pollution Controlled" value={benchmark.pollutionControlled ? "Yes" : "No"} />
                  <MetricCell label="Precision Score" value={benchmark.selectedModeMetrics.precisionScore.toFixed(3)} />
                  <MetricCell label="Pollution Score" value={benchmark.selectedModeMetrics.pollutionScore.toFixed(3)} />
                </MetricStrip>
                <p className="mt-3 text-xs text-[var(--color-text-secondary)]">{benchmark.summary}</p>
                {!benchmark.replayMatches && benchmark.replayDifferences.length > 0 && (
                  <div className="mt-3">
                    <TagList items={benchmark.replayDifferences} />
                  </div>
                )}
                <DataTable className="mt-4">
                  <DataTableHead>
                    <DataTableRow>
                      <DataTableHeaderCell>Mode</DataTableHeaderCell>
                      <DataTableHeaderCell>Precision</DataTableHeaderCell>
                      <DataTableHeaderCell>Pollution</DataTableHeaderCell>
                      <DataTableHeaderCell>Controlled</DataTableHeaderCell>
                      <DataTableHeaderCell>Deterministic</DataTableHeaderCell>
                    </DataTableRow>
                  </DataTableHead>
                  <DataTableBody>
                    {benchmark.modeBenchmarks.map((entry) => (
                      <DataTableRow key={entry.mode}>
                        <DataTableCell><Badge>{entry.mode}</Badge></DataTableCell>
                        <DataTableCell className="font-mono">{entry.metrics.precisionScore.toFixed(3)}</DataTableCell>
                        <DataTableCell className="font-mono">{entry.metrics.pollutionScore.toFixed(3)}</DataTableCell>
                        <DataTableCell>{entry.metrics.pollutionControlled ? "Yes" : "No"}</DataTableCell>
                        <DataTableCell>{entry.metrics.determinismMatch ? "Yes" : "No"}</DataTableCell>
                      </DataTableRow>
                    ))}
                  </DataTableBody>
                </DataTable>
              </>
            )}
          </Panel>
        </motion.div>
      )}
    </motion.div>
  );
}

function TagList({ items, empty = "None" }: { items: string[]; empty?: string }) {
  if (items.length === 0) {
    return <p className="text-sm text-[var(--color-text-secondary)]">{empty}</p>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <Badge key={item}>{item}</Badge>
      ))}
    </div>
  );
}

function ReasonList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((item) => (
        <li key={item} className="text-xs text-[var(--color-text-secondary)]">
          {item}
        </li>
      ))}
    </ul>
  );
}

function PlanSummaryView({ plan }: { plan: RetrievalPlanView }) {
  return (
    <div className="space-y-2 text-xs">
      <p>
        <span className="text-[var(--color-text-muted)]">Concepts: </span>
        {plan.decomposedConcepts.join(", ") || "—"}
      </p>
      <p>
        <span className="text-[var(--color-text-muted)]">Hints: </span>
        {plan.retrievalHints.length}
      </p>
      <p>
        <span className="text-[var(--color-text-muted)]">Expansion: </span>
        {plan.expansionTerms.length} terms
      </p>
      <p>
        <span className="text-[var(--color-text-muted)]">Weighting: </span>
        op={plan.weightingAdjustments.operational}, rec={plan.weightingAdjustments.recency}
      </p>
    </div>
  );
}
