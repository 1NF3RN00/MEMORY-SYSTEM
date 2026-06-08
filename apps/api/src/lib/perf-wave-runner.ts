import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const libDir = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(libDir, "../../../..");

export interface WaveRunState {
  wave: number;
  pid: number | null;
  startedAt: string;
  status: "starting" | "running" | "completed" | "failed";
  logPath: string;
  exitCode: number | null;
}

const activeRuns = new Map<number, WaveRunState>();

export function signWaveToken(wave: number, secret: string): string {
  return crypto.createHmac("sha256", secret).update(`wave:${wave}`).digest("hex").slice(0, 32);
}

export function verifyWaveToken(wave: number, token: string, secret: string): boolean {
  if (!token || token.length !== 32) return false;
  const expected = signWaveToken(wave, secret);
  try {
    return crypto.timingSafeEqual(Buffer.from(token, "utf8"), Buffer.from(expected, "utf8"));
  } catch {
    return false;
  }
}

function npmCommand(): string {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

export function getWaveRunState(wave: number): WaveRunState | undefined {
  return activeRuns.get(wave);
}

export function listWaveRuns(): WaveRunState[] {
  return [...activeRuns.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export function startPerfWave(wave: number): WaveRunState {
  const existing = activeRuns.get(wave);
  if (existing && (existing.status === "starting" || existing.status === "running")) {
    return existing;
  }

  const logDir = path.join(REPO_ROOT, "docs/performance-improvments/wave-reports");
  fs.mkdirSync(logDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const logPath = path.join(logDir, `wave-${wave}-run-${stamp}.log`);

  const logStream = fs.createWriteStream(logPath, { flags: "a" });
  logStream.write(`[${new Date().toISOString()}] Starting perf wave ${wave}\n`);
  logStream.write(`[${new Date().toISOString()}] cwd=${REPO_ROOT}\n`);

  const child = spawn(npmCommand(), ["run", "perf:wave", "--", "--wave", String(wave)], {
    cwd: REPO_ROOT,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
    env: { ...process.env },
    windowsHide: true,
  });

  child.stdout?.on("data", (chunk: Buffer) => logStream.write(chunk));
  child.stderr?.on("data", (chunk: Buffer) => logStream.write(chunk));

  const state: WaveRunState = {
    wave,
    pid: child.pid ?? null,
    startedAt: new Date().toISOString(),
    status: "running",
    logPath,
    exitCode: null,
  };
  activeRuns.set(wave, state);

  child.on("error", (err) => {
    logStream.write(`\n[${new Date().toISOString()}] Spawn error: ${err.message}\n`);
    state.status = "failed";
    state.exitCode = 1;
    logStream.end();
  });

  child.on("exit", (code) => {
    state.exitCode = code;
    state.status = code === 0 ? "completed" : "failed";
    logStream.write(`\n[${new Date().toISOString()}] Exit code: ${code ?? "null"}\n`);
    logStream.end();
  });

  child.unref();

  return state;
}
