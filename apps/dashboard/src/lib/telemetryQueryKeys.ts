/**
 * Telemetry React Query keys (Sprint-15).
 *
 * | Key | Scope | Fetcher | Poll |
 * |-----|-------|---------|------|
 * | `telemetry.summary(workspaceId)` | Tier 0–1 bootstrap | `fetchTelemetrySummary` | 15s (60s when SSE connected) |
 * | `telemetry.analytics(workspaceId)` | Tier 2–3 diagnostics | `fetchTelemetryAnalytics` | 15s after `requestAnalytics` |
 *
 * Prefix `telemetry` invalidates both tiers via `telemetry.all(workspaceId)`.
 */
export const telemetryQueryKeys = {
  all: (workspaceId: string) => ["telemetry", workspaceId] as const,
  summary: (workspaceId: string) => ["telemetry", workspaceId, "summary"] as const,
  analytics: (workspaceId: string) => ["telemetry", workspaceId, "analytics"] as const,
} as const;

/** Matches prior WorkspaceTelemetryProvider poll cadence (Sprint-14/28). */
export const TELEMETRY_POLL_INTERVAL_MS = 15_000;

/**
 * Fresh window for summary/analytics cache. Aligns with poll interval so StrictMode
 * remounts reuse in-flight or cached data instead of issuing duplicate network calls.
 */
export const TELEMETRY_STALE_TIME_MS = TELEMETRY_POLL_INTERVAL_MS;
