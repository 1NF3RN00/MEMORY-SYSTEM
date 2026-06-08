import fs from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "./perf-wave-runner.js";

const SPRINTS_ROOT = path.join(REPO_ROOT, "docs/performance-improvments");
const DEFAULT_STALE_MS = Number(process.env.PERF_WATCH_STALE_MS ?? 30 * 60_000);

export interface SprintLogHealth {
  sprint: string;
  logPath: string;
  logFile: string;
  lastModified: string;
  staleMs: number;
  stale: boolean;
  finished: boolean;
  tail: string;
}

function readTail(filePath: string, maxBytes = 600): string {
  try {
    const buf = fs.readFileSync(filePath);
    return buf.slice(Math.max(0, buf.length - maxBytes)).toString("utf8");
  } catch {
    return "";
  }
}

export function collectSprintLogHealth(staleMs = DEFAULT_STALE_MS): SprintLogHealth[] {
  const now = Date.now();
  const results: SprintLogHealth[] = [];

  if (!fs.existsSync(SPRINTS_ROOT)) return results;

  for (const entry of fs.readdirSync(SPRINTS_ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith("sprint-")) continue;
    const runsDir = path.join(SPRINTS_ROOT, entry.name, "runs");
    if (!fs.existsSync(runsDir)) continue;

    let latest: { file: string; full: string; mtimeMs: number } | null = null;
    for (const file of fs.readdirSync(runsDir)) {
      if (!file.endsWith(".log")) continue;
      const full = path.join(runsDir, file);
      const mtimeMs = fs.statSync(full).mtimeMs;
      if (!latest || mtimeMs > latest.mtimeMs) {
        latest = { file, full, mtimeMs };
      }
    }
    if (!latest) continue;

    const tail = readTail(latest.full);
    const age = now - latest.mtimeMs;
    results.push({
      sprint: entry.name,
      logPath: latest.full,
      logFile: latest.file,
      lastModified: new Date(latest.mtimeMs).toISOString(),
      staleMs: age,
      stale: age >= staleMs,
      finished: /status:\s*finished/.test(tail),
      tail,
    });
  }

  return results.sort((a, b) => b.lastModified.localeCompare(a.lastModified));
}

export function getLatestSprintActivity(staleMs = DEFAULT_STALE_MS): SprintLogHealth | null {
  const logs = collectSprintLogHealth(staleMs);
  return logs[0] ?? null;
}
