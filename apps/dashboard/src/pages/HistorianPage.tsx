import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { apiDelete, apiGet, apiPost } from "../lib/api.js";
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
import { RetrievalTimeline } from "../components/observability/RetrievalTimeline.js";
import { staggerContainer, staggerItem } from "../design-system/motion.js";

type TabId = "replay" | "diagnostics" | "benchmark" | "compression" | "memory";

interface ReplayStage {
  stage: string;
  inputs: unknown;
  outputs: unknown;
  latencyMs: number;
  timestamp: string;
}

interface ReplaySnapshotSummary {
  replayId: string;
  retrievalTraceId: string;
  originalQuery: string;
  replayTimestamp: string;
  integrityHash: string;
}

interface ReplayResponse {
  replay: {
    replayId: string;
    retrievalTraceId: string;
    mode: string;
    integrityValid: boolean;
    reconstructedStages: ReplayStage[];
    replayedAt: string;
    snapshot: ReplaySnapshotSummary & {
      stages: ReplayStage[];
      contextPackage?: {
        tokenBudget: { maxTokens: number; usedTokens: number; trimmedTokens: number };
        retrievalMetadata: { finalChunkCount: number };
      };
      compressionArtifacts?: Array<{
        compressionTraceId: string;
        mergeDecisions: unknown[];
        trimmingDecisions: unknown[];
        fidelityReport?: { fidelityScore: number; compressionAggressiveness: number };
      }>;
    };
  };
}

interface DriftSignal {
  signalType: string;
  severity: string;
  retrievalTraceId?: string;
  detail: string;
  observedValue: number;
  baselineValue: number;
}

interface BenchmarkComparison {
  benchmarkId: string;
  rankingComparison: Array<{
    chunkId: string;
    memoryId: string;
    originalRank: number | null;
    benchmarkRank: number | null;
    rankDelta: number | null;
  }>;
  tokenEfficiency: {
    originalUsedTokens: number;
    benchmarkUsedTokens: number;
    tokenDelta: number;
  };
  chunkingComparison: {
    originalChunkCount: number;
    benchmarkChunkCount: number;
  };
}

const TABS: Array<{ id: TabId; label: string; code: string }> = [
  { id: "replay", label: "Replay Timeline", code: "HIST.01" },
  { id: "diagnostics", label: "Diagnostics Center", code: "HIST.02" },
  { id: "benchmark", label: "Benchmark Viewer", code: "HIST.03" },
  { id: "compression", label: "Compression Replay", code: "HIST.04" },
  { id: "memory", label: "Memory Timeline", code: "HIST.05" },
];

