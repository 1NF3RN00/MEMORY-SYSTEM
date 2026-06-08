import { loadConfig, triggerWaveUrl } from "../api/perf";

const WAVES = [
  { n: 1, name: "Quick wins" },
  { n: 2, name: "Payload slimming" },
  { n: 3, name: "Observability" },
  { n: 4, name: "Dashboard data layer" },
  { n: 5, name: "Render polish" },
  { n: 6, name: "Retrieval depth" },
  { n: 7, name: "Long-term" },
];

export function WavesPage() {
  const { token } = loadConfig();

  if (!token) {
    return (
      <div className="card">
        <p>Configure your HMAC token in Setup first.</p>
      </div>
    );
  }

  return (
    <>
      <p className="muted" style={{ marginTop: 0 }}>
        Starts <code>npm run perf:wave</code> on your PC via the API trigger. Machine must be awake.
      </p>
      {WAVES.map((w) => (
        <div className="card" key={w.n}>
          <h2>
            Wave {w.n} — {w.name}
          </h2>
          <a className="button" href={triggerWaveUrl(w.n, token)} target="_blank" rel="noreferrer">
            Start wave {w.n}
          </a>
        </div>
      ))}
    </>
  );
}
