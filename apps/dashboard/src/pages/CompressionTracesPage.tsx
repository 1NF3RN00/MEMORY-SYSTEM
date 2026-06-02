import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { apiGet, apiPost } from "../lib/api.js";
import { StatusPanel } from "../components/StatusPanel.js";
import { SelectField } from "../components/SelectField.js";
import { Button } from "../components/ui/Button.js";
import { PageHeader } from "../components/ui/PageHeader.js";
import { RangeField } from "../components/ui/RangeField.js";
import { TextField } from "../components/ui/TextField.js";

type FidelityMode = "maximum_fidelity" | "balanced" | "aggressive";

interface TraceSummary {
  compressionTraceId: string;
  workspaceId: string;
  retrievalTraceId: string;
  status: string;
  fidelityMode: FidelityMode;
  createdAt: string;
  completedAt?: string;
}

interface StageRecord {
  stage: string;
  status: string;
  latencyMs?: number;
  metadata?: Record<string, unknown>;
  error?: string;
}

interface StageTrace {
  compressionStage: string;
  affectedChunks: string[];
  tokenSavings: number;
  fidelityImpact: string;
  compressionReason: string;
  rankingPreservation: boolean;
  llmUsed: boolean;
}

interface FidelityReport {
  fidelityScore: number;
  nuancePreservationScore: number;
  compressionAggressiveness: number;
  retrievalQualityScore: number;
  contextualPreservationScore: number;
  validationPassed: boolean;
  issues: string[];
  rankingPreservationRatio: number;
  chunkRetentionRatio: number;
}

interface MergeDecision {
  mergedChunkIds: string[];
  resultChunkId: string;
  overlapScore: number;
  preservedRank: number;
  reason: string;
}

interface TrimmingDecision {
  chunkId: string;
  memoryId: string;
  rankingRank: number;
  finalScore: number;
  tokenCount: number;
  reason: string;
}

interface CompressionMetadata {
  originalTokens: number;
  optimizedTokens: number;
  tokenSavings: number;
  fidelityScore: number;
  abstractionUsed: boolean;
  fidelityMode: FidelityMode;
  nuancePreservation: number;
  tokenOptimization: number;
}

interface TraceDetail {
  trace: {
    compressionTraceId: string;
    workspaceId: string;
    retrievalTraceId: string;
    status: string;
    fidelityMode: FidelityMode;
    nuancePreservation: number;
    tokenOptimization: number;
    targetTokenBudget?: number;
    stages: StageRecord[];
    stageTraces: StageTrace[];
    fidelityReport?: FidelityReport;
    mergeDecisions?: MergeDecision[];
    trimmingDecisions?: TrimmingDecision[];
    optimizedContextPackage?: {
      compressionMetadata: CompressionMetadata;
      memories: Array<{ memoryId: string; title: string; chunks: Array<{ chunkId: string }> }>;
    };
    originalContextPackage?: {
      tokenBudget: { usedTokens: number };
      memories: Array<{ memoryId: string; title: string }>;
    };
    error?: string;
    createdAt: string;
    completedAt?: string;
  };
}

interface EventItem {
  eventId: string;
  eventType: string;
  timestamp: string;
  success: boolean;
  latencyMs?: number;
}

interface RelationshipView {
  memoryId: string;
  relationships: Array<{
    sourceMemoryId: string;
    targetMemoryId: string;
    relationshipType: string;
    weight: number;
  }>;
  adjacencyHints: Array<{
    chunkId: string;
    adjacentChunkId: string;
    hintType: string;
    weight: number;
  }>;
}

interface RetrievalTraceOption {
  retrievalTraceId: string;
  query: string;
  status: string;
  hasContextPackage: boolean;
  createdAt: string;
}

function llmFacingPackage(pkg: Record<string, unknown>): Record<string, unknown> {
  const {
    compressionMetadata: _meta,
    compressionTraceId: _trace,
    sourceRetrievalTraceId: _source,
    ...rest
  } = pkg;
  return rest;
}

