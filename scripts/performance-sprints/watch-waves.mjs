#!/usr/bin/env node
/**
 * Background watchdog: detect stalled sprint/wave processes and alert via Resend.
 *
 * Run alongside perf:wave (second terminal or Task Scheduler):
 *   npm run perf:watch
 *
 * Env:
 *   PERF_WATCH_STALE_MS=720000     # no log writes for 12 min → alert (default)
 *   PERF_WATCH_INTERVAL_MS=120000  # poll every 2 min (default)
 *   RESEND_API_KEY, PERF_NOTIFY_EMAIL, RESEND_FROM_EMAIL  # for alerts
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { loadProjectEnv, REPO_ROOT } from "./load-env.mjs";
import { WATCH_INTERVAL_MS, WATCH_STALE_MS } from "./sprint-timeouts.mjs";

loadProjectEnv();

const SPRINTS_ROOT = path.join(REPO_ROOT, "docs/performance-improvments");
const alerted = new Set();

function listSprintProcesses() {
  try {
    if (process.platform === "win32") {
      const out = execSync(
        'powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name=\'node.exe\'\\" | Where-Object { $_.CommandLine -match \'run-sprint|run-wave\' } | Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress"',
        { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 },
      );
      const parsed = out.trim();
      if (!parsed) return [];
      const rows = JSON.parse(parsed);
      return Array.isArray(rows) ? rows : [rows];
    }
    const out = execSync("ps -eo pid,args | grep -E 'run-sprint|run-wave' | grep -v grep", {
      encoding: "utf8",
    });
    return out
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const m = line.trim().match(/^(\d+)\s+(.+)$/);
        return m ? { ProcessId: Number(m[1]), CommandLine: m[2] } : null;
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function latestRunLog() {
  let best = null;
  const sprintDirs = fs.readdirSync(SPRINTS_ROOT, { withFileTypes: true }).filter((e) => e.isDirectory() && e.name.startsWith("sprint-"));
  for (const dir of sprintDirs) {
    const runsDir = path.join(SPRINTS_ROOT, dir.name, "runs");
    if (!fs.existsSync(runsDir)) continue;
    for (const file of fs.readdirSync(runsDir)) {
      if (!file.endsWith(".log")) continue;
      const full = path.join(runsDir, file);
      const stat = fs.statSync(full);
      if (!best || stat.mtimeMs > best.mtimeMs) {
        best = { path: full, mtimeMs: stat.mtimeMs, sprint: dir.name, file };
      }
    }
  }
  const waveDir = path.join(SPRINTS_ROOT, "wave-reports");
  if (fs.existsSync(waveDir)) {
    for (const file of fs.readdirSync(waveDir)) {
      if (!file.match(/^wave-\d+-run-.*\.log$/)) continue;
      const full = path.join(waveDir, file);
      const stat = fs.statSync(full);
      if (!best || stat.mtimeMs > best.mtimeMs) {
        best = { path: full, mtimeMs: stat.mtimeMs, sprint: "wave-reports", file };
      }
    }
  }
  return best;
}

function readTail(filePath, maxBytes = 800) {
  try {
    const buf = fs.readFileSync(filePath);
    return buf.slice(Math.max(0, buf.length - maxBytes)).toString("utf8");
  } catch {
    return "";
  }
}

async function sendAlert({ subject, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.PERF_NOTIFY_EMAIL;
  const from = process.env.RESEND_FROM_EMAIL ?? "Perf Watchdog <onboarding@resend.dev>";
  if (!apiKey || !to) {
    console.warn("[perf:watch] RESEND not configured — console only:");
    console.warn(text);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, text }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}

async function checkOnce() {
  const procs = listSprintProcesses();
  const log = latestRunLog();
  const now = Date.now();

  if (!procs.length) {
    console.log(`[${new Date().toISOString()}] idle — no sprint processes`);
    return;
  }

  const staleMs = log ? now - log.mtimeMs : WATCH_STALE_MS + 1;
  const stale = staleMs >= WATCH_STALE_MS;
  const key = log ? `${log.path}:${Math.floor(log.mtimeMs / 60_000)}` : "no-log";

  console.log(
    `[${new Date().toISOString()}] processes=${procs.length} log=${log?.file ?? "—"} staleMs=${Math.round(staleMs / 1000)}`,
  );

  if (!stale || alerted.has(key)) return;

  alerted.add(key);
  const cmdLines = procs.map((p) => `PID ${p.ProcessId}: ${p.CommandLine}`).join("\n");
  const tail = log ? readTail(log.path) : "";
  const body = [
    "Performance sprint watchdog detected a likely stall.",
    "",
    `No log activity for ${Math.round(staleMs / 60_000)} minutes.`,
    "",
    "Processes:",
    cmdLines,
    "",
    log ? `Log: ${log.path}` : "Log: (none found)",
    "",
    "Tail:",
    tail || "(empty)",
    "",
    "Suggested fix:",
    "  Stop-Process -Id <pid> -Force",
    "  npm run perf:wave -- --wave N --sprints <remaining>",
  ].join("\n");

  await sendAlert({
    subject: `[semantic-core] Sprint run stalled (${log?.sprint ?? "unknown"})`,
    text: body,
  });
  console.warn("[perf:watch] Stall alert sent");
}

async function main() {
  console.log(`perf:watch started (interval=${WATCH_INTERVAL_MS}ms stale=${WATCH_STALE_MS}ms)`);
  for (;;) {
    try {
      await checkOnce();
    } catch (err) {
      console.error("[perf:watch] check failed:", err?.message ?? err);
    }
    await new Promise((r) => setTimeout(r, WATCH_INTERVAL_MS));
  }
}

main();
