import { useCallback, useEffect, useState } from "react";
import { fetchDashboard, loadConfig, type PerfDashboard } from "../api/perf";

export function HomePage() {
  const { wave, token } = loadConfig();
  const [data, setData] = useState<PerfDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!token) {
      setError("Add your trigger token in Setup");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setData(await fetchDashboard(wave, token));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [wave, token]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 30_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  const latest = data?.latestSprint;

  return (
    <>
      <div className="card">
        <h2>Live status</h2>
        {loading && !data ? <p className="muted">Loading…</p> : null}
        {error ? <p className="badge err">{error}</p> : null}
        {data ? (
          <>
            <p>
              Wave context: <strong>{wave}</strong>{" "}
              {data.stale ? (
                <span className="badge warn">stale — check PC</span>
              ) : (
                <span className="badge ok">active</span>
              )}
            </p>
            <p className="muted">Updated {new Date(data.generatedAt).toLocaleTimeString()}</p>
          </>
        ) : null}
        <button type="button" onClick={() => void refresh()} style={{ marginTop: 8 }}>
          Refresh
        </button>
      </div>

      {latest ? (
        <div className="card">
          <h2>{latest.sprint}</h2>
          <p className="muted">{latest.logFile}</p>
          <p>
            {latest.finished ? (
              <span className="badge ok">SDK finished</span>
            ) : latest.stale ? (
              <span className="badge warn">No log activity {Math.round(latest.staleMs / 60_000)}m</span>
            ) : (
              <span className="badge ok">Running</span>
            )}
          </p>
          <pre>{latest.tail || "(empty)"}</pre>
        </div>
      ) : null}

      {data?.sprintLogs && data.sprintLogs.length > 1 ? (
        <div className="card">
          <h2>Recent sprints</h2>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
            {data.sprintLogs.slice(1, 5).map((s) => (
              <li key={s.sprint}>
                {s.sprint} — {s.finished ? "done" : s.stale ? "stale" : "running"}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}
