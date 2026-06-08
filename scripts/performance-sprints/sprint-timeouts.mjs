/**
 * Shared timeout helpers for Cursor SDK sprint runs.
 * Tunable via env (milliseconds).
 */

export function envMs(name, defaultMs) {
  const raw = process.env[name];
  if (!raw) return defaultMs;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : defaultMs;
}

export const SPRINT_DISPOSE_TIMEOUT_MS = envMs("PERF_SPRINT_DISPOSE_TIMEOUT_MS", 30_000);
/** 0 = disabled. Agents often run long tool/shell work without streaming text. */
export const SPRINT_INACTIVITY_TIMEOUT_MS = envMs("PERF_SPRINT_INACTIVITY_TIMEOUT_MS", 0);
export const SPRINT_MAX_TIMEOUT_MS = envMs("PERF_SPRINT_MAX_TIMEOUT_MS", 90 * 60_000);
export const WATCH_STALE_MS = envMs("PERF_WATCH_STALE_MS", 30 * 60_000);
export const WATCH_INTERVAL_MS = envMs("PERF_WATCH_INTERVAL_MS", 2 * 60_000);

export function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export function createInactivityGuard({ timeoutMs, onStale, checkEveryMs = 30_000 }) {
  let lastActivity = Date.now();
  const touch = () => {
    lastActivity = Date.now();
  };
  const timer = setInterval(() => {
    if (Date.now() - lastActivity >= timeoutMs) onStale(timeoutMs);
  }, checkEveryMs);
  return {
    touch,
    stop: () => clearInterval(timer),
  };
}

export async function disposeAgent(agent) {
  if (!agent) return;
  if (agent[Symbol.asyncDispose]) {
    await agent[Symbol.asyncDispose]();
    return;
  }
  if (typeof agent.close === "function") {
    await agent.close();
  }
}
