/**
 * Sprint-28 verification: Consolidated health polling
 * BUG-003 / FE-001 — duplicate GET /health on home load
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dashboardSrc = join(__dirname, "../..");

function readSrc(relativePath: string): string {
  return readFileSync(join(dashboardSrc, relativePath), "utf8");
}

describe("Sprint-28 — consolidated health polling", () => {
  describe("objective 1: one /health per telemetry cycle", () => {
    it("OperationalSystemBar does not call GET /health", () => {
      const source = readSrc("components/homepage/OperationalSystemBar.tsx");
      expect(source).not.toMatch(/apiGet[^)]*\/health/);
      expect(source).not.toMatch(/fetch[^)]*\/health/);
    });

    it("summary tier health is sourced from dashboard bootstrap only", () => {
      const telemetry = readSrc("lib/workspaceTelemetry.ts");
      const systemBar = readSrc("components/homepage/OperationalSystemBar.tsx");
      const homeData = readSrc("components/homepage/useOperationalHomeData.ts");

      expect(telemetry).toMatch(/dashboard-bootstrap/);
      expect(telemetry).not.toMatch(/apiGet[^)]*\/health/);
      expect(systemBar + homeData).not.toMatch(/\/health/);
    });

    it("fetchWorkspaceTelemetry does not issue standalone GET /health requests", async () => {
      const mockFetch = vi.fn((url: string) => {
        const path = String(url);
        let body: unknown = { traces: [] };
        if (path.includes("/dashboard-bootstrap")) {
          body = {
            workspaceId: "ws-sprint-28",
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

        return Promise.resolve(
          new Response(JSON.stringify(body), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      });
      vi.stubGlobal("fetch", mockFetch);
      vi.resetModules();

      const { fetchWorkspaceTelemetry } = await import("../../lib/workspaceTelemetry.js");
      await fetchWorkspaceTelemetry("ws-sprint-28");

      const healthCalls = mockFetch.mock.calls.filter(([u]) => String(u).includes("/health"));
      expect(healthCalls).toHaveLength(0);
      expect(
        mockFetch.mock.calls.some(([u]) => String(u).includes("/dashboard-bootstrap")),
      ).toBe(true);
    });
  });

  describe("objective 2: SystemBar uses shared telemetry source", () => {
    it("OperationalSystemBar reads indicators.systemHealth directly", () => {
      const source = readSrc("components/homepage/OperationalSystemBar.tsx");
      expect(source).toMatch(/indicators\.systemHealth/);
      expect(source).not.toMatch(/useState/);
      expect(source).not.toMatch(/useEffect/);
    });

    it("fetchWorkspaceTelemetry maps bootstrap health status into indicators.systemHealth", async () => {
      const mockFetch = vi.fn((url: string) => {
        const path = String(url);
        let body: unknown = { traces: [] };
        if (path.includes("/dashboard-bootstrap")) {
          body = {
            workspaceId: "ws-sprint-28",
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

        return Promise.resolve(
          new Response(JSON.stringify(body), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      });
      vi.stubGlobal("fetch", mockFetch);
      vi.resetModules();

      const { fetchWorkspaceTelemetry } = await import("../../lib/workspaceTelemetry.js");
      const result = await fetchWorkspaceTelemetry("ws-sprint-28");

      expect(result?.indicators.systemHealth).toBe("nominal");
    });
  });

  describe("objective 3: polling interval preserved", () => {
    it("WorkspaceTelemetryProvider keeps 15s telemetry refresh interval", () => {
      const source = readSrc("context/WorkspaceTelemetryContext.tsx");
      expect(source).toMatch(/POLL_INTERVAL_MS\s*=\s*15_000/);
      expect(source).toMatch(/refetchInterval:[\s\S]*TELEMETRY_POLL_INTERVAL_MS/);
    });
  });

  describe("anti-objectives", () => {
    it("bootstrap failures degrade indicators without blocking telemetry (catch fallback)", () => {
      const source = readSrc("lib/workspaceTelemetry.ts");
      expect(source).toMatch(/emptySummaryTelemetryBundle/);
      expect(source).toMatch(/healthStatus = "degraded"/);
    });

    it("WorkspaceTelemetryProvider does not gate UI on health fetch success", () => {
      const source = readSrc("context/WorkspaceTelemetryContext.tsx");
      expect(source).not.toMatch(/systemHealth/);
      expect(source).toMatch(/fetchTelemetrySummary/);
      expect(source).toMatch(/emptyWorkspaceTelemetry/);
    });
  });
});

describe("Sprint-28 — fetchWorkspaceTelemetry health isolation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.resetModules();
  });

  it("maps non-ok bootstrap health status to degraded indicators", async () => {
    const mockFetch = vi.fn((url: string) => {
      const path = String(url);
      let body: unknown = { traces: [] };
      if (path.includes("/dashboard-bootstrap")) {
        body = {
          workspaceId: "ws-sprint-28",
          tier: "summary",
          memories: [],
          retrievalTraces: [],
          ingestionTraces: [],
          health: { status: "degraded", timestamp: new Date().toISOString() },
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

      return Promise.resolve(
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    });
    vi.stubGlobal("fetch", mockFetch);

    const { fetchWorkspaceTelemetry } = await import("../../lib/workspaceTelemetry.js");
    const result = await fetchWorkspaceTelemetry("ws-sprint-28");

    expect(result?.indicators.systemHealth).toBe("degraded");
  });
});
