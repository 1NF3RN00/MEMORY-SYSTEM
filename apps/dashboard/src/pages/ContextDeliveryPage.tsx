import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { apiGet, apiPost } from "../lib/api.js";
import { StatusPanel } from "../components/StatusPanel.js";
import { SelectField } from "../components/SelectField.js";
import { Button } from "../components/ui/Button.js";
import { PageHeader } from "../components/ui/PageHeader.js";
import { TextField } from "../components/ui/TextField.js";

type DeliveryMode = "concise" | "balanced" | "detailed" | "operational";

interface TraceSummary {
  deliveryId: string;
  workspaceId: string;
  retrievalTraceId: string;
  compressionTraceId?: string;
  status: string;
  mode: DeliveryMode;
  tokenCount?: number;
  createdAt: string;
  completedAt?: string;
}

interface StageRecord {
  stage: string;
  status: string;
  latencyMs?: number;
  metadata?: Record<string, unknown>;
}

interface GroupingDecision {
  groupId: string;
  groupLabel: string;
  groupingReason: string;
  memoryIds: string[];
  chunkIds: string[];
}

interface RenderingDecisions {
  grouping: GroupingDecision[];
  hierarchy: {
    preservedHeadings: string[];
    bulletGroups: number;
    hierarchyDepth: number;
  };
  traceStripping: {
    strippedFields: string[];
    removedTraceCount: number;
    removedDiagnosticCount: number;
  };
  deliveryOptimization: {
    redundancyRemoved: number;
    tokenDensityScore: number;
    readabilityScore: number;
  };
  deliveryMode: DeliveryMode;
}

interface TraceDetail {
  trace: {
    deliveryId: string;
    workspaceId: string;
    retrievalTraceId: string;
    compressionTraceId?: string;
    status: string;
    mode: DeliveryMode;
    stages: StageRecord[];
    originalContextPackage?: Record<string, unknown>;
    deliveryContext?: {
      renderedContext: string;
      renderedSections: Array<{
        title?: string;
        content: string;
        sourceMemoryIds: string[];
      }>;
      tokenCount: number;
    };
    renderingDecisions?: RenderingDecisions;
    error?: string;
    createdAt: string;
    completedAt?: string;
  };
}

interface ReplayView {
  diff: {
    rawMiddlewareSummary: string;
    renderedPreview: string;
    strippedFieldCount: number;
    tokenReductionEstimate: number;
  };
  renderingDecisions: RenderingDecisions;
}

interface CompareResult {
  comparison: {
    diffSummary: string;
    tokenCountA: number;
    tokenCountB: number;
    tokenDelta: number;
    strippedFields: string[];
  };
  traceA: { mode: DeliveryMode; renderedContext: string };
  traceB: { mode: DeliveryMode; renderedContext: string };
}

interface SourceOption {
  id: string;
  label: string;
  type: "retrieval" | "compression";
}

const DELIVERY_MODES: DeliveryMode[] = ["concise", "balanced", "detailed", "operational"];

function middlewarePreview(pkg: Record<string, unknown> | undefined): string {
  if (!pkg) return "No middleware package available.";
  const memories = (pkg.memories as Array<{ title: string; chunks: unknown[] }>) ?? [];
  const lines = [
    `Query: ${String(pkg.query ?? "")}`,
    `Memories: ${memories.length}`,
    `Chunk traces: ${((pkg.chunkTraces as unknown[]) ?? []).length}`,
    `Ranking breakdown: ${((pkg.rankingBreakdown as unknown[]) ?? []).length}`,
    `Rejected candidates: ${((pkg.rejectedCandidates as unknown[]) ?? []).length}`,
    "",
    "Memory titles:",
    ...memories.map((m) => `- ${m.title} (${m.chunks?.length ?? 0} chunks)`),
  ];
  return lines.join("\n");
}

