/**
 * Sprint-14 verification: Shared WorkspaceTelemetryProvider
 * OP-12 / AR-001 — duplicate sidebar/home telemetry fetches
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dashboardSrc = join(__dirname, "..");

function readSrc(relativePath: string): string {
  return readFileSync(join(dashboardSrc, relativePath), "utf8");
}

const AUTH_LOADING_GUARD = /if\s*\(\s*authLoading\s*\|\|\s*!workspaceId\s*\)\s*return/;

describe("Sprint-14 — shared WorkspaceTelemetryProvider", () => {
  describe("objective 1: one telemetry fetch shared", () => {
    it("Layout wraps the app shell with WorkspaceTelemetryProvider", () => {
      const source = readSrc("components/Layout.tsx");
      expect(source).toMatch(/WorkspaceTelemetryProvider/);
      expect(source).toMatch(/<WorkspaceTelemetryProvider>/);
    });

    it("MetricsSidebar reads metrics from provider slice hook", () => {
      const source = readSrc("components/layout/MetricsSidebar.tsx");
      expect(source).toMatch(/useTelemetryMetrics/);
      expect(source).not.toMatch(/fetchTelemetrySummary/);
      expect(source).not.toMatch(/useEffect/);
    });

    it("useOperationalHomeData reads home slices from provider hooks", () => {
      const source = readSrc("components/homepage/useOperationalHomeData.ts");
      expect(source).toMatch(/useTelemetryIndicators/);
      expect(source).toMatch(/useTelemetryPanelData/);
      expect(source).toMatch(/useTelemetryEvents/);
      expect(source).not.toMatch(/fetchTelemetrySummaryBundle/);
      expect(source).not.toMatch(/useEffect/);
    });

    it("ObservabilityPage uses shared telemetry instead of fetchWorkspaceTelemetry", () => {
      const source = readSrc("pages/ObservabilityPage.tsx");
      expect(source).toMatch(/useWorkspaceTelemetry/);
      expect(source).not.toMatch(/fetchWorkspaceTelemetry/);
    });
  });

  describe("objective 2: single poll manager", () => {
    it("WorkspaceTelemetryProvider owns the summary poll interval", () => {
      const source = readSrc("context/WorkspaceTelemetryContext.tsx");
      expect(source).toMatch(/POLL_INTERVAL_MS\s*=\s*15_000/);
      expect(source).toMatch(/refetchInterval:[\s\S]*TELEMETRY_POLL_INTERVAL_MS/);
      expect(source).toMatch(/fetchTelemetrySummary/);
    });

    it("consumers do not register their own telemetry poll intervals", () => {
      const homeData = readSrc("components/homepage/useOperationalHomeData.ts");
      const sidebar = readSrc("components/layout/MetricsSidebar.tsx");
      expect(homeData).not.toMatch(/setInterval/);
      expect(sidebar).not.toMatch(/setInterval/);
    });
  });

  describe("objective 3: slice subscriptions", () => {
    it("provider exports slice hooks for home, sidebar, and observability", () => {
      const source = readSrc("context/WorkspaceTelemetryContext.tsx");
      expect(source).toMatch(/export function useTelemetryIndicators/);
      expect(source).toMatch(/export function useTelemetryPanelData/);
      expect(source).toMatch(/export function useTelemetryEvents/);
      expect(source).toMatch(/export function useTelemetryMetrics/);
      expect(source).toMatch(/export function useWorkspaceTelemetry/);
      expect(source).toMatch(/export function useTelemetryAnalyticsState/);
    });

    it("provider uses React Query structural sharing for stable telemetry references", () => {
      const source = readSrc("context/WorkspaceTelemetryContext.tsx");
      expect(source).toMatch(/structuralSharing:\s*true/);
      expect(source).toMatch(/staleTime:\s*TELEMETRY_STALE_TIME_MS/);
    });
  });

  describe("anti-objectives", () => {
    it("provider depends on AuthContext only (no circular provider deps)", () => {
      const provider = readSrc("context/WorkspaceTelemetryContext.tsx");
      const auth = readSrc("context/AuthContext.tsx");
      expect(provider).toMatch(/from "\.\/AuthContext\.js"/);
      expect(auth).not.toMatch(/WorkspaceTelemetry/);
    });

    it("analytics tier loads on demand via requestAnalytics", () => {
      const provider = readSrc("context/WorkspaceTelemetryContext.tsx");
      expect(provider).toMatch(/requestAnalytics/);
      expect(provider).toMatch(/fetchTelemetryAnalytics/);
      expect(provider).not.toMatch(/fetchWorkspaceTelemetry/);
    });

    it("provider gates workspace fetches on authLoading and workspaceId", () => {
      const source = readSrc("context/WorkspaceTelemetryContext.tsx");
      expect(source).toMatch(/queriesEnabled\s*=\s*!authLoading\s*&&\s*!!workspaceId/);
    });

    it("ObservabilityPage triggers analytics only after auth resolves", () => {
      const source = readSrc("pages/ObservabilityPage.tsx");
      expect(source).toMatch(AUTH_LOADING_GUARD);
    });
  });

  describe("network evidence — single poll, no nav double-fetch", () => {
    afterEach(() => {
      vi.unstubAllGlobals();
      vi.resetModules();
    });

    it("Layout mounts exactly one WorkspaceTelemetryProvider (app shell single poll owner)", () => {
      const layout = readSrc("components/Layout.tsx");
      expect((layout.match(/<WorkspaceTelemetryProvider/g) ?? []).length).toBe(1);
      expect((layout.match(/<\/WorkspaceTelemetryProvider>/g) ?? []).length).toBe(1);
    });

    it("AppShell and nav do not register telemetry fetch or poll", () => {
      const appShell = readSrc("components/layout/AppShell.tsx");
      expect(appShell).not.toMatch(/fetchTelemetry/);
      expect(appShell).not.toMatch(/useTelemetry/);
      expect(appShell).not.toMatch(/WorkspaceTelemetry/);
    });

    it("provider summary load issues one bootstrap request per poll cycle", async () => {
      const mockFetch = vi.fn((url: string) => {
        const path = String(url);
        const body = path.includes("/dashboard-bootstrap")
          ? {
              workspaceId: "ws-sprint-14",
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

      const { fetchTelemetrySummaryBundle } = await import("../lib/workspaceTelemetry.js");
      await fetchTelemetrySummaryBundle("ws-sprint-14");

      expect(mockFetch.mock.calls).toHaveLength(1);
      expect(String(mockFetch.mock.calls[0]![0])).toContain(
        "/workspaces/ws-sprint-14/dashboard-bootstrap",
      );
    });

    it("consumers never call fetchWorkspaceTelemetry full bundle (6–7 requests)", () => {
      const consumers = [
        "components/homepage/useOperationalHomeData.ts",
        "components/layout/MetricsSidebar.tsx",
        "pages/ObservabilityPage.tsx",
      ];
      for (const relativePath of consumers) {
        const source = readSrc(relativePath);
        expect(source).not.toMatch(/fetchWorkspaceTelemetry/);
      }
    });
  });
});
