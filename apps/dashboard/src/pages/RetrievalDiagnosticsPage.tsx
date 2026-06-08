import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { apiGet, apiPatch, apiPost } from "../lib/api.js";
import { SelectField } from "../components/SelectField.js";
import { RangeField } from "../components/ui/RangeField.js";
import { Button } from "../components/ui/Button.js";
import { PageHeader } from "../components/ui/PageHeader.js";
import { Panel } from "../components/ui/Panel.js";
import { TextField } from "../components/ui/TextField.js";
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
import { exportRetrievalReportPdf } from "../lib/exportRetrievalReportPdf.js";
import { ScoreHistogram } from "../components/diagnostics/ScoreHistogram.js";

type TabId = "diagnostics" | "calibration" | "trace" | "benchmark" | "signals";

type CalibrationSection =
  | "retrieval"
  | "ranking"
  | "chunking"
  | "relationships"
  | "compression"
  | "rendering";

interface RetrievalQualityMetrics {
  retrievalPrecision: number;
  retrievalBreadth: number;
  semanticCohesion: number;
  contextualDensity: number;
  rankingStability: number;
  relationshipUsefulness: number;
  chunkQuality: number;
  tokenEfficiency: number;
  compressionIntegrity: number;
  renderingQuality: number;
}

interface RetrievalSystemReport {
  reportId: string;
  retrievalTraceId: string;
  query: string;
  metrics: RetrievalQualityMetrics;
  detectedProblems: Array<{
    stage: string;
    severity: string;
    issue: string;
    recommendation: string;
  }>;
  generatedAt: string;
}

interface SystemCalibrationConfig {
  retrieval: Record<string, number>;
  ranking: Record<string, number>;
  chunking: Record<string, number>;
  relationships: Record<string, number>;
  compression: Record<string, number>;
  rendering: Record<string, number>;
}

interface TraceStageAnalysis {
  stage: string;
  latencyMs: number;
  status: string;
  score: number;
  summary: string;
}

interface FactOverrideRecord {
  factId: string;
  factScope: "global" | "domain";
  factKey: string;
  memoryId: string;
  chunkId: string;
  originalExcerpt: string;
  replacementText: string;
  precedenceRank: number;
  reason: string;
}

interface FactOverrideDiagnostics {
  overrideCount: number;
  overrides: FactOverrideRecord[];
  globalFactCount: number;
  domainFactCount: number;
  instructionCount: number;
  domainKey?: string;
  domainAction?: string;
}

interface FullTraceAnalysis {
  retrievalTraceId: string;
  query: string;
  stages: TraceStageAnalysis[];
  queryDiagnostics: { issues: string[] };
  retrievalDiagnostics: { issues: string[] };
  rankingDiagnostics: { issues: string[] };
  chunkDiagnostics: { issues: string[] };
  relationshipDiagnostics: { issues: string[] };
  compressionDiagnostics: { issues: string[] };
  renderingDiagnostics: { issues: string[] };
  factOverrideDiagnostics: FactOverrideDiagnostics;
}

const TABS: Array<{ id: TabId; label: string; code: string }> = [
  { id: "diagnostics", label: "Diagnostics Center", code: "DIAG.01" },
  { id: "calibration", label: "Calibration Panel", code: "DIAG.02" },
  { id: "trace", label: "Trace Explorer", code: "DIAG.03" },
  { id: "benchmark", label: "Benchmark Viewer", code: "DIAG.04" },
  { id: "signals", label: "Signal Quality", code: "DIAG.05" },
];

const METRIC_LABELS: Array<{ key: keyof RetrievalQualityMetrics; label: string }> = [
  { key: "retrievalPrecision", label: "Precision" },
  { key: "retrievalBreadth", label: "Breadth" },
  { key: "semanticCohesion", label: "Cohesion" },
  { key: "contextualDensity", label: "Density" },
  { key: "rankingStability", label: "Stability" },
  { key: "relationshipUsefulness", label: "Relationships" },
  { key: "chunkQuality", label: "Chunks" },
  { key: "tokenEfficiency", label: "Token Eff." },
  { key: "compressionIntegrity", label: "Compression" },
  { key: "renderingQuality", label: "Rendering" },
];