export function ContextDeliveryPage() {
  const { deliveryId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [traces, setTraces] = useState<TraceSummary[]>([]);
  const [detail, setDetail] = useState<TraceDetail | null>(null);
  const [replay, setReplay] = useState<ReplayView | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sourceId, setSourceId] = useState(() => searchParams.get("retrievalTraceId") ?? "");
  const [sourceType, setSourceType] = useState<"retrieval" | "compression">("retrieval");
  const [mode, setMode] = useState<DeliveryMode>("balanced");
  const [submitting, setSubmitting] = useState(false);
  const [compareIdB, setCompareIdB] = useState("");
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);
  const [modePreview, setModePreview] = useState<DeliveryMode>("balanced");
  const [sources, setSources] = useState<SourceOption[]>([]);

  useEffect(() => {
    apiGet<{ id: string }>("/workspaces/default")
      .then((ws) => setWorkspaceId(ws.id))
      .catch(() => setWorkspaceId(null));
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);

    if (deliveryId) {
      Promise.all([
        apiGet<TraceDetail>(`/context/render/${deliveryId}`),
        apiGet<ReplayView>(`/context/render/${deliveryId}/replay`),
      ])
        .then(([traceData, replayData]) => {
          setDetail(traceData);
          setReplay(replayData);
          setModePreview(traceData.trace.mode);
        })
        .catch((e: Error) => setError(e.message))
        .finally(() => setLoading(false));
    } else {
      Promise.all([
        apiGet<{ traces: TraceSummary[] }>("/context/render?limit=50"),
        workspaceId
          ? apiGet<{
              traces: Array<{
                retrievalTraceId: string;
                query: string;
                status: string;
                hasContextPackage: boolean;
              }>;
            }>(`/retrieval?workspaceId=${workspaceId}&limit=30&fields=retrievalTraceId,query,status,hasContextPackage`)
          : Promise.resolve({ traces: [] }),
        workspaceId
          ? apiGet<{
              traces: Array<{
                compressionTraceId: string;
                retrievalTraceId: string;
                status: string;
              }>;
            }>(`/compression?workspaceId=${workspaceId}&limit=30&fields=compressionTraceId,retrievalTraceId,status`)
          : Promise.resolve({ traces: [] }),
      ])
        .then(([renderData, retrievalData, compressionData]) => {
          setTraces(renderData.traces);
          const retrievalSources: SourceOption[] = retrievalData.traces
            .filter((t) => t.status === "completed" && t.hasContextPackage)
            .map((t) => ({
              id: t.retrievalTraceId,
              label: `${t.query.slice(0, 60)}… (${t.retrievalTraceId.slice(0, 8)})`,
              type: "retrieval" as const,
            }));
          const compressionSources: SourceOption[] = compressionData.traces
            .filter((t) => t.status === "completed")
            .map((t) => ({
              id: t.compressionTraceId,
              label: `Compression ${t.compressionTraceId.slice(0, 8)} → ${t.retrievalTraceId.slice(0, 8)}`,
              type: "compression" as const,
            }));
          setSources([...compressionSources, ...retrievalSources]);
        })
        .catch((e: Error) => setError(e.message))
        .finally(() => setLoading(false));
    }
  }, [deliveryId, workspaceId]);

  async function handleRender(e: FormEvent) {
    e.preventDefault();
    if (!workspaceId || !sourceId.trim()) return;

    setSubmitting(true);
    setError(null);
    try {
      const body =
        sourceType === "compression"
          ? { workspaceId, compressionTraceId: sourceId.trim(), mode }
          : { workspaceId, retrievalTraceId: sourceId.trim(), mode };

      const result = await apiPost<{ deliveryId: string }>("/context/render", body);
      navigate(`/context-delivery/${result.deliveryId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCompare() {
    if (!deliveryId || !compareIdB.trim()) return;
    setError(null);
    try {
      const result = await apiPost<CompareResult>("/context/render/compare", {
        deliveryIdA: deliveryId,
        deliveryIdB: compareIdB.trim(),
      });
      setCompareResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  if (loading) {
    return <StatusPanel title="Loading context delivery data…" loading />;
  }

  if (error && !deliveryId) {
    return <StatusPanel title="Context Delivery" description={error} />;
  }

  if (!deliveryId) {
    return (
      <div className="page">
        <PageHeader
          code="CTX.08"
          title="Context Delivery Viewer"
          lede="Transform operational middleware state into clean, semantically optimized inference context — separate from replay and diagnostics."
        />

        <section className="panel panel--form">
          <h2>Render Context</h2>
          <p className="muted">
            Rendering consumes a completed retrieval or compression package and produces LLM-facing
            delivery context. Operational traces, ranking internals, and diagnostics are stripped.
          </p>
          <form onSubmit={handleRender} className="form-grid">
            {sources.length > 0 && (
              <SelectField
                className="full-width"
                label="Source package"
                value={sourceId}
                onChange={(value) => {
                  setSourceId(value);
                  const match = sources.find((s) => s.id === value);
                  if (match) setSourceType(match.type);
                }}
                options={[
                  { value: "", label: "Select a source…" },
                  ...sources.map((s) => ({ value: s.id, label: s.label })),
                ]}
              />
            )}
            <TextField
              className="full-width"
              label={sourceType === "compression" ? "Compression trace ID" : "Retrieval trace ID"}
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
              placeholder="Paste trace ID"
            />
            <SelectField
              label="Delivery mode"
              value={mode}
              onChange={(v) => setMode(v as DeliveryMode)}
              options={DELIVERY_MODES.map((m) => ({ value: m, label: m }))}
            />
            <div className="form-actions">
              <Button type="submit" disabled={submitting || !workspaceId || !sourceId.trim()}>
                {submitting ? "Rendering…" : "Render context"}
              </Button>
            </div>
          </form>
        </section>

        <section className="panel">
          <h2>Recent deliveries</h2>
          {traces.length === 0 ? (
            <p className="muted">No context deliveries yet.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Delivery ID</th>
                  <th>Mode</th>
                  <th>Tokens</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {traces.map((t) => (
                  <tr key={t.deliveryId}>
                    <td>
                      <Link to={`/context-delivery/${t.deliveryId}`}>
                        {t.deliveryId.slice(0, 12)}…
                      </Link>
                    </td>
                    <td>{t.mode}</td>
                    <td>{t.tokenCount ?? "—"}</td>
                    <td>{t.status}</td>
                    <td>{new Date(t.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    );
  }

  const trace = detail?.trace;
  const decisions = trace?.renderingDecisions ?? replay?.renderingDecisions;

  return (
    <div className="page">
      <PageHeader
        code="CTX.08"
        title="Context Delivery Inspector"
        lede={`Delivery ${deliveryId?.slice(0, 12)}… — operational middleware state transformed for downstream inference.`}
      />

      {error && <p className="error-banner">{error}</p>}

      <div className="grid-2">
        <section className="panel">
          <h2>Raw retrieval package</h2>
          <p className="muted">Operational middleware state — not for LLM delivery.</p>
          <pre className="code-block code-block--scroll">
            {middlewarePreview(trace?.originalContextPackage)}
          </pre>
        </section>

        <section className="panel">
          <h2>Rendered delivery context</h2>
          <p className="muted">
            Mode: <strong>{trace?.mode}</strong> · {trace?.deliveryContext?.tokenCount ?? 0} tokens
          </p>
          <pre className="code-block code-block--scroll">
            {trace?.deliveryContext?.renderedContext || "No rendered context."}
          </pre>
        </section>
      </div>

      <section className="panel">
        <h2>Rendering Inspector</h2>
        {decisions ? (
          <div className="grid-2">
            <div>
              <h3>Grouping logic</h3>
              <ul className="detail-list">
                {decisions.grouping.map((g) => (
                  <li key={g.groupId}>
                    <strong>{g.groupLabel}</strong> ({g.groupingReason}) — {g.memoryIds.length}{" "}
                    memories, {g.chunkIds.length} chunks
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3>Hierarchy formatting</h3>
              <ul className="detail-list">
                <li>Headings preserved: {decisions.hierarchy.preservedHeadings.length}</li>
                <li>Bullet groups: {decisions.hierarchy.bulletGroups}</li>
                <li>Hierarchy depth: {decisions.hierarchy.hierarchyDepth}</li>
              </ul>
              <h3>Trace stripping</h3>
              <ul className="detail-list">
                <li>Removed traces: {decisions.traceStripping.removedTraceCount}</li>
                <li>Removed diagnostics: {decisions.traceStripping.removedDiagnosticCount}</li>
                <li>Stripped fields: {decisions.traceStripping.strippedFields.join(", ")}</li>
              </ul>
              <h3>Token optimization</h3>
              <ul className="detail-list">
                <li>Redundancy removed: {decisions.deliveryOptimization.redundancyRemoved} lines</li>
                <li>Token density: {decisions.deliveryOptimization.tokenDensityScore.toFixed(2)}</li>
                <li>Readability: {decisions.deliveryOptimization.readabilityScore.toFixed(2)}</li>
              </ul>
            </div>
          </div>
        ) : (
          <p className="muted">Rendering decisions unavailable.</p>
        )}
      </section>

      <section className="panel">
        <h2>Delivery Mode Viewer</h2>
        <SelectField
          label="Preview mode profile"
          value={modePreview}
          onChange={(v) => setModePreview(v as DeliveryMode)}
          options={DELIVERY_MODES.map((m) => ({ value: m, label: m }))}
        />
        <p className="muted">
          {modePreview === "concise" && "Highest density, lowest redundancy, minimal formatting."}
          {modePreview === "balanced" && "Clean hierarchy, moderate detail, strong readability."}
          {modePreview === "detailed" && "Richer context, expanded hierarchy, broader inclusion."}
          {modePreview === "operational" &&
            "Infrastructure-focused formatting with explicit operational grouping."}
          {trace?.mode !== modePreview &&
            " — Re-render with this mode to generate a new delivery package."}
        </p>
        <p>
          Current delivery mode: <strong>{trace?.mode}</strong>
        </p>
      </section>

      <section className="panel">
        <h2>Context Diff Viewer</h2>
        {replay?.diff ? (
          <div className="grid-2">
            <div>
              <h3>Middleware summary</h3>
              <pre className="code-block code-block--scroll">{replay.diff.rawMiddlewareSummary}</pre>
            </div>
            <div>
              <h3>Inference context</h3>
              <pre className="code-block code-block--scroll">{replay.diff.renderedPreview}</pre>
              <p className="muted">
                Stripped {replay.diff.strippedFieldCount} operational field groups · Estimated token
                reduction: ~{replay.diff.tokenReductionEstimate}
              </p>
            </div>
          </div>
        ) : (
          <p className="muted">Diff unavailable.</p>
        )}
      </section>

      <section className="panel">
        <h2>Compare deliveries</h2>
        <div className="form-inline">
          <TextField
            label="Compare with delivery ID"
            value={compareIdB}
            onChange={(e) => setCompareIdB(e.target.value)}
            placeholder="Other delivery ID"
          />
          <Button type="button" onClick={handleCompare} disabled={!compareIdB.trim()}>
            Compare
          </Button>
        </div>
        {compareResult && (
          <div className="grid-2" style={{ marginTop: "1rem" }}>
            <pre className="code-block">{compareResult.comparison.diffSummary}</pre>
            <div>
              <h3>Mode A ({compareResult.traceA.mode})</h3>
              <pre className="code-block code-block--scroll">
                {compareResult.traceA.renderedContext.slice(0, 1200)}
                {compareResult.traceA.renderedContext.length > 1200 ? "…" : ""}
              </pre>
              <h3>Mode B ({compareResult.traceB.mode})</h3>
              <pre className="code-block code-block--scroll">
                {compareResult.traceB.renderedContext.slice(0, 1200)}
                {compareResult.traceB.renderedContext.length > 1200 ? "…" : ""}
              </pre>
            </div>
          </div>
        )}
      </section>

      {trace?.stages && trace.stages.length > 0 && (
        <section className="panel">
          <h2>Pipeline stages</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>Stage</th>
                <th>Status</th>
                <th>Latency</th>
              </tr>
            </thead>
            <tbody>
              {trace.stages.map((s, i) => (
                <tr key={`${s.stage}-${i}`}>
                  <td>{s.stage}</td>
                  <td>{s.status}</td>
                  <td>{s.latencyMs != null ? `${s.latencyMs}ms` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <p>
        <Link to="/context-delivery">← All context deliveries</Link>
      </p>
    </div>
  );
}