export function CompressionTracesPage() {
  const { traceId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [traces, setTraces] = useState<TraceSummary[]>([]);
  const [retrievalTraces, setRetrievalTraces] = useState<RetrievalTraceOption[]>([]);
  const [detail, setDetail] = useState<TraceDetail | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [relationships, setRelationships] = useState<RelationshipView | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrievalTraceId, setRetrievalTraceId] = useState(
    () => searchParams.get("retrievalTraceId") ?? "",
  );
  const [targetTokenBudget, setTargetTokenBudget] = useState(2048);
  const [fidelityMode, setFidelityMode] = useState<FidelityMode>("maximum_fidelity");
  const [nuancePreservation, setNuancePreservation] = useState(0.85);
  const [tokenOptimization, setTokenOptimization] = useState(0.3);
  const [submitting, setSubmitting] = useState(false);

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
        apiGet<TraceDetail>(`/compression/${traceId}`),
        apiGet<{ events: EventItem[] }>(`/events/${traceId}`),
      ])
        .then(async ([traceData, eventData]) => {
          setDetail(traceData);
          setEvents(eventData.events);

          const firstMemory =
            traceData.trace.optimizedContextPackage?.memories[0]?.memoryId ??
            traceData.trace.originalContextPackage?.memories[0]?.memoryId;

          if (firstMemory) {
            const rel = await apiGet<RelationshipView>(
              `/relationships/${firstMemory}?workspaceId=${traceData.trace.workspaceId}`,
            );
            setRelationships(rel);
          }
        })
        .catch((e: Error) => setError(e.message))
        .finally(() => setLoading(false));
    } else {
      Promise.all([
        apiGet<{ traces: TraceSummary[] }>("/compression?limit=50"),
        workspaceId
          ? apiGet<{ traces: RetrievalTraceOption[] }>(
              `/retrieval?workspaceId=${workspaceId}&limit=30`,
            )
          : Promise.resolve({ traces: [] }),
      ])
        .then(([compressionData, retrievalData]) => {
          setTraces(compressionData.traces);
          setRetrievalTraces(
            retrievalData.traces.filter(
              (t) => t.status === "completed" && t.hasContextPackage,
            ),
          );
        })
        .catch((e: Error) => setError(e.message))
        .finally(() => setLoading(false));
    }
  }, [traceId, workspaceId]);

  useEffect(() => {
    const id = retrievalTraceId.trim();
    if (!id) return;

    apiGet<{
      trace: { contextPackage?: { tokenBudget: { usedTokens: number } } };
    }>(`/retrieval/${id}`)
      .then((data) => {
        const used = data.trace.contextPackage?.tokenBudget.usedTokens;
        if (used && used > 0) {
          setTargetTokenBudget(Math.max(64, Math.floor(used * 0.85)));
        }
      })
      .catch(() => {
        /* manual ID entry — keep current target */
      });
  }, [retrievalTraceId]);

  async function handleCompress(e: FormEvent) {
    e.preventDefault();
    if (!workspaceId || !retrievalTraceId.trim()) return;

    setSubmitting(true);
    setError(null);
    try {
      const result = await apiPost<{ compressionTraceId: string }>("/compress", {
        workspaceId,
        retrievalTraceId: retrievalTraceId.trim(),
        targetTokenBudget,
        fidelityMode,
        nuancePreservation,
        tokenOptimization,
      });
      navigate(`/compression-traces/${result.compressionTraceId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <StatusPanel title="Loading compression data…" loading />;
  }

  if (error && !traceId) {
    return <StatusPanel title="Compression observability" description={error} />;
  }

  if (!traceId) {
    return (
      <div className="page">
        <PageHeader
          code="CTX.05"
          title="Compression Trace Viewer"
          lede="Retrieval-aware contextual optimization — dedupe, merge, trim, abstract only when necessary."
        />

        <section className="panel panel--form">
          <h2>Run Compression</h2>
          <p className="muted">
            Compression is a separate step after retrieval. Paste the{" "}
            <strong>retrieval trace ID</strong> from a completed retrieval — not a compression
            trace ID. Or pick one from the list below.
          </p>
          <form onSubmit={handleCompress} className="form-grid">
            {retrievalTraces.length > 0 && (
              <SelectField
                className="full-width"
                label="Pick a completed retrieval"
                value={retrievalTraceId}
                onChange={setRetrievalTraceId}
                options={[
                  { value: "", label: "Select retrieval trace…" },
                  ...retrievalTraces.map((t) => ({
                    value: t.retrievalTraceId,
                    label: `${t.query.slice(0, 50)}${t.query.length > 50 ? "…" : ""} · ${t.retrievalTraceId.slice(0, 10)}…`,
                  })),
                ]}
              />
            )}
            <TextField
              className="full-width"
              label="Retrieval trace ID"
              value={retrievalTraceId}
              onChange={(e) => setRetrievalTraceId(e.target.value)}
              placeholder="ULID from Retrieval Traces (not Compression Traces)"
              required
            />
            <TextField
              label="Target token budget"
              type="number"
              min={64}
              value={targetTokenBudget}
              onChange={(e) => setTargetTokenBudget(Number(e.target.value))}
              hint="Must be below the retrieval's used tokens. Auto-filled when you pick a retrieval."
            />
            <SelectField
              label="Fidelity mode"
              value={fidelityMode}
              onChange={(v) => setFidelityMode(v as FidelityMode)}
              options={[
                { value: "maximum_fidelity", label: "Maximum fidelity" },
                { value: "balanced", label: "Balanced" },
                { value: "aggressive", label: "Aggressive" },
              ]}
            />
            <RangeField
              label="Nuance preservation"
              value={nuancePreservation}
              onChange={setNuancePreservation}
            />
            <RangeField
              label="Token optimization"
              value={tokenOptimization}
              onChange={setTokenOptimization}
            />
            <div className="form-actions full-width">
              <Button type="submit" disabled={submitting || !workspaceId} loading={submitting}>
                Compress context package
              </Button>
            </div>
          </form>
          {error && <p className="error-text">{error}</p>}
        </section>

        <section className="panel">
          <h2>Recent Compressions</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>Trace</th>
                <th>Retrieval</th>
                <th>Fidelity</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {traces.map((t) => (
                <tr key={t.compressionTraceId}>
                  <td>
                    <Link to={`/compression-traces/${t.compressionTraceId}`}>
                      {t.compressionTraceId.slice(0, 10)}…
                    </Link>
                  </td>
                  <td>
                    <Link to={`/retrieval-traces/${t.retrievalTraceId}`}>
                      {t.retrievalTraceId.slice(0, 10)}…
                    </Link>
                  </td>
                  <td>{t.fidelityMode}</td>
                  <td>
                    <span className={`badge badge-${t.status}`}>{t.status}</span>
                  </td>
                  <td>{new Date(t.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    );
  }

  if (!detail?.trace) {
    return (
      <StatusPanel title="Trace not found" {...(error ? { description: error } : {})} />
    );
  }

  const { trace } = detail;
  const meta = trace.optimizedContextPackage?.compressionMetadata;
  const fidelity = trace.fidelityReport;

  return (
    <div className="page">
      <h1>Compression Trace</h1>
      <p className="muted">
        <code>{trace.compressionTraceId}</code> · {trace.fidelityMode} · {trace.status}
      </p>
      <p>
        Source retrieval:{" "}
        <Link to={`/retrieval-traces/${trace.retrievalTraceId}`}>
          {trace.retrievalTraceId}
        </Link>
      </p>

      <section className="panel">
        <h2>Fidelity Controls (applied)</h2>
        <ul>
          <li>Mode: {trace.fidelityMode}</li>
          <li>Nuance preservation: {trace.nuancePreservation.toFixed(2)}</li>
          <li>Token optimization: {trace.tokenOptimization.toFixed(2)}</li>
          {trace.targetTokenBudget != null && (
            <li>Target budget: {trace.targetTokenBudget} tokens</li>
          )}
        </ul>
      </section>

      <section className="panel">
        <h2>Compression Stages</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Stage</th>
              <th>Status</th>
              <th>Latency</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {trace.stages.map((s, i) => (
              <tr key={`${s.stage}-${i}`}>
                <td>{s.stage}</td>
                <td>{s.status}</td>
                <td>{s.latencyMs != null ? `${s.latencyMs} ms` : "—"}</td>
                <td>
                  {s.metadata ? (
                    <code>{JSON.stringify(s.metadata)}</code>
                  ) : (
                    (s.error ?? "—")
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {trace.stageTraces.length > 0 && (
        <section className="panel">
          <h2>Stage Traces</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>Stage</th>
                <th>Token savings</th>
                <th>Fidelity impact</th>
                <th>Reason</th>
                <th>LLM</th>
              </tr>
            </thead>
            <tbody>
              {trace.stageTraces.map((s, i) => (
                <tr key={`${s.compressionStage}-${i}`}>
                  <td>{s.compressionStage}</td>
                  <td>{s.tokenSavings}</td>
                  <td>{s.fidelityImpact}</td>
                  <td>{s.compressionReason}</td>
                  <td>{s.llmUsed ? "yes" : "no"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {meta && (
        <section className="panel">
          <h2>Token Optimization Viewer</h2>
          <ul>
            <li>Original tokens: {meta.originalTokens}</li>
            <li>Optimized tokens: {meta.optimizedTokens}</li>
            <li>Token savings: {meta.tokenSavings}</li>
            <li>
              Effectiveness:{" "}
              {meta.originalTokens > 0
                ? `${((meta.tokenSavings / meta.originalTokens) * 100).toFixed(1)}% reduction`
                : "—"}
            </li>
            <li>Abstraction used: {meta.abstractionUsed ? "yes" : "no"}</li>
          </ul>
        </section>
      )}

      {fidelity && (
        <section className="panel">
          <h2>Fidelity Inspector</h2>
          <ul>
            <li>
              Validation:{" "}
              <span className={fidelity.validationPassed ? "badge badge-completed" : "badge badge-failed"}>
                {fidelity.validationPassed ? "passed" : "flagged"}
              </span>
            </li>
            <li>Fidelity score: {fidelity.fidelityScore.toFixed(3)}</li>
            <li>Nuance preservation: {fidelity.nuancePreservationScore.toFixed(3)}</li>
            <li>Compression aggressiveness: {fidelity.compressionAggressiveness.toFixed(3)}</li>
            <li>Retrieval quality: {fidelity.retrievalQualityScore.toFixed(3)}</li>
            <li>Contextual preservation: {fidelity.contextualPreservationScore.toFixed(3)}</li>
            <li>Chunk retention: {(fidelity.chunkRetentionRatio * 100).toFixed(0)}%</li>
            <li>Ranking preservation: {(fidelity.rankingPreservationRatio * 100).toFixed(0)}%</li>
          </ul>
          {fidelity.issues.length > 0 && (
            <>
              <h3>Issues</h3>
              <ul>
                {fidelity.issues.map((issue, i) => (
                  <li key={i}>{issue}</li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {trace.mergeDecisions && trace.mergeDecisions.length > 0 && (
        <section className="panel">
          <h2>Merge Inspector</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>Chunks merged</th>
                <th>Result</th>
                <th>Overlap</th>
                <th>Preserved rank</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {trace.mergeDecisions.map((m, i) => (
                <tr key={i}>
                  <td>{m.mergedChunkIds.join(", ")}</td>
                  <td>{m.resultChunkId}</td>
                  <td>{m.overlapScore.toFixed(3)}</td>
                  <td>{m.preservedRank}</td>
                  <td>{m.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {trace.trimmingDecisions && trace.trimmingDecisions.length > 0 && (
        <section className="panel">
          <h2>Trimming Decisions</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>Chunk</th>
                <th>Rank</th>
                <th>Score</th>
                <th>Tokens</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {trace.trimmingDecisions.map((t, i) => (
                <tr key={i}>
                  <td>
                    <Link to={`/memory/${t.memoryId}`}>{t.chunkId.slice(0, 10)}…</Link>
                  </td>
                  <td>{t.rankingRank}</td>
                  <td>{t.finalScore.toFixed(3)}</td>
                  <td>{t.tokenCount}</td>
                  <td>{t.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {relationships && (
        <section className="panel">
          <h2>Relationship Viewer</h2>
          <p className="muted">Memory {relationships.memoryId.slice(0, 12)}…</p>
          {relationships.relationships.length === 0 ? (
            <p className="muted">No stored relationships yet.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Source</th>
                  <th>Target</th>
                  <th>Weight</th>
                </tr>
              </thead>
              <tbody>
                {relationships.relationships.map((r, i) => (
                  <tr key={i}>
                    <td>{r.relationshipType}</td>
                    <td>
                      <Link to={`/memory/${r.sourceMemoryId}`}>
                        {r.sourceMemoryId.slice(0, 10)}…
                      </Link>
                    </td>
                    <td>
                      <Link to={`/memory/${r.targetMemoryId}`}>
                        {r.targetMemoryId.slice(0, 10)}…
                      </Link>
                    </td>
                    <td>{r.weight.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {relationships.adjacencyHints.length > 0 && (
            <>
              <h3>Adjacency hints</h3>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Chunk</th>
                    <th>Adjacent</th>
                    <th>Type</th>
                    <th>Weight</th>
                  </tr>
                </thead>
                <tbody>
                  {relationships.adjacencyHints.map((h, i) => (
                    <tr key={i}>
                      <td>{h.chunkId.slice(0, 10)}…</td>
                      <td>{h.adjacentChunkId.slice(0, 10)}…</td>
                      <td>{h.hintType}</td>
                      <td>{h.weight.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </section>
      )}

      {trace.error && (
        <section className="panel">
          <p className="error-text">{trace.error}</p>
        </section>
      )}

      {trace.optimizedContextPackage && (
        <section className="panel">
          <h2>LLM Context Package (JSON)</h2>
          <p className="muted">
            Context for downstream LLM execution — excludes compression trace metadata. Compare
            character size to the full trace JSON below.
          </p>
          <pre className="code-block">
            {JSON.stringify(
              llmFacingPackage(trace.optimizedContextPackage as Record<string, unknown>),
              null,
              2,
            )}
          </pre>
        </section>
      )}

      {trace.optimizedContextPackage && (
        <section className="panel">
          <h2>Full Compression Record (JSON)</h2>
          <p className="muted">
            Includes compressionMetadata, stage traces, and preprocessing — this is why the full
            optimized package JSON is often longer even when content tokens shrink.
          </p>
          <pre className="code-block">
            {JSON.stringify(trace.optimizedContextPackage, null, 2)}
          </pre>
        </section>
      )}

      {trace.originalContextPackage && (
        <section className="panel">
          <h2>Original Context Package (JSON)</h2>
          <p className="muted">Retrieved context before compression.</p>
          <pre className="code-block">
            {JSON.stringify(trace.originalContextPackage, null, 2)}
          </pre>
        </section>
      )}

      <section className="panel">
        <h2>Event Timeline</h2>
        <ul className="event-list">
          {events.map((e) => (
            <li key={e.eventId} className={e.success ? "" : "event-failed"}>
              <span className="event-type">{e.eventType}</span>
              <span className="muted">{new Date(e.timestamp).toLocaleString()}</span>
              {e.latencyMs != null && <span>{e.latencyMs} ms</span>}
            </li>
          ))}
        </ul>
      </section>

      <p>
        <Link to="/compression-traces">← All compression traces</Link>
      </p>
    </div>
  );
}
