export interface SprintLogHealth {
  sprint: string;
  logFile: string;
  lastModified: string;
  staleMs: number;
  stale: boolean;
  finished: boolean;
  tail: string;
}

export interface PerfDashboard {
  generatedAt: string;
  stale: boolean;
  latestSprint: SprintLogHealth | null;
  sprintLogs: SprintLogHealth[];
  waves: Array<{
    wave: number;
    status: string;
    startedAt: string;
    pid: number | null;
    logPath: string;
  }>;
}

function apiBase(): string {
  const fromSession = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("perf:apiBase") : null;
  const fromEnv = import.meta.env.VITE_PERF_API_BASE as string | undefined;
  return (fromSession ?? fromEnv ?? "").replace(/\/$/, "");
}

export function loadConfig(): { wave: number; token: string } {
  const wave = Number(localStorage.getItem("perf:wave") ?? "2");
  const token = localStorage.getItem("perf:token") ?? "";
  return { wave, token };
}

export function saveConfig(wave: number, token: string): void {
  localStorage.setItem("perf:wave", String(wave));
  localStorage.setItem("perf:token", token);
}

export async function fetchDashboard(wave: number, token: string): Promise<PerfDashboard> {
  const base = apiBase();
  const url = `${base}/perf/dashboard?wave=${wave}&token=${encodeURIComponent(token)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json() as Promise<PerfDashboard>;
}

export function triggerWaveUrl(wave: number, token: string): string {
  const base = apiBase();
  return `${base}/perf/trigger?wave=${wave}&token=${encodeURIComponent(token)}`;
}
