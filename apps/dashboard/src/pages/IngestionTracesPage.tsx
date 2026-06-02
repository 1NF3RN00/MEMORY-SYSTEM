import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiGet } from "../lib/api.js";
import { StatusPanel } from "../components/StatusPanel.js";
import { PageHeader } from "../components/ui/PageHeader.js";

interface TraceSummary {
  traceId: string;
  workspaceId: string;
  memoryId: string | null;
  status: string;
  sourceType: string;
  createdAt: string;
  updatedAt: string;
}

interface StageRecord {
  stage: string;
  status: string;
  startedAt?: string;
  completedAt?: string;
  latencyMs?: number;
  error?: string;
}

interface TraceDetail {
  trace: {
    traceId: string;
    status: string;
    sourceType: string;
    persistenceMode: string;
    memoryId?: string;
    stages: StageRecord[];
    normalizationTrace?: {
      strategy: string;
      usedLlm: boolean;
      steps: Array<{ step: string; timestamp: string }>;
    };
    createdAt: string;
    updatedAt: string;
  };
  sourceTruth: {
    rawSource: string;
    crawlerOutput?: Record<string, unknown>;
    normalizationTransformations: Array<{ step: string }>;
  } | null;
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

export function IngestionTracesPage() {
  const { traceId } = useParams();
  const [traces, setTraces] = useState<TraceSummary[]>([]);
  const [detail, setDetail] = useState<TraceDetail | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError(null);

    if (traceId) {
      Promise.all([
        apiGet<TraceDetail>(`/ingestion/${traceId}`),
        apiGet<{ events: EventItem[] }>(`/events/${traceId}`),
      ])
        .then(([traceData, eventData]) => {
          setDetail(traceData);
          setEvents(eventData.events);
        })
        .catch((e: Error) => setError(e.message))
        .finally(() => setLoading(false));
    } else {
      apiGet<{ traces: TraceSummary[] }>("/ingestion?limit=50")
        .then((data) => setTraces(data.traces))
        .catch((e: Error) => setError(e.message))
        .finally(() => setLoading(false));
    }
  }, [traceId]);

  if (loading) {
    return <StatusPanel title="Loading ingestion data…" loading />;
  }

  if (error) {
    return <StatusPanel title="Ingestion observability" description={error} />;
  }

  if (!traceId) {
    return (
      <div className="page">
        <PageHeader
          code="PIPE.02"
          title="Ingestion Trace Viewer"
          lede="Replayable ingestion stages, latencies, and failures."
        />
        <section className="panel">
        <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Trace</th>
              <th>Status</th>
              <th>Source</th>
              <th>Memory</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {traces.map((t) => (
              <tr key={t.traceId}>
                <td>
                  <Link to={`/ingestion/${t.traceId}`}>{t.traceId.slice(0, 10)}…</Link>
                </td>
                <td>
                  <span className={`badge badge-${t.status}`}>{t.status}</span>
                </td>
                <td>{t.sourceType}</td>
                <td>
                  {t.memoryId ? (
                    <Link to={`/memory/${t.memoryId}`}>{t.memoryId.slice(0, 10)}…</Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td>{new Date(t.updatedAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        </section>
      </div>
    );
  }

  if (!detail) {
    return <StatusPanel title="Trace not found" />;
  }

  const { trace, sourceTruth } = detail;

  return (
    <div className="page">
      <h1>Ingestion Trace</h1>
      <p className="muted">
        <code>{trace.traceId}</code> · {trace.sourceType} · {trace.persistenceMode}
      </p>

      <section className="panel">
        <h2>Stages</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Stage</th>
              <th>Status</th>
              <th>Latency</th>
              <th>Error</th>
            </tr>
          </thead>
          <tbody>
            {trace.stages.map((s, i) => (
              <tr key={`${s.stage}-${i}`}>
                <td>{s.stage}</td>
                <td>{s.status}</td>
                <td>{s.latencyMs != null ? `${s.latencyMs} ms` : "—"}</td>
                <td>{s.error ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {trace.normalizationTrace && (
        <section className="panel">
          <h2>Normalization Trace</h2>
          <p>
            Strategy: <strong>{trace.normalizationTrace.strategy}</strong> · LLM:{" "}
            {trace.normalizationTrace.usedLlm ? "yes" : "no"}
          </p>
          <ul>
            {trace.normalizationTrace.steps.map((step) => (
              <li key={step.step}>
                {step.step} — {new Date(step.timestamp).toLocaleTimeString()}
              </li>
            ))}
          </ul>
        </section>
      )}

      {sourceTruth && (
        <section className="panel">
          <h2>Source Truth (inspect only)</h2>
          <p className="muted">Raw source preserved for replay — not used in retrieval.</p>
          <pre className="code-block">{sourceTruth.rawSource.slice(0, 2000)}</pre>
          {sourceTruth.crawlerOutput && (
            <details>
              <summary>Crawler output</summary>
              <pre className="code-block">
                {JSON.stringify(sourceTruth.crawlerOutput, null, 2)}
              </pre>
            </details>
          )}
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

      {trace.memoryId && (
        <p>
          <Link to={`/memory/${trace.memoryId}`}>Open memory explorer →</Link>
        </p>
      )}
    </div>
  );
}
