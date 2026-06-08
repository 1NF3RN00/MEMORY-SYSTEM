/**
 * Sprint-12 verification: Split telemetry summary vs analytics tiers
 * OP-8 / FE-004 / AR-001
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dashboardSrc = join(__dirname, "..");

function readSrc(relativePath: string): string {
  return readFileSync(join(dashboardSrc, relativePath), "utf8");
}

function mockTelemetryFetch() {
  return vi.fn((url: string) => {
    const path = String(url);
    let body: unknown = { traces: [] };
    if (path.includes("/memory")) body = { memories: [] };
    else if (path.includes("/health")) body = { status: "ok" };
    else if (path.includes("/diagnostics/drift")) body = { report: { signals: [] } };
    else if (path.includes("/diagnostics/operational")) {
      body = {
        report: {
          mode: "slim",
          counts: { lowConfidenceRetrievals: 0, failedRetrievals: 0 },
        },
      };
    } else if (path.includes("/heatmaps")) body = { entries: [] };
    else if (path.includes("/compression/") && path.includes("summary=true")) {
      body = { trace: { compressionTraceId: "cmp-1" } };
    }

    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  });
}

describe("Sprint-12 — telemetry tier split", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  describe("objective 1: home loads summary tier on mount", () => {
    it("fetchTelemetrySummary issues one bootstrap request (Sprint-13)", async () => {
      const mockFetch = vi.fn((url: string) => {
        const path = String(url);
        const body = path.includes("/dashboard-bootstrap")
          ? {
              workspaceId: "ws-sprint-12",
              tier: "summary",
              memories: [],
              retrievalTraces: [],
              ingestionTraces: [],
              health: { status: "ok", timestamp: new Date().toISOString() },
            }
          : { traces: [] };
        return Promise.resolve(
          new Response(JSON.stringify(body), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      });
      vi.stubGlobal("fetch", mockFetch);
      vi.resetModules();

      const { fetchTelemetrySummary } = await import("./workspaceTelemetry.js");
      await fetchTelemetrySummary("ws-sprint-12");

      expect(mockFetch.mock.calls).toHaveLength(1);
      const paths = mockFetch.mock.calls.map(([u]) => String(u));
      expect(paths.some((p) => p.includes("/dashboard-bootstrap"))).toBe(true);
      expect(paths.some((p) => p.includes("/diagnostics/"))).toBe(false);
      expect(paths.some((p) => p.includes("/heatmaps"))).toBe(false);
    });

    it("WorkspaceTelemetryProvider imports fetchTelemetrySummary not fetchWorkspaceTelemetry", () => {
      const source = readSrc("context/WorkspaceTelemetryContext.tsx");
      expect(source).toMatch(/fetchTelemetrySummary/);
      expect(source).not.toMatch(/fetchWorkspaceTelemetry/);
    });
  });

  describe("objective 2: analytics on Observability or panel expand", () => {
    it("fetchTelemetryAnalyticsBundle loads diagnostics and heatmap endpoints", async () => {
      const mockFetch = mockTelemetryFetch();
      vi.stubGlobal("fetch", mockFetch);
      vi.resetModules();

      const { fetchTelemetryAnalyticsBundle } = await import("./workspaceTelemetry.js");
      await fetchTelemetryAnalyticsBundle("ws-sprint-12");

      const paths = mockFetch.mock.calls.map(([u]) => String(u));
      expect(paths.some((p) => p.includes("/diagnostics/drift"))).toBe(true);
      expect(paths.some((p) => p.includes("/diagnostics/operational"))).toBe(true);
      expect(paths.some((p) => p.includes("/retrieval/heatmaps"))).toBe(true);
      expect(paths.some((p) => p.includes("/compression?"))).toBe(true);
      expect(paths.some((p) => p.includes("/context/render"))).toBe(true);
    });

    it("ObservabilityPage still loads full telemetry via shared provider analytics", () => {
      const source = readSrc("pages/ObservabilityPage.tsx");
      expect(source).toMatch(/requestAnalytics/);
      expect(source).toMatch(/useWorkspaceTelemetry/);
      expect(source).toMatch(/fetchRankingBreakdown/);
    });

    it("OperationalIntelligencePanels exposes Load diagnostics control", () => {
      const source = readSrc("components/homepage/OperationalIntelligencePanels.tsx");
      expect(source).toMatch(/onRequestAnalytics/);
      expect(source).toMatch(/Load diagnostics/);
    });

    it("HomePage wires requestAnalytics into intelligence panels", () => {
      const source = readSrc("pages/HomePage.tsx");
      expect(source).toMatch(/requestAnalytics/);
      expect(source).toMatch(/onRequestAnalytics=\{requestAnalytics\}/);
    });
  });

  describe("objective 3: tier boundaries documented", () => {
    it("exports TELEMETRY_TIER_BOUNDARIES with summary and analytics endpoints", async () => {
      const { TELEMETRY_TIER_BOUNDARIES } = await import("./workspaceTelemetry.js");
      expect(TELEMETRY_TIER_BOUNDARIES.summary.requestCount).toBe(1);
      expect(TELEMETRY_TIER_BOUNDARIES.summary.endpoints).toHaveLength(1);
      expect(TELEMETRY_TIER_BOUNDARIES.analytics.endpoints.length).toBeGreaterThanOrEqual(5);
    });

    it("fetchWorkspaceTelemetry remains backward-compatible full bundle alias", async () => {
      const mockFetch = vi.fn((url: string) => {
        const path = String(url);
        let body: unknown = { traces: [] };
        if (path.includes("/dashboard-bootstrap")) {
          body = {
            workspaceId: "ws-sprint-12",
            tier: "summary",
            memories: [],
            retrievalTraces: [],
            ingestionTraces: [],
            health: { status: "ok", timestamp: new Date().toISOString() },
          };
        } else if (path.includes("/diagnostics/drift")) body = { report: { signals: [] } };
        else if (path.includes("/diagnostics/operational")) {
          body = {
            report: {
              mode: "slim",
              counts: { lowConfidenceRetrievals: 0, failedRetrievals: 0 },
            },
          };
        } else if (path.includes("/heatmaps")) body = { entries: [] };
        else if (path.includes("/compression/") && path.includes("summary=true")) {
          body = { trace: { compressionTraceId: "cmp-1" } };
        }

        return Promise.resolve(
          new Response(JSON.stringify(body), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      });
      vi.stubGlobal("fetch", mockFetch);
      vi.resetModules();

      const { fetchWorkspaceTelemetry } = await import("./workspaceTelemetry.js");
      await fetchWorkspaceTelemetry("ws-sprint-12");

      expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(6);
      const paths = mockFetch.mock.calls.map(([u]) => String(u));
      expect(paths.some((p) => p.includes("/dashboard-bootstrap"))).toBe(true);
      expect(paths.some((p) => p.includes("/diagnostics/operational"))).toBe(true);
    });
  });
});
