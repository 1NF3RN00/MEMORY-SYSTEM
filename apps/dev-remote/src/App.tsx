import { Link, Route, Routes } from "react-router-dom";
import { AgentPage } from "./pages/AgentPage";
import { HomePage } from "./pages/HomePage";
import { SettingsPage } from "./pages/SettingsPage";
import { WavesPage } from "./pages/WavesPage";

export function App() {
  return (
    <div className="app">
      <header>
        <h1 style={{ margin: "0 0 4px", fontSize: 20 }}>Dev Remote</h1>
        <p className="muted" style={{ margin: "0 0 16px" }}>
          Perf waves & SDK control from your phone
        </p>
      </header>

      <nav className="nav">
        <Link to="/">Status</Link>
        <Link to="/waves">Waves</Link>
        <Link to="/agent">Agent</Link>
        <Link to="/settings">Setup</Link>
      </nav>

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/waves" element={<WavesPage />} />
        <Route path="/agent" element={<AgentPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </div>
  );
}
