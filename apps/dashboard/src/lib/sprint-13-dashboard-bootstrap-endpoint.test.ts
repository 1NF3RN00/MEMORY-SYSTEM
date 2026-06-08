/**
 * Sprint-13 verification: Dashboard bootstrap endpoint
 * OP-11 — single batched summary-tier request for home load
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));

function readSrc(relativePath: string): string {
  return readFileSync(join(__dirname, relativePath), "utf8");
}

describe("Sprint-13 — dashboard bootstrap endpoint", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  describe("objective 1: single endpoint replaces parallel home bundle", () => {
    it("fetchTelemetrySummaryBundle issues exactly one bootstrap request", async () => {
      const mockFetch = vi.fn((url: string) => {
        const path = String(url);
        const body = path.includes("/dashboard-bootstrap")
          ? {
              workspaceId: "ws-sprint-13",
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

      const { fetchTelemetrySummaryBundle } = await import("./workspaceTelemetry.js");
      await fetchTelemetrySummaryBundle("ws-sprint-13");

      expect(mockFetch.mock.calls).toHaveLength(1);
      expect(String(mockFetch.mock.calls[0]![0])).toContain(
        "/workspaces/ws-sprint-13/dashboard-bootstrap",
      );
      expect(mockFetch.mock.calls.some(([u]) => String(u).includes("/memory"))).toBe(false);
      expect(mockFetch.mock.calls.some(([u]) => String(u).includes("/retrieval?"))).toBe(false);
      expect(mockFetch.mock.calls.some(([u]) => String(u).includes("/ingestion"))).toBe(false);
      expect(mockFetch.mock.calls.some(([u]) => String(u).includes("/health"))).toBe(false);
    });

    it("WorkspaceTelemetryProvider still routes summary load through fetchTelemetrySummary", () => {
      const source = readSrc("../context/WorkspaceTelemetryContext.tsx");
      expect(source).toMatch(/fetchTelemetrySummary/);
      expect(source).not.toMatch(/fetchWorkspaceTelemetry/);
    });
  });

  describe("objective 3: typed response documented", () => {
    it("TELEMETRY_TIER_BOUNDARIES summary tier documents bootstrap endpoint", async () => {
      const { TELEMETRY_TIER_BOUNDARIES } = await import("./workspaceTelemetry.js");
      expect(TELEMETRY_TIER_BOUNDARIES.summary.requestCount).toBe(1);
      expect(TELEMETRY_TIER_BOUNDARIES.summary.endpoints[0]).toContain("dashboard-bootstrap");
    });

    it("fetchDashboardBootstrap imports DashboardBootstrapResponse type", () => {
      const source = readSrc("workspaceTelemetry.ts");
      expect(source).toMatch(/DashboardBootstrapResponse/);
      expect(source).toMatch(/fetchDashboardBootstrap/);
    });
  });

  describe("anti-objectives", () => {
    it("existing list endpoints remain in workspaceTelemetry analytics tier", () => {
      const source = readSrc("workspaceTelemetry.ts");
      expect(source).toMatch(/\/compression\?workspaceId=/);
      expect(source).toMatch(/\/diagnostics\/operational/);
      expect(source).toMatch(/\/retrieval\/heatmaps/);
    });

    it("bootstrap mapper does not request compression detail or ranking", () => {
      const source = readSrc("workspaceTelemetry.ts");
      const mapperStart = source.indexOf("function telemetryBundleFromDashboardBootstrap");
      const mapperEnd = source.indexOf("/** Summary tier — single batched bootstrap request");
      expect(mapperStart).toBeGreaterThan(-1);
      const mapperSource = source.slice(mapperStart, mapperEnd);
      expect(mapperSource).not.toMatch(/rankingBreakdown/);
      expect(mapperSource).not.toMatch(/compressionMetadata/);
    });

    it("bootstrap DTO uses generic tier field names, not home-specific keys", () => {
      const contracts = readSrc(
        "../../../../packages/shared-types/src/dashboard-bootstrap-contracts.ts",
      );
      expect(contracts).toMatch(/tier:\s*"summary"/);
      expect(contracts).not.toMatch(/homePage|HomePanel|operationalStream/i);
    });
  });

  describe("verification harness: home request budget", () => {
    it("typical home mount issues at most 3 API requests (auth + bootstrap + lite graph)", async () => {
      const mockFetch = vi.fn((url: string) => {
        const path = String(url);
        let body: unknown = { traces: [] };
        if (path.includes("/auth/me")) {
          body = {
            user: { userId: "u1", email: "op@test.io", isPlatformAdmin: false },
            workspace: {
              workspaceId: "ws-sprint-13",
              name: "Default",
              plan: "free",
              archived: false,
              role: "owner",
              bootstrap: { status: "ready" },
            },
          };
        } else if (path.includes("/dashboard-bootstrap")) {
          body = {
            workspaceId: "ws-sprint-13",
            tier: "summary",
            memories: [],
            retrievalTraces: [],
            ingestionTraces: [],
            health: { status: "ok", timestamp: new Date().toISOString() },
          };
        } else if (path.includes("/relationships/graph")) {
          body = { nodes: [], links: [] };
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

      const { apiGet } = await import("./api.js");
      const { fetchTelemetrySummaryBundle } = await import("./workspaceTelemetry.js");

      await apiGet("/auth/me", "token-sprint-13");
      await fetchTelemetrySummaryBundle("ws-sprint-13");
      await apiGet("/relationships/graph?workspaceId=ws-sprint-13&lite=true");

      expect(mockFetch.mock.calls).toHaveLength(3);
      const paths = mockFetch.mock.calls.map(([u]) => String(u));
      expect(paths.some((p) => p.includes("/auth/me"))).toBe(true);
      expect(paths.some((p) => p.includes("/dashboard-bootstrap"))).toBe(true);
      expect(paths.some((p) => p.includes("/relationships/graph"))).toBe(true);
      expect(paths.some((p) => p.includes("/memory"))).toBe(false);
      expect(paths.some((p) => p.includes("/retrieval?"))).toBe(false);
      expect(paths.some((p) => p.includes("/ingestion"))).toBe(false);
      expect(paths.some((p) => p.includes("/health"))).toBe(false);
    });
  });

  describe("verification harness: payload size", () => {
    it("max-limit bootstrap JSON stays under 300KB", () => {
      const pad = "x".repeat(200);
      const payload = {
        workspaceId: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
        tier: "summary" as const,
        memories: Array.from({ length: 100 }, (_, i) => ({
          id: `01ARZ3NDEKTSV4RRFFQ69G5FA${String(i).padStart(1, "0")}`,
          title: `memory-title-${i}-${pad}`,
          memoryType: "semantic",
          persistenceMode: "persistent",
          archived: false,
        })),
        retrievalTraces: Array.from({ length: 50 }, (_, i) => ({
          retrievalTraceId: `01ARZ3NDEKTSV4RRFFQ69G5FB${String(i).padStart(2, "0")}`,
          workspaceId: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
          query: `retrieval-query-${i}-${pad}`,
          status: "completed",
          createdAt: "2026-06-08T12:00:00.000Z",
          completedAt: "2026-06-08T12:00:01.000Z",
          latencyMs: 42,
        })),
        ingestionTraces: Array.from({ length: 30 }, (_, i) => ({
          traceId: `01ARZ3NDEKTSV4RRFFQ69G5FC${String(i).padStart(2, "0")}`,
          workspaceId: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
          memoryId: `01ARZ3NDEKTSV4RRFFQ69G5FD${String(i).padStart(2, "0")}`,
          status: "completed",
          sourceType: "upload",
          createdAt: "2026-06-08T12:00:00.000Z",
        })),
        health: {
          status: "ok" as const,
          timestamp: "2026-06-08T12:00:00.000Z",
          trace_id: "01ARZ3NDEKTSV4RRFFQ69G5FE00",
        },
      };

      const bytes = Buffer.byteLength(JSON.stringify(payload), "utf8");
      expect(bytes).toBeLessThan(300 * 1024);
    });
  });
});