const CALIBRATION_SECTIONS: Array<{
  id: CalibrationSection;
  label: string;
  fields: Array<{ key: string; label: string; min: number; max: number; step: number }>;
}> = [
  {
    id: "retrieval",
    label: "Retrieval",
    fields: [
      { key: "semanticThreshold", label: "Semantic threshold", min: 0.45, max: 0.95, step: 0.01 },
      { key: "retrievalBreadth", label: "Retrieval breadth", min: 0.5, max: 2, step: 0.05 },
      { key: "topK", label: "Top-K (base)", min: 8, max: 150, step: 1 },
      { key: "precisionWeighting", label: "Precision weighting", min: 0.5, max: 2, step: 0.05 },
      { key: "breadthMultiplier", label: "Breadth multiplier", min: 0.5, max: 3, step: 0.05 },
      { key: "topKStrict", label: "Top-K strict", min: 10, max: 20, step: 1 },
      { key: "topKBalanced", label: "Top-K balanced", min: 20, max: 40, step: 1 },
      { key: "topKExploratory", label: "Top-K exploratory", min: 40, max: 80, step: 1 },
      { key: "topKCalibration", label: "Top-K calibration", min: 80, max: 150, step: 1 },
      { key: "expansionWeighting", label: "Expansion weighting", min: 0.5, max: 2, step: 0.05 },
    ],
  },
  {
    id: "ranking",
    label: "Ranking",
    fields: [
      { key: "recencyWeighting", label: "Recency", min: 0, max: 0.25, step: 0.01 },
      { key: "semanticDensityWeighting", label: "Semantic density", min: 0, max: 0.2, step: 0.01 },
      { key: "reinforcementWeighting", label: "Reinforcement", min: 0, max: 0.2, step: 0.01 },
      { key: "importanceWeighting", label: "Importance", min: 0, max: 0.25, step: 0.01 },
    ],
  },
  {
    id: "chunking",
    label: "Chunking",
    fields: [
      { key: "chunkSize", label: "Chunk size", min: 128, max: 1024, step: 32 },
      { key: "hierarchySensitivity", label: "Hierarchy sensitivity", min: 0, max: 1, step: 0.05 },
      { key: "adjacencyPreservation", label: "Adjacency preservation", min: 0, max: 1, step: 0.05 },
    ],
  },
  {
    id: "relationships",
    label: "Relationships",
    fields: [
      { key: "confidenceThreshold", label: "Confidence threshold", min: 0.3, max: 0.9, step: 0.01 },
      { key: "neighborLimit", label: "Neighbor limit", min: 0, max: 16, step: 1 },
      { key: "augmentationWeighting", label: "Augmentation weight", min: 0, max: 0.1, step: 0.005 },
    ],
  },
  {
    id: "compression",
    label: "Compression",
    fields: [
      { key: "fidelityAggressiveness", label: "Fidelity aggressiveness", min: 0, max: 1, step: 0.05 },
      { key: "mergeSensitivity", label: "Merge sensitivity", min: 0.5, max: 0.98, step: 0.01 },
      { key: "summarizationThreshold", label: "Summarization threshold", min: 0.5, max: 1, step: 0.05 },
    ],
  },
  {
    id: "rendering",
    label: "Rendering",
    fields: [
      { key: "hierarchyPreservation", label: "Hierarchy preservation", min: 0, max: 1, step: 0.05 },
      { key: "contextualGrouping", label: "Contextual grouping", min: 0, max: 1, step: 0.05 },
      { key: "deliveryDensity", label: "Delivery density", min: 0, max: 1, step: 0.05 },
    ],
  },
];

const THRESHOLD_MODES = [
  { value: "strict", label: "Strict — higher precision, lower breadth" },
  { value: "balanced", label: "Balanced — moderate precision and breadth" },
  { value: "exploratory", label: "Exploratory — broader candidate acceptance" },
  { value: "calibration", label: "Calibration — intentionally broad for diagnostics" },
] as const;

function severityVariant(severity: string): "default" | "success" | "warning" | "danger" {
  if (severity === "high") return "danger";
  if (severity === "medium") return "warning";
  return "default";
}

function metricTone(value: number): "neutral" | "good" | "warn" | "bad" {
  if (value >= 0.75) return "good";
  if (value >= 0.55) return "neutral";
  if (value >= 0.4) return "warn";
  return "bad";
}

