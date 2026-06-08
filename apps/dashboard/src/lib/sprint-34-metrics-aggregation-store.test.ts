/**
 * Sprint-34 verification: dashboard reads pre-aggregated metrics summary
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));

function readSrc(relativePath: string): string {
  return readFileSync(join(__dirname, relativePath), "utf8");
}

describe("Sprint-34 — metrics aggregation store", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("fetchTelemetrySummaryBundle fetches bootstrap and metrics summary in parallel", async () => {
    const mockFetch = vi.fn((url: string) => {
      const path = String(url);
      const body = path.includes("/metrics/summary")
        ? {
            workspaceId: "ws-sprint-34",
            activeMemories: 12,
            retrieval: {
              total: 40,
              completed: 38,
              failed: 2,
              last24h: 5,
              failedLast24h: 1,
              avgLatencyMs: 220,
            },
            ingestion: {
              total: 10,
              completed: 9,
              failed: 1,
              last24h: 3,
              throughputPerHour: 0.1,
            },
            compression: { total: 4, completed: 4, failed: 0 },
            contextRender: { total: 2, completed: 2, failed: 0 },
            updatedAt: new Date().toISOString(),
          }
        : {
            workspaceId: "ws-sprint-34",
            tier: "summary",
            memories: [],
            retrievalTraces: [],
            ingestionTraces: [],
            health: { status: "ok", timestamp: new Date().toISOString() },
          };

      return Promise.resolve(
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    });
    vi.stubGlobal("fetch", mockFetch);
    vi.resetModules();

    const { fetchTelemetrySummaryBundle } = await import("./workspaceTelemetry.js");
    const bundle = await fetchTelemetrySummaryBundle("ws-sprint-34");

    expect(mockFetch.mock.calls).toHaveLength(2);
    expect(String(mockFetch.mock.calls[0]![0])).toContain("/dashboard-bootstrap");
    expect(String(mockFetch.mock.calls[1]![0])).toContain("/metrics/summary");
    expect(bundle?.metricsSummary?.activeMemories).toBe(12);
    expect(bundle?.metricsSummary?.retrieval.avgLatencyMs).toBe(220);
  });

  it("buildWorkspaceTelemetryFromBundle prefers aggregated metrics over trace scans", async () => {
    const { buildWorkspaceTelemetryFromBundle } = await import("./workspaceTelemetry.js");
    const telemetry = buildWorkspaceTelemetryFromBundle("ws-sprint-34", {
      memories: [{ id: "m1", title: "A", memoryType: "semantic", persistenceMode: "persistent", archived: false }],
      retrievalTraces: [],
      ingestionTraces: [],
      compressionTraces: [],
      deliveryTraces: [],
      driftSignals: [],
      diagnosticsReport: { mode: "slim", counts: { lowConfidenceRetrievals: 0, failedRetrievals: 0 } },
      heatmapEntries: [],
      healthStatus: "ok",
      compressionAnalytics: null,
      metricsSummary: {
        workspaceId: "ws-sprint-34",
        activeMemories: 99,
        retrieval: {
          total: 10,
          completed: 9,
          failed: 1,
          last24h: 7,
          failedLast24h: 1,
          avgLatencyMs: 150,
        },
        ingestion: {
          total: 4,
          completed: 4,
          failed: 0,
          last24h: 2,
          throughputPerHour: 0.1,
        },
        compression: { total: 1, completed: 1, failed: 0 },
        contextRender: { total: 0, completed: 0, failed: 0 },
        updatedAt: new Date().toISOString(),
      },
    });

    expect(telemetry.metrics.retrievalOps24h).toBe(7);
    expect(telemetry.metrics.avgLatencyMs).toBe(150);
    expect(telemetry.metrics.memoryObjects).toBe(99);
    expect(telemetry.indicators.activeMemories).toBe(99);
  });

  it("TELEMETRY_TIER_BOUNDARIES documents metrics summary endpoint", () => {
    const source = readSrc("workspaceTelemetry.ts");
    expect(source).toMatch(/fetchWorkspaceMetricsSummary/);
    expect(source).toMatch(/metrics\/summary/);
  });
});