export function HistorianPage() {
  const { traceId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get("tab") as TabId) ?? "replay";

  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [traceInput, setTraceInput] = useState(traceId ?? "");
  const [memoryInput, setMemoryInput] = useState("");
  const [replay, setReplay] = useState<ReplayResponse["replay"] | null>(null);
  const [driftSignals, setDriftSignals] = useState<DriftSignal[]>([]);
  const [tokenInflation, setTokenInflation] = useState<
    Array<{ retrievalTraceId: string; query: string; inflationRatio: number }>
  >([]);
  const [diagnostics, setDiagnostics] = useState<{
    failedRetrievals: Array<{ retrievalTraceId: string; query: string; error?: string }>;
    lowConfidenceRetrievals: Array<{ retrievalTraceId: string; query: string; topScore: number }>;
    tokenWaste: Array<{ retrievalTraceId: string; trimmedTokens: number }>;
  } | null>(null);
  const [benchmark, setBenchmark] = useState<BenchmarkComparison | null>(null);
  const [memoryTimeline, setMemoryTimeline] = useState<{
    reinforcementProgression: Array<{ timestamp: string; reinforcementScore: number }>;
    decayProgression: Array<{ timestamp: string; recencyScore: number }>;
    retrievalFrequency: Array<{ retrievalTraceId: string; query: string; rank: number | null }>;
  } | null>(null);
  const [snapshots, setSnapshots] = useState<ReplaySnapshotSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [benchmarkRerunRetrieval, setBenchmarkRerunRetrieval] = useState(true);
  const [benchmarkRerunCompression, setBenchmarkRerunCompression] = useState(false);

  useEffect(() => {
    apiGet<{ workspaces: Array<{ id: string }> }>("/workspaces")
      .then((data) => {
        if (data.workspaces[0]) setWorkspaceId(data.workspaces[0].id);
      })
      .catch(() => setWorkspaceId(null));
  }, []);

  useEffect(() => {
    if (traceId) setTraceInput(traceId);
  }, [traceId]);

  useEffect(() => {
    if (!workspaceId) return;
    apiGet<{ snapshots: ReplaySnapshotSummary[] }>(
      `/historian/snapshots?workspaceId=${workspaceId}&limit=30`,
    )
      .then((data) => setSnapshots(data.snapshots))
      .catch(() => setSnapshots([]));
  }, [workspaceId, replay]);

  async function loadReplay(id = traceInput) {
    if (!id.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<ReplayResponse>(`/replay/${id.trim()}?mode=exact`);
      setReplay(data.replay);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setReplay(null);
    } finally {
      setLoading(false);
    }
  }

  async function loadDiagnostics() {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      const [drift, inflation, ops] = await Promise.all([
        apiGet<{ report: { signals: DriftSignal[] } }>(
          `/diagnostics/drift?workspaceId=${workspaceId}`,
        ),
        apiGet<{
          report: {
            entries: Array<{ retrievalTraceId: string; query: string; inflationRatio: number }>;
          };
        }>(`/diagnostics/token-inflation?workspaceId=${workspaceId}`),
        apiGet<{
          report: {
            failedRetrievals: Array<{ retrievalTraceId: string; query: string; error?: string }>;
            lowConfidenceRetrievals: Array<{
              retrievalTraceId: string;
              query: string;
              topScore: number;
            }>;
            tokenWaste: Array<{ retrievalTraceId: string; trimmedTokens: number }>;
          };
        }>(`/diagnostics/operational?workspaceId=${workspaceId}`),
      ]);
      setDriftSignals(drift.report.signals);
      setTokenInflation(inflation.report.entries);
      setDiagnostics(ops.report);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function runBenchmark() {
    if (!workspaceId || !traceInput.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiPost<{ comparison: BenchmarkComparison }>("/replay/benchmark", {
        workspaceId,
        retrievalTraceId: traceInput.trim(),
        rerunRetrieval: benchmarkRerunRetrieval,
        rerunCompression: benchmarkRerunCompression,
      });
      setBenchmark(data.comparison);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function loadMemoryTimeline() {
    if (!memoryInput.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<{
        timeline: {
          reinforcementProgression: Array<{ timestamp: string; reinforcementScore: number }>;
          decayProgression: Array<{ timestamp: string; recencyScore: number }>;
          retrievalFrequency: Array<{
            retrievalTraceId: string;
            query: string;
            rank: number | null;
          }>;
        };
      }>(`/history/${memoryInput.trim()}`);
      setMemoryTimeline(data.timeline);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function permanentDelete(id: string) {
    if (!window.confirm(`Permanently delete history ${id}? This cannot be undone.`)) return;
    setLoading(true);
    setError(null);
    try {
      await apiDelete(`/history/${id}/permanent`);
      setReplay(null);
      if (workspaceId) {
        const data = await apiGet<{ snapshots: ReplaySnapshotSummary[] }>(
          `/historian/snapshots?workspaceId=${workspaceId}`,
        );
        setSnapshots(data.snapshots);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (traceId && activeTab === "replay") void loadReplay(traceId);
    if (activeTab === "diagnostics" && workspaceId) void loadDiagnostics();
  }, [activeTab, workspaceId, traceId]);

  function setTab(tab: TabId) {
    setSearchParams({ tab });
  }

  const timelineStages =
    replay?.reconstructedStages.map((s) => ({
      stage: s.stage,
      status: "completed" as const,
      startedAt: s.timestamp,
      completedAt: s.timestamp,
      latencyMs: s.latencyMs,
    })) ?? [];

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="max-w-[1200px]">
      <motion.div variants={staggerItem}>
        <PageHeader
          code="HIST.00"
          title="Operational Historian"
          lede="Deterministic replay, drift detection, benchmark comparisons, and retention management."
        />
      </motion.div>

      <motion.div variants={staggerItem} className="mb-6 flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setTab(tab.id)}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? "border-[var(--color-accent)] bg-[var(--color-accent-muted)] text-[var(--color-text-primary)]"
                : "border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)]"
            }`}
          >
            {tab.code} · {tab.label}
          </button>
        ))}
      </motion.div>

      {error && (
        <motion.div variants={staggerItem} className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </motion.div>
      )}

      {(activeTab === "replay" || activeTab === "benchmark" || activeTab === "compression") && (
        <motion.div variants={staggerItem} className="mb-6 flex flex-wrap items-end gap-3">
          <TextField
            label="Retrieval Trace ID"
            value={traceInput}
            onChange={(e) => setTraceInput(e.target.value)}
            placeholder="ULID trace ID"
          />
          {activeTab === "replay" && (
            <Button onClick={() => loadReplay()} disabled={loading}>
              Replay Trace
            </Button>
          )}
          {activeTab === "benchmark" && (
            <>
              <label className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                <input
                  type="checkbox"
                  checked={benchmarkRerunRetrieval}
                  onChange={(e) => setBenchmarkRerunRetrieval(e.target.checked)}
                />
                Re-run retrieval
              </label>
              <label className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                <input
                  type="checkbox"
                  checked={benchmarkRerunCompression}
                  onChange={(e) => setBenchmarkRerunCompression(e.target.checked)}
                />
                Re-run compression
              </label>
              <Button onClick={() => runBenchmark()} disabled={loading}>
                Run Benchmark
              </Button>
            </>
          )}
        </motion.div>
      )}

      {activeTab === "memory" && (
        <motion.div variants={staggerItem} className="mb-6 flex flex-wrap items-end gap-3">
          <TextField
            label="Memory ID"
            value={memoryInput}
            onChange={(e) => setMemoryInput(e.target.value)}
            placeholder="Memory ULID"
          />
          <Button onClick={() => loadMemoryTimeline()} disabled={loading}>
            Load Timeline
          </Button>
        </motion.div>
      )}

      {activeTab === "replay" && replay && (
        <>
          <motion.div variants={staggerItem} className="mb-6">
            <MetricStrip columns={4}>
              <MetricCell label="Replay ID" value={replay.replayId.slice(0, 12)} accent />
              <MetricCell
                label="Integrity"
                value={replay.integrityValid ? "Valid" : "Invalid"}
              />
              <MetricCell
                label="Stages"
                value={String(replay.reconstructedStages.length)}
              />
              <MetricCell
                label="Final Chunks"
                value={String(
                  replay.snapshot.contextPackage?.retrievalMetadata.finalChunkCount ?? 0,
                )}
              />
            </MetricStrip>
          </motion.div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <motion.div variants={staggerItem}>
              <Panel code="HIST.01" title="Stage-by-Stage Replay" description="Deterministic reconstruction from stored snapshot.">
                <RetrievalTimeline stages={timelineStages} />
              </Panel>
            </motion.div>

            <motion.div variants={staggerItem}>
              <Panel code="HIST.01b" title="Replay Controls" description="Retention and permanent deletion.">
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => loadReplay(replay.retrievalTraceId)}
                    disabled={loading}
                  >
                    Refresh Replay
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => permanentDelete(replay.retrievalTraceId)}
                    disabled={loading}
                  >
                    Permanent Delete
                  </Button>
                  <Link
                    to={`/retrieval-traces/${replay.retrievalTraceId}`}
                    className="inline-flex items-center rounded-md border border-[var(--color-border-default)] px-3 py-2 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)]"
                  >
                    Open Retrieval Trace
                  </Link>
                </div>
              </Panel>
            </motion.div>
          </div>

          <motion.div variants={staggerItem} className="mt-4">
            <Panel code="HIST.01c" title="Stored Snapshots" description="Full contextual packages preserved for replay fidelity.">
              <DataTable>
                <DataTableHead>
                  <DataTableRow>
                    <DataTableHeaderCell>Query</DataTableHeaderCell>
                    <DataTableHeaderCell>Trace</DataTableHeaderCell>
                    <DataTableHeaderCell>Captured</DataTableHeaderCell>
                    <DataTableHeaderCell>Action</DataTableHeaderCell>
                  </DataTableRow>
                </DataTableHead>
                <DataTableBody>
                  {snapshots.map((s) => (
                    <DataTableRow key={s.replayId}>
                      <DataTableCell>{s.originalQuery.slice(0, 48)}</DataTableCell>
                      <DataTableCell className="font-mono text-xs">{s.retrievalTraceId.slice(0, 14)}…</DataTableCell>
                      <DataTableCell>{new Date(s.replayTimestamp).toLocaleString()}</DataTableCell>
                      <DataTableCell>
                        <button
                          type="button"
                          className="text-xs text-[var(--color-accent)]"
                          onClick={() => {
                            setTraceInput(s.retrievalTraceId);
                            void loadReplay(s.retrievalTraceId);
                          }}
                        >
                          Replay
                        </button>
                      </DataTableCell>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
            </Panel>
          </motion.div>
        </>
      )}

      {activeTab === "diagnostics" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <motion.div variants={staggerItem}>
            <Panel code="HIST.02a" title="Drift Signals" description="Ranking instability, token inflation, compression aggressiveness.">
              <Button variant="secondary" className="mb-3" onClick={() => loadDiagnostics()} disabled={loading}>
                Refresh Diagnostics
              </Button>
              {driftSignals.length === 0 ? (
                <p className="text-sm text-[var(--color-text-tertiary)]">No drift signals detected.</p>
              ) : (
                <div className="space-y-2">
                  {driftSignals.map((s, i) => (
                    <div key={i} className="rounded-md border border-[var(--color-border-subtle)] p-3 text-sm">
                      <div className="mb-1 flex items-center gap-2">
                        <Badge variant={s.severity === "high" ? "danger" : "warning"}>{s.signalType}</Badge>
                        <span className="text-[var(--color-text-tertiary)]">{s.severity}</span>
                      </div>
                      <p className="text-[var(--color-text-secondary)]">{s.detail}</p>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </motion.div>

          <motion.div variants={staggerItem}>
            <Panel code="HIST.02b" title="Token Inflation" description="Traces exceeding baseline token usage.">
              {tokenInflation.length === 0 ? (
                <p className="text-sm text-[var(--color-text-tertiary)]">No inflation entries.</p>
              ) : (
                <DataTable>
                  <DataTableHead>
                    <DataTableRow>
                      <DataTableHeaderCell>Query</DataTableHeaderCell>
                      <DataTableHeaderCell>Ratio</DataTableHeaderCell>
                    </DataTableRow>
                  </DataTableHead>
                  <DataTableBody>
                    {tokenInflation.slice(0, 10).map((e) => (
                      <DataTableRow key={e.retrievalTraceId}>
                        <DataTableCell>{e.query.slice(0, 40)}</DataTableCell>
                        <DataTableCell>{e.inflationRatio.toFixed(2)}×</DataTableCell>
                      </DataTableRow>
                    ))}
                  </DataTableBody>
                </DataTable>
              )}
            </Panel>
          </motion.div>

          {diagnostics && (
            <>
              <motion.div variants={staggerItem}>
                <Panel code="HIST.02c" title="Failed Retrievals">
                  <DiagnosticList
                    items={diagnostics.failedRetrievals.map((f) => ({
                      id: f.retrievalTraceId,
                      primary: f.query,
                      secondary: f.error ?? "Unknown error",
                    }))}
                  />
                </Panel>
              </motion.div>
              <motion.div variants={staggerItem}>
                <Panel code="HIST.02d" title="Low Confidence Retrievals">
                  <DiagnosticList
                    items={diagnostics.lowConfidenceRetrievals.map((f) => ({
                      id: f.retrievalTraceId,
                      primary: f.query,
                      secondary: `Top score: ${f.topScore.toFixed(3)}`,
                    }))}
                  />
                </Panel>
              </motion.div>
            </>
          )}
        </div>
      )}

      {activeTab === "benchmark" && benchmark && (
        <motion.div variants={staggerItem}>
          <Panel code="HIST.03" title="Benchmark Comparison" description="Historical vs re-run retrieval/compression.">
            <MetricStrip columns={3} className="mb-4">
              <MetricCell label="Token Δ" value={String(benchmark.tokenEfficiency.tokenDelta)} accent />
              <MetricCell
                label="Chunk Δ"
                value={String(benchmark.chunkingComparison.benchmarkChunkCount - benchmark.chunkingComparison.originalChunkCount)}
              />
              <MetricCell
                label="Rank Changes"
                value={String(
                  benchmark.rankingComparison.filter(
                    (r) => r.rankDelta !== null && r.rankDelta !== 0,
                  ).length,
                )}
              />
            </MetricStrip>
            <DataTable>
              <DataTableHead>
                <DataTableRow>
                  <DataTableHeaderCell>Chunk</DataTableHeaderCell>
                  <DataTableHeaderCell>Orig Rank</DataTableHeaderCell>
                  <DataTableHeaderCell>Bench Rank</DataTableHeaderCell>
                  <DataTableHeaderCell>Δ</DataTableHeaderCell>
                </DataTableRow>
              </DataTableHead>
              <DataTableBody>
                {benchmark.rankingComparison.slice(0, 20).map((r) => (
                  <DataTableRow key={r.chunkId}>
                    <DataTableCell className="font-mono text-xs">{r.chunkId.slice(0, 12)}…</DataTableCell>
                    <DataTableCell>{r.originalRank ?? "—"}</DataTableCell>
                    <DataTableCell>{r.benchmarkRank ?? "—"}</DataTableCell>
                    <DataTableCell>{r.rankDelta ?? "—"}</DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          </Panel>
        </motion.div>
      )}

      {activeTab === "compression" && replay?.snapshot.compressionArtifacts?.length ? (
        replay.snapshot.compressionArtifacts.map((artifact, idx) => (
          <motion.div key={artifact.compressionTraceId} variants={staggerItem} className="mb-4">
            <Panel
              code={`HIST.04.${idx + 1}`}
              title="Compression Replay"
              description="Merge decisions, trimming decisions, fidelity impacts."
            >
              <MetricStrip columns={3} className="mb-4">
                <MetricCell
                  label="Fidelity"
                  value={artifact.fidelityReport?.fidelityScore?.toFixed(3) ?? "—"}
                  accent
                />
                <MetricCell
                  label="Merges"
                  value={String(artifact.mergeDecisions.length)}
                />
                <MetricCell
                  label="Trims"
                  value={String(artifact.trimmingDecisions.length)}
                />
              </MetricStrip>
              <p className="text-sm text-[var(--color-text-secondary)]">
                Aggressiveness:{" "}
                {artifact.fidelityReport?.compressionAggressiveness?.toFixed(3) ?? "n/a"}
              </p>
            </Panel>
          </motion.div>
        ))
      ) : activeTab === "compression" ? (
        <motion.div variants={staggerItem}>
          <Panel code="HIST.04" title="Compression Replay">
            <p className="text-sm text-[var(--color-text-tertiary)]">
              Load a replay with compression artifacts using a retrieval trace ID above.
            </p>
            <Button className="mt-3" onClick={() => loadReplay()} disabled={loading || !traceInput}>
              Load Compression Replay
            </Button>
          </Panel>
        </motion.div>
      ) : null}

      {activeTab === "memory" && memoryTimeline && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <motion.div variants={staggerItem}>
            <Panel code="HIST.05a" title="Reinforcement Progression">
              <TimelineList
                items={memoryTimeline.reinforcementProgression.map((e) => ({
                  timestamp: e.timestamp,
                  value: `Score ${e.reinforcementScore.toFixed(3)}`,
                }))}
              />
            </Panel>
          </motion.div>
          <motion.div variants={staggerItem}>
            <Panel code="HIST.05b" title="Retrieval Frequency">
              <TimelineList
                items={memoryTimeline.retrievalFrequency.map((e) => ({
                  timestamp: e.retrievalTraceId,
                  value: `${e.query.slice(0, 40)} · rank ${e.rank ?? "—"}`,
                }))}
              />
            </Panel>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}

function DiagnosticList({
  items,
}: {
  items: Array<{ id: string; primary: string; secondary: string }>;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-[var(--color-text-tertiary)]">None detected.</p>;
  }
  return (
    <div className="space-y-2">
      {items.slice(0, 8).map((item) => (
        <div key={item.id} className="rounded-md border border-[var(--color-border-subtle)] p-2 text-sm">
          <p className="text-[var(--color-text-primary)]">{item.primary}</p>
          <p className="text-xs text-[var(--color-text-tertiary)]">{item.secondary}</p>
        </div>
      ))}
    </div>
  );
}

function TimelineList({
  items,
}: {
  items: Array<{ timestamp: string; value: string }>;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-[var(--color-text-tertiary)]">No history recorded.</p>;
  }
  return (
    <div className="space-y-2">
      {items.slice(0, 12).map((item, i) => (
        <div key={i} className="flex justify-between gap-4 text-sm">
          <span className="truncate text-[var(--color-text-secondary)]">{item.value}</span>
          <span className="shrink-0 font-mono text-xs text-[var(--color-text-muted)]">
            {item.timestamp.slice(0, 10)}
          </span>
        </div>
      ))}
    </div>
  );
}