export function RetrievalDiagnosticsPage() {
  const { traceId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get("tab") as TabId) ?? "diagnostics";

  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [traceInput, setTraceInput] = useState(traceId ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<RetrievalSystemReport | null>(null);
  const [summary, setSummary] = useState<{
    traceCount: number;
    averageMetrics: RetrievalQualityMetrics;
    problemFrequency: Record<string, number>;
    recentReports: RetrievalSystemReport[];
  } | null>(null);
  const [calibration, setCalibration] = useState<SystemCalibrationConfig | null>(null);
  const [calibrationSection, setCalibrationSection] = useState<CalibrationSection>("retrieval");
  const [draftValues, setDraftValues] = useState<Record<string, number>>({});
  const [savingCalibration, setSavingCalibration] = useState(false);
  const [traceAnalysis, setTraceAnalysis] = useState<FullTraceAnalysis | null>(null);
  const [signalQuality, setSignalQuality] = useState<{
    contextualDensity: number;
    semanticCohesion: number;
    relationshipUsefulness: number;
    tokenEfficiency: number;
    signalToNoiseRatio: number;
    semanticRichness?: number;
    operationalDensity?: number;
    contextualSpecificity?: number;
    retrievalAnchorQuality?: number;
  } | null>(null);
  const [breadthAnalysis, setBreadthAnalysis] = useState<{
    breadthScore: number;
    acceptedCount: number;
    rejectedCount: number;
    thresholdCutoff: number;
    collapseDetected: boolean;
    scoreHistogram: Array<{ minScore: number; maxScore: number; count: number; rejectedCount: number }>;
  } | null>(null);
  const [rejectionAnalysis, setRejectionAnalysis] = useState<{
    rejectedBelowThreshold: number;
    rejectedTokenBudget: number;
    rejectedDeduplication: number;
  } | null>(null);
  const [expansionAnalysis, setExpansionAnalysis] = useState<{
    enrichmentQuality: number;
    metadataUsefulness: number;
    expansionContribution: number;
  } | null>(null);
  const [thresholdMode, setThresholdMode] = useState<string>("balanced");
  const [benchmark, setBenchmark] = useState<{
    beforeMetrics: RetrievalQualityMetrics;
    afterMetrics: RetrievalQualityMetrics;
    metricDeltas: Partial<RetrievalQualityMetrics>;
    benchmarkTraceId?: string;
  } | null>(null);
  const [benchmarkRerunCompression, setBenchmarkRerunCompression] = useState(false);
  const [benchmarkRerunRendering, setBenchmarkRerunRendering] = useState(false);
  const [traceOptions, setTraceOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [exportingPdf, setExportingPdf] = useState(false);

  function selectReport(next: RetrievalSystemReport) {
    setReport(next);
    setTraceInput(next.retrievalTraceId);
  }

  useEffect(() => {
    apiGet<{ id: string }>("/workspaces/default")
      .then((w) => setWorkspaceId(w.id))
      .catch(() => setWorkspaceId(null));
  }, []);

  useEffect(() => {
    if (!workspaceId) return;
    if (activeTab === "diagnostics") void loadWorkspaceSummary();
    if (activeTab === "calibration") void loadCalibration();
  }, [activeTab, workspaceId]);

  useEffect(() => {
    if (!workspaceId) return;
    apiGet<{ traces: Array<{ retrievalTraceId: string; query: string; status: string }> }>(
      `/retrieval?limit=50&fields=retrievalTraceId,query,status`,
    )
      .then((data) => {
        setTraceOptions(
          data.traces
            .filter((t) => t.status === "completed")
            .map((t) => ({
              value: t.retrievalTraceId,
              label: `${t.query.slice(0, 55)}${t.query.length > 55 ? "…" : ""}`,
            })),
        );
      })
      .catch(() => setTraceOptions([]));
  }, [workspaceId]);

  useEffect(() => {
    if (traceId?.trim()) {
      setTraceInput(traceId);
      void loadReport(traceId.trim());
    }
  }, [traceId]);

  useEffect(() => {
    if (
      traceInput.trim() &&
      (activeTab === "trace" || activeTab === "signals" || activeTab === "diagnostics")
    ) {
      void loadTraceAnalysis(traceInput.trim());
    }
  }, [activeTab, traceInput]);

  useEffect(() => {
    if (calibration && calibrationSection) {
      setDraftValues(calibration[calibrationSection] ?? {});
      if (calibrationSection === "retrieval" && calibration.retrieval?.thresholdMode) {
        setThresholdMode(String(calibration.retrieval.thresholdMode));
      }
    }
  }, [calibration, calibrationSection]);

  async function loadReport(id: string) {
    setLoading(true);
    setError(null);
    try {
      const cached = summary?.recentReports.find((r) => r.retrievalTraceId === id);
      if (cached) {
        selectReport(cached);
        return;
      }
      const data = await apiGet<{ report: RetrievalSystemReport }>(`/diagnostics/report/${id}`);
      selectReport(data.report);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function loadWorkspaceSummary() {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<{ summary: NonNullable<typeof summary> }>(
        `/diagnostics/workspace?workspaceId=${workspaceId}&limit=30`,
      );
      setSummary(data.summary);

      const reports = data.summary.recentReports;
      if (reports.length === 0) return;

      const preferredId = traceId?.trim() || traceInput.trim();
      const preferred = preferredId
        ? reports.find((r) => r.retrievalTraceId === preferredId)
        : reports[0];

      if (preferred) {
        selectReport(preferred);
      } else if (preferredId) {
        await loadReport(preferredId);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function loadCalibration() {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<{ calibration: { config: SystemCalibrationConfig } }>(
        `/calibration?workspaceId=${workspaceId}`,
      );
      setCalibration(data.calibration.config);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function loadTraceAnalysis(id: string) {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<{
        analysis: FullTraceAnalysis;
        signalQuality: NonNullable<typeof signalQuality>;
        breadthAnalysis?: NonNullable<typeof breadthAnalysis>;
        rejectionAnalysis?: NonNullable<typeof rejectionAnalysis>;
        expansionAnalysis?: NonNullable<typeof expansionAnalysis>;
      }>(`/diagnostics/trace/${id}`);
      setTraceAnalysis(data.analysis);
      setSignalQuality(data.signalQuality);
      setBreadthAnalysis(data.breadthAnalysis ?? null);
      setRejectionAnalysis(data.rejectionAnalysis ?? null);
      setExpansionAnalysis(data.expansionAnalysis ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function saveCalibration() {
    if (!workspaceId) return;
    setSavingCalibration(true);
    setError(null);
    try {
      const data = await apiPatch<{ calibration: { config: SystemCalibrationConfig } }>(
        "/calibration",
        {
          workspaceId,
          section: calibrationSection,
          values: {
            ...draftValues,
            ...(calibrationSection === "retrieval" ? { thresholdMode } : {}),
          },
          ...(traceInput.trim() ? { benchmarkTraceId: traceInput.trim() } : {}),
        },
      );
      setCalibration(data.calibration.config);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingCalibration(false);
    }
  }

  async function exportFullReportPdf() {
    if (!report) return;
    setExportingPdf(true);
    setError(null);
    try {
      let analysis = traceAnalysis;
      let signals = signalQuality;

      if (!analysis || analysis.retrievalTraceId !== report.retrievalTraceId) {
        const data = await apiGet<{
          analysis: FullTraceAnalysis;
          signalQuality: NonNullable<typeof signalQuality>;
        }>(`/diagnostics/trace/${report.retrievalTraceId}`);
        analysis = data.analysis;
        signals = data.signalQuality;
        setTraceAnalysis(data.analysis);
        setSignalQuality(data.signalQuality);
      }

      exportRetrievalReportPdf({
        report,
        traceAnalysis: analysis,
        ...(signals ? { signalQuality: signals } : {}),
        ...(workspaceId ? { workspaceId } : {}),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setExportingPdf(false);
    }
  }

  async function runCalibrationBenchmark() {
    if (!workspaceId || !traceInput.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiPost<{ benchmark: typeof benchmark }>("/calibration/benchmark", {
        workspaceId,
        retrievalTraceId: traceInput.trim(),
        rerunRetrieval: true,
        rerunCompression: benchmarkRerunCompression,
        rerunRendering: benchmarkRerunRendering,
        calibrationOverrides: calibration ? { [calibrationSection]: draftValues } : undefined,
      });
      setBenchmark(data.benchmark);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  function setTab(tab: TabId) {
    setSearchParams({ tab });
  }

  const displayMetrics = report?.metrics ?? summary?.averageMetrics;
  const reportPickerOptions =
    traceOptions.length > 0
      ? traceOptions
      : (summary?.recentReports ?? []).map((r) => ({
          value: r.retrievalTraceId,
          label: `${r.query.slice(0, 55)}${r.query.length > 55 ? "…" : ""}`,
        }));

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="max-w-[1280px]">
      <motion.div variants={staggerItem}>
        <PageHeader
          code="DIAG.00"
          title="Retrieval Diagnostics & Calibration"
          lede="Operational signal engineering — measurable retrieval quality, trace inspection, and deterministic calibration controls."
        />
      </motion.div>

      <motion.div variants={staggerItem} className="mb-6 flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setTab(tab.id)}
            className={`rounded-md border px-3 py-1.5 font-metric text-[0.625rem] uppercase tracking-[0.06em] transition-colors ${
              activeTab === tab.id
                ? "border-[var(--color-accent)] bg-[var(--color-accent-muted)] text-[var(--color-text-primary)]"
                : "border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)]"
            }`}
          >
            {tab.code} · {tab.label}
          </button>
        ))}
      </motion.div>

      <motion.div variants={staggerItem} className="mb-6 flex flex-wrap items-end gap-3">
        <TextField
          label="Retrieval trace ID"
          value={traceInput}
          onChange={(e) => setTraceInput(e.target.value)}
          placeholder="ULID trace ID"
          className="min-w-[280px] flex-1"
        />
        <Button
          variant="secondary"
          onClick={() => traceInput.trim() && void loadReport(traceInput.trim())}
          disabled={loading || !traceInput.trim()}
        >
          Analyze trace
        </Button>
        {traceInput.trim() && (
          <Link
            to={`/retrieval-traces/${traceInput.trim()}`}
            className="text-xs text-[var(--color-accent)] no-underline hover:underline"
          >
            Open in observability →
          </Link>
        )}
      </motion.div>

      {error && (
        <motion.p variants={staggerItem} className="mb-4 text-sm text-[var(--color-danger)]">
          {error}
        </motion.p>
      )}

      {displayMetrics && (
        <motion.div variants={staggerItem} className="mb-6">
          <p className="mb-2 font-metric text-[0.625rem] uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
            {report ? "Selected trace metrics" : "Workspace average metrics"}
          </p>
          <MetricStrip>
            {METRIC_LABELS.map(({ key, label }) => (
              <MetricCell
                key={key}
                label={label}
                value={displayMetrics[key].toFixed(2)}
                accent={metricTone(displayMetrics[key]) === "good"}
              />
            ))}
          </MetricStrip>
        </motion.div>
      )}

      {activeTab === "diagnostics" && (
        <motion.div variants={staggerItem} className="space-y-6">
          <Panel title="Retrieval Quality Report" code="DIAG.01">
            <div className="mb-5 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
              {reportPickerOptions.length > 0 ? (
                <SelectField
                  label="Select retrieval trace"
                  value={traceInput}
                  onChange={(id) => {
                    setTraceInput(id);
                    const cached = summary?.recentReports.find((r) => r.retrievalTraceId === id);
                    if (cached) {
                      selectReport(cached);
                    } else {
                      void loadReport(id);
                    }
                  }}
                  options={reportPickerOptions}
                />
              ) : (
                <TextField
                  label="Retrieval trace ID"
                  value={traceInput}
                  onChange={(e) => setTraceInput(e.target.value)}
                  placeholder="ULID trace ID"
                />
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  onClick={() => traceInput.trim() && void loadReport(traceInput.trim())}
                  disabled={loading || !traceInput.trim()}
                >
                  {loading ? "Loading…" : "Refresh report"}
                </Button>
                {report && (
                  <Button onClick={() => void exportFullReportPdf()} disabled={exportingPdf}>
                    {exportingPdf ? "Exporting…" : "Export full report (PDF)"}
                  </Button>
                )}
                {traceInput.trim() && (
                  <Link
                    to={`/retrieval-traces/${traceInput.trim()}`}
                    className="inline-flex items-center text-xs text-[var(--color-accent)] no-underline hover:underline"
                  >
                    Open in observability →
                  </Link>
                )}
              </div>
            </div>

            {report ? (
              <div className="space-y-6">
                <div className="rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] p-4">
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">{report.query}</p>
                  <div className="mt-2 flex flex-wrap gap-3 font-metric text-[0.625rem] text-[var(--color-text-tertiary)]">
                    <span>Trace {report.retrievalTraceId.slice(0, 12)}…</span>
                    <span>Report {report.reportId.slice(0, 12)}…</span>
                    <span>{new Date(report.generatedAt).toLocaleString()}</span>
                  </div>
                </div>

                <div>
                  <h3 className="mb-3 font-metric text-[0.625rem] uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
                    Quality metrics
                  </h3>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                    {METRIC_LABELS.map(({ key, label }) => (
                      <div
                        key={key}
                        className="rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] px-3 py-2.5"
                      >
                        <span className="block font-metric text-[0.5625rem] uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
                          {label}
                        </span>
                        <span
                          className={`mt-0.5 block font-metric text-base font-semibold tabular-nums ${
                            metricTone(report.metrics[key]) === "bad"
                              ? "text-[var(--color-danger)]"
                              : metricTone(report.metrics[key]) === "warn"
                                ? "text-[var(--color-warning)]"
                                : "text-[var(--color-text-primary)]"
                          }`}
                        >
                          {report.metrics[key].toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {breadthAnalysis?.scoreHistogram?.length ? (
                  <ScoreHistogram
                    title="Retrieval score distribution (accepted vs rejected)"
                    buckets={breadthAnalysis.scoreHistogram}
                  />
                ) : null}

                <div>
                  <h3 className="mb-3 font-metric text-[0.625rem] uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
                    Detected problems ({report.detectedProblems.length})
                  </h3>
                  {report.detectedProblems.length === 0 ? (
                    <p className="text-sm text-[var(--color-success)]">No problems detected for this trace.</p>
                  ) : (
                    <ul className="space-y-3">
                      {report.detectedProblems.map((p, i) => (
                        <li
                          key={i}
                          className="rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] p-3"
                        >
                          <div className="mb-1 flex items-center gap-2">
                            <Badge variant={severityVariant(p.severity)}>{p.severity}</Badge>
                            <span className="font-metric text-[0.625rem] uppercase text-[var(--color-text-muted)]">
                              {p.stage.replace(/_/g, " ")}
                            </span>
                          </div>
                          <p className="text-sm text-[var(--color-text-primary)]">{p.issue}</p>
                          <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">{p.recommendation}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ) : loading ? (
              <p className="text-sm text-[var(--color-text-tertiary)]">Generating retrieval quality report…</p>
            ) : summary && summary.traceCount === 0 ? (
              <p className="text-sm text-[var(--color-text-tertiary)]">
                No completed retrieval traces with replay snapshots yet. Run a retrieval from{" "}
                <Link to="/retrieval-traces" className="text-[var(--color-accent)]">
                  Observability
                </Link>{" "}
                first.
              </p>
            ) : (
              <p className="text-sm text-[var(--color-text-tertiary)]">
                Select a trace above to view its retrieval quality report.
              </p>
            )}
          </Panel>

          <Panel title="Workspace Aggregates" code="DIAG.01b">
            {summary ? (
              <div className="space-y-4">
                <p className="font-metric text-xs text-[var(--color-text-secondary)]">
                  {summary.traceCount} traces analyzed · metrics above reflect{" "}
                  {report ? "the selected trace" : "workspace averages"}
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                  {Object.entries(summary.problemFrequency)
                    .filter(([, count]) => count > 0)
                    .map(([stage, count]) => (
                      <div
                        key={stage}
                        className="rounded-md border border-[var(--color-border-subtle)] px-3 py-2"
                      >
                        <span className="block font-metric text-[0.5625rem] uppercase text-[var(--color-text-muted)]">
                          {stage.replace(/_/g, " ")}
                        </span>
                        <span className="font-metric text-sm">{count}</span>
                      </div>
                    ))}
                </div>
                {summary.recentReports.length > 0 && (
                  <>
                    <h3 className="font-metric text-[0.625rem] uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
                      Recent reports
                    </h3>
                    <DataTable>
                      <DataTableHead>
                        <DataTableRow>
                          <DataTableHeaderCell>Query</DataTableHeaderCell>
                          <DataTableHeaderCell>Precision</DataTableHeaderCell>
                          <DataTableHeaderCell>Problems</DataTableHeaderCell>
                          <DataTableHeaderCell>Trace</DataTableHeaderCell>
                        </DataTableRow>
                      </DataTableHead>
                      <DataTableBody>
                        {summary.recentReports.map((r) => {
                          const isSelected = report?.retrievalTraceId === r.retrievalTraceId;
                          return (
                          <DataTableRow
                            key={r.reportId}
                            {...(isSelected ? { className: "bg-[var(--color-accent-muted)]/40" } : {})}
                          >
                            <DataTableCell>
                              <button
                                type="button"
                                className="text-left text-[var(--color-accent)] hover:underline"
                                onClick={() => selectReport(r)}
                              >
                                {r.query.slice(0, 48)}
                                {r.query.length > 48 ? "…" : ""}
                              </button>
                            </DataTableCell>
                            <DataTableCell>{r.metrics.retrievalPrecision.toFixed(2)}</DataTableCell>
                            <DataTableCell>{r.detectedProblems.length}</DataTableCell>
                            <DataTableCell className="font-metric text-xs text-[var(--color-text-muted)]">
                              {r.retrievalTraceId.slice(0, 10)}…
                            </DataTableCell>
                          </DataTableRow>
                          );
                        })}
                      </DataTableBody>
                    </DataTable>
                  </>
                )}
              </div>
            ) : (
              <p className="text-sm text-[var(--color-text-tertiary)]">
                {loading ? "Loading workspace diagnostics…" : "No workspace data yet."}
              </p>
            )}
          </Panel>
        </motion.div>
      )}

      {activeTab === "calibration" && calibration && (
        <motion.div variants={staggerItem} className="grid gap-6 lg:grid-cols-[220px_1fr]">
          <Panel title="Sections" code="DIAG.02">
            <div className="flex flex-col gap-1">
              {CALIBRATION_SECTIONS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setCalibrationSection(s.id)}
                  className={`rounded-md px-2.5 py-2 text-left text-sm ${
                    calibrationSection === s.id
                      ? "bg-[var(--color-accent-muted)] text-[var(--color-text-primary)]"
                      : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)]"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </Panel>

          <Panel
            title={`${CALIBRATION_SECTIONS.find((s) => s.id === calibrationSection)?.label ?? ""} Controls`}
            code="DIAG.02b"
          >
            <div className="grid gap-6 sm:grid-cols-2">
              {calibrationSection === "retrieval" && (
                <SelectField
                  label="Threshold mode"
                  value={thresholdMode}
                  onChange={setThresholdMode}
                  options={THRESHOLD_MODES.map((m) => ({ value: m.value, label: m.label }))}
                />
              )}
              {CALIBRATION_SECTIONS.find((s) => s.id === calibrationSection)?.fields.map((field) => (
                <RangeField
                  key={field.key}
                  label={field.label}
                  value={draftValues[field.key] ?? 0}
                  onChange={(v) => setDraftValues((prev) => ({ ...prev, [field.key]: v }))}
                  min={field.min}
                  max={field.max}
                  step={field.step}
                />
              ))}
            </div>
            <div className="mt-6 flex gap-3">
              <Button onClick={() => void saveCalibration()} disabled={savingCalibration}>
                {savingCalibration ? "Saving…" : "Apply calibration"}
              </Button>
              <p className="self-center text-xs text-[var(--color-text-tertiary)]">
                Changes are replayable, benchmarkable, and recorded in historian event log.
              </p>
            </div>
          </Panel>
        </motion.div>
      )}

      {activeTab === "trace" && traceAnalysis && (
        <motion.div variants={staggerItem}>
          <Panel title="Stage-by-Stage Trace" code="DIAG.03">
            <DataTable>
              <DataTableHead>
                <DataTableRow>
                  <DataTableHeaderCell>Stage</DataTableHeaderCell>
                  <DataTableHeaderCell>Status</DataTableHeaderCell>
                  <DataTableHeaderCell>Score</DataTableHeaderCell>
                  <DataTableHeaderCell>Latency</DataTableHeaderCell>
                  <DataTableHeaderCell>Summary</DataTableHeaderCell>
                </DataTableRow>
              </DataTableHead>
              <DataTableBody>
                {traceAnalysis.stages.map((stage) => (
                  <DataTableRow key={stage.stage}>
                    <DataTableCell className="font-metric text-xs uppercase">
                      {stage.stage.replace(/_/g, " ")}
                    </DataTableCell>
                    <DataTableCell>
                      <Badge variant={stage.status === "completed" ? "success" : "default"}>
                        {stage.status}
                      </Badge>
                    </DataTableCell>
                    <DataTableCell>{stage.score.toFixed(2)}</DataTableCell>
                    <DataTableCell>{stage.latencyMs}ms</DataTableCell>
                    <DataTableCell className="max-w-[320px] truncate text-sm">
                      {stage.summary}
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>

            {breadthAnalysis && activeTab === "trace" && (
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCell label="Breadth score" value={breadthAnalysis.breadthScore.toFixed(2)} />
                <MetricCell label="Accepted" value={String(breadthAnalysis.acceptedCount)} />
                <MetricCell label="Rejected" value={String(breadthAnalysis.rejectedCount)} />
                <MetricCell
                  label="Threshold cutoff"
                  value={breadthAnalysis.thresholdCutoff.toFixed(2)}
                />
              </div>
            )}

            {rejectionAnalysis && activeTab === "trace" && (
              <div className="mt-4 rounded-md border border-[var(--color-border-subtle)] p-3">
                <span className="font-metric text-[0.625rem] uppercase text-[var(--color-text-muted)]">
                  Candidate rejection analysis
                </span>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                  Below threshold: {rejectionAnalysis.rejectedBelowThreshold} · Token budget:{" "}
                  {rejectionAnalysis.rejectedTokenBudget} · Dedup:{" "}
                  {rejectionAnalysis.rejectedDeduplication}
                </p>
              </div>
            )}

            {expansionAnalysis && activeTab === "trace" && (
              <div className="mt-4 rounded-md border border-[var(--color-border-subtle)] p-3">
                <span className="font-metric text-[0.625rem] uppercase text-[var(--color-text-muted)]">
                  Metadata expansion analysis
                </span>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                  Enrichment: {expansionAnalysis.enrichmentQuality.toFixed(2)} · Usefulness:{" "}
                  {expansionAnalysis.metadataUsefulness.toFixed(2)} · Contribution:{" "}
                  {expansionAnalysis.expansionContribution.toFixed(2)}
                </p>
              </div>
            )}

            {traceAnalysis.factOverrideDiagnostics && activeTab === "trace" && (
              <div className="mt-6 rounded-md border border-[var(--color-border-subtle)] p-4">
                <span className="font-metric text-[0.625rem] uppercase text-[var(--color-text-muted)]">
                  Fact overrides (domain engine)
                </span>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <MetricCell
                    label="Overrides applied"
                    value={String(traceAnalysis.factOverrideDiagnostics.overrideCount)}
                  />
                  <MetricCell
                    label="Global facts"
                    value={String(traceAnalysis.factOverrideDiagnostics.globalFactCount)}
                  />
                  <MetricCell
                    label="Domain facts"
                    value={String(traceAnalysis.factOverrideDiagnostics.domainFactCount)}
                  />
                  <MetricCell
                    label="Instructions"
                    value={String(traceAnalysis.factOverrideDiagnostics.instructionCount)}
                  />
                </div>
                {traceAnalysis.factOverrideDiagnostics.domainKey && (
                  <p className="mt-2 text-xs text-[var(--color-text-tertiary)]">
                    Domain: {traceAnalysis.factOverrideDiagnostics.domainKey}
                    {traceAnalysis.factOverrideDiagnostics.domainAction
                      ? ` · action: ${traceAnalysis.factOverrideDiagnostics.domainAction}`
                      : ""}
                  </p>
                )}
                {traceAnalysis.factOverrideDiagnostics.overrides.length > 0 ? (
                  <DataTable className="mt-4">
                    <DataTableHead>
                      <DataTableRow>
                        <DataTableHeaderCell>Fact</DataTableHeaderCell>
                        <DataTableHeaderCell>Scope</DataTableHeaderCell>
                        <DataTableHeaderCell>Chunk</DataTableHeaderCell>
                        <DataTableHeaderCell>Reason</DataTableHeaderCell>
                      </DataTableRow>
                    </DataTableHead>
                    <DataTableBody>
                      {traceAnalysis.factOverrideDiagnostics.overrides.map((override) => (
                        <DataTableRow key={`${override.factId}-${override.chunkId}`}>
                          <DataTableCell className="font-metric text-xs">
                            {override.factKey}
                          </DataTableCell>
                          <DataTableCell>{override.factScope}</DataTableCell>
                          <DataTableCell className="max-w-[140px] truncate font-metric text-xs">
                            {override.chunkId.slice(0, 10)}…
                          </DataTableCell>
                          <DataTableCell className="max-w-[280px] text-xs text-[var(--color-text-secondary)]">
                            {override.reason}
                          </DataTableCell>
                        </DataTableRow>
                      ))}
                    </DataTableBody>
                  </DataTable>
                ) : (
                  <p className="mt-2 text-xs text-[var(--color-text-tertiary)]">
                    No chunk text replacements for this trace.
                  </p>
                )}
              </div>
            )}

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { label: "Query", issues: traceAnalysis.queryDiagnostics.issues },
                { label: "Retrieval", issues: traceAnalysis.retrievalDiagnostics.issues },
                { label: "Ranking", issues: traceAnalysis.rankingDiagnostics.issues },
                { label: "Chunks", issues: traceAnalysis.chunkDiagnostics.issues },
                { label: "Relationships", issues: traceAnalysis.relationshipDiagnostics.issues },
                { label: "Compression", issues: traceAnalysis.compressionDiagnostics.issues },
                { label: "Rendering", issues: traceAnalysis.renderingDiagnostics.issues },
              ].map((block) => (
                <div
                  key={block.label}
                  className="rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] p-3"
                >
                  <span className="font-metric text-[0.625rem] uppercase text-[var(--color-text-muted)]">
                    {block.label}
                  </span>
                  {block.issues.length === 0 ? (
                    <p className="mt-1 text-xs text-[var(--color-success)]">No issues</p>
                  ) : (
                    <ul className="mt-1 list-inside list-disc text-xs text-[var(--color-text-secondary)]">
                      {block.issues.map((issue, i) => (
                        <li key={i}>{issue}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </Panel>
        </motion.div>
      )}

      {activeTab === "benchmark" && (
        <motion.div variants={staggerItem}>
          <Panel title="Calibration Benchmark" code="DIAG.04">
            <div className="mb-4 flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={benchmarkRerunCompression}
                  onChange={(e) => setBenchmarkRerunCompression(e.target.checked)}
                />
                Re-run compression
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={benchmarkRerunRendering}
                  onChange={(e) => setBenchmarkRerunRendering(e.target.checked)}
                />
                Re-run rendering
              </label>
              <Button
                onClick={() => void runCalibrationBenchmark()}
                disabled={loading || !traceInput.trim() || !workspaceId}
              >
                Run benchmark replay
              </Button>
            </div>

            {benchmark ? (
              <DataTable>
                <DataTableHead>
                  <DataTableRow>
                    <DataTableHeaderCell>Metric</DataTableHeaderCell>
                    <DataTableHeaderCell>Before</DataTableHeaderCell>
                    <DataTableHeaderCell>After</DataTableHeaderCell>
                    <DataTableHeaderCell>Delta</DataTableHeaderCell>
                  </DataTableRow>
                </DataTableHead>
                <DataTableBody>
                  {METRIC_LABELS.map(({ key, label }) => (
                    <DataTableRow key={key}>
                      <DataTableCell>{label}</DataTableCell>
                      <DataTableCell>{benchmark.beforeMetrics[key].toFixed(3)}</DataTableCell>
                      <DataTableCell>{benchmark.afterMetrics[key].toFixed(3)}</DataTableCell>
                      <DataTableCell
                        className={
                          (benchmark.metricDeltas[key] ?? 0) >= 0
                            ? "text-[var(--color-success)]"
                            : "text-[var(--color-danger)]"
                        }
                      >
                        {(benchmark.metricDeltas[key] ?? 0) >= 0 ? "+" : ""}
                        {(benchmark.metricDeltas[key] ?? 0).toFixed(3)}
                      </DataTableCell>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
            ) : (
              <p className="text-sm text-[var(--color-text-tertiary)]">
                Replay a historical query against current calibration settings to compare before/after
                retrieval quality.
              </p>
            )}
          </Panel>
        </motion.div>
      )}

      {activeTab === "signals" && signalQuality && (
        <motion.div variants={staggerItem}>
          <Panel title="Signal Quality Viewer" code="DIAG.05">
            <MetricStrip columns={5}>
              <MetricCell
                label="Contextual density"
                value={signalQuality.contextualDensity.toFixed(2)}
                accent={metricTone(signalQuality.contextualDensity) === "good"}
              />
              <MetricCell
                label="Semantic cohesion"
                value={signalQuality.semanticCohesion.toFixed(2)}
                accent={metricTone(signalQuality.semanticCohesion) === "good"}
              />
              <MetricCell
                label="Token efficiency"
                value={signalQuality.tokenEfficiency.toFixed(3)}
                accent={metricTone(signalQuality.tokenEfficiency) === "good"}
              />
              <MetricCell
                label="Semantic richness"
                value={(signalQuality.semanticRichness ?? 0).toFixed(2)}
                accent={metricTone(signalQuality.semanticRichness ?? 0) === "good"}
              />
              <MetricCell
                label="Anchor quality"
                value={(signalQuality.retrievalAnchorQuality ?? 0).toFixed(2)}
                accent={metricTone(signalQuality.retrievalAnchorQuality ?? 0) === "good"}
              />
            </MetricStrip>
            <MetricStrip columns={4}>
              <MetricCell
                label="Operational density"
                value={(signalQuality.operationalDensity ?? 0).toFixed(2)}
              />
              <MetricCell
                label="Contextual specificity"
                value={(signalQuality.contextualSpecificity ?? 0).toFixed(2)}
              />
              <MetricCell
                label="Relationship usefulness"
                value={signalQuality.relationshipUsefulness.toFixed(2)}
              />
              <MetricCell
                label="Signal / noise"
                value={signalQuality.signalToNoiseRatio.toFixed(2)}
              />
            </MetricStrip>
            {breadthAnalysis && (
              <div className="mt-4 space-y-4">
                <div className="rounded-md border border-[var(--color-border-subtle)] p-3">
                  <span className="font-metric text-[0.625rem] uppercase text-[var(--color-text-muted)]">
                    Retrieval breadth
                  </span>
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                    Breadth {breadthAnalysis.breadthScore.toFixed(2)} · {breadthAnalysis.acceptedCount}{" "}
                    accepted / {breadthAnalysis.rejectedCount} rejected
                    {breadthAnalysis.collapseDetected ? " · collapse detected" : ""}
                  </p>
                </div>
                {breadthAnalysis.scoreHistogram?.length ? (
                  <ScoreHistogram
                    title="Candidate score histogram"
                    buckets={breadthAnalysis.scoreHistogram}
                  />
                ) : null}
              </div>
            )}
            {expansionAnalysis && (
              <div className="mt-4 rounded-md border border-[var(--color-border-subtle)] p-3">
                <span className="font-metric text-[0.625rem] uppercase text-[var(--color-text-muted)]">
                  Metadata expansion
                </span>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                  Enrichment {expansionAnalysis.enrichmentQuality.toFixed(2)} · Usefulness{" "}
                  {expansionAnalysis.metadataUsefulness.toFixed(2)} · Contribution{" "}
                  {expansionAnalysis.expansionContribution.toFixed(2)}
                </p>
              </div>
            )}
            <p className="mt-4 text-sm text-[var(--color-text-secondary)]">
              Signal quality measures contextual density and cohesion across the full pipeline —
              query through delivery. Low signal-to-noise indicates retrieval noise or compression
              fidelity loss.
            </p>
          </Panel>
        </motion.div>
      )}
    </motion.div>
  );
}
