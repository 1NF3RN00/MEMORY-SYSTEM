import { useState } from "react";
import { loadConfig, saveConfig } from "../api/perf";

export function SettingsPage() {
  const initial = loadConfig();
  const [wave, setWave] = useState(String(initial.wave));
  const [token, setToken] = useState(initial.token);
  const [apiBase, setApiBase] = useState(localStorage.getItem("perf:apiBase") ?? "");
  const [saved, setSaved] = useState(false);

  return (
    <div className="card">
      <h2>Connection</h2>
      <label className="muted">API base (ngrok URL, optional in dev)</label>
      <input
        value={apiBase}
        onChange={(e) => setApiBase(e.target.value)}
        placeholder="https://your-tunnel.ngrok-free.app"
      />
      <label className="muted">Wave number (for token scope)</label>
      <input value={wave} onChange={(e) => setWave(e.target.value)} inputMode="numeric" />
      <label className="muted">HMAC token (from email or perf:trigger-url)</label>
      <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="32-char token" />
      <button
        type="button"
        onClick={() => {
          saveConfig(Number(wave), token.trim());
          localStorage.setItem("perf:apiBase", apiBase.trim());
          if (apiBase.trim()) {
            // vite inject at build; runtime override via reload with query param documented in README
            sessionStorage.setItem("perf:apiBase", apiBase.trim());
          }
          setSaved(true);
        }}
      >
        Save
      </button>
      {saved ? <p className="badge ok" style={{ marginTop: 8 }}>Saved — reload app if you changed API base</p> : null}
      <p className="muted" style={{ marginTop: 12 }}>
        Generate token: <code>npm run perf:trigger-url -- --wave 2</code>
      </p>
    </div>
  );
}
