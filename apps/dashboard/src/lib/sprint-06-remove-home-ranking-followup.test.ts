/**
 * Sprint-06 verification: Remove home ranking follow-up
 * OP-6 / FE-006 — drop GET /retrieval/:id/ranking from home telemetry bundle
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

describe("Sprint-06 — remove home ranking follow-up", () => {
  describe("objective 1: home telemetry does not fetch ranking", () => {
    it("fetchWorkspaceTelemetry does not call /ranking", () => {
      const source = readSrc("lib/workspaceTelemetry.ts");
      const fetchBody = source.slice(
        source.indexOf("export async function fetchWorkspaceTelemetry"),
        source.indexOf("function buildOperationalEvents"),
      );
      expect(fetchBody).not.toMatch(/\/ranking/);
    });

    it("fetchWorkspaceTelemetry issues no /ranking request per invocation", async () => {
      const mockFetch = vi.fn((url: string) => {
        const path = String(url);
        let body: unknown = { traces: [] };
        if (path.includes("/dashboard-bootstrap")) {
          body = {
            workspaceId: "ws-sprint-06",
            tier: "summary",
            memories: [],
            retrievalTraces: [],
            ingestionTraces: [],
            health: { status: "ok", timestamp: new Date().toISOString() },
          };
        } else if (path.includes("/memory")) body = { memories: [] };
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
      await fetchWorkspaceTelemetry("ws-sprint-06");

      const rankingCalls = mockFetch.mock.calls.filter(([u]) => String(u).includes("/ranking"));
      expect(rankingCalls).toHaveLength(0);
    });
  });

  describe("objective 2: confidence UI handles missing ranking", () => {
    it("OperationalIntelligencePanels renders em dash when contextualConfidence is null", () => {
      const source = readSrc("components/homepage/OperationalIntelligencePanels.tsx");
      expect(source).toMatch(/contextualConfidence !== null/);
      expect(source).toMatch(/"—"/);
    });

    it("fetchWorkspaceTelemetry returns null contextualConfidence without ranking", async () => {
      const mockFetch = vi.fn((url: string) => {
        const path = String(url);
        let body: unknown = { traces: [] };
        if (path.includes("/dashboard-bootstrap")) {
          body = {
            workspaceId: "ws-sprint-06",
            tier: "summary",
            memories: [],
            retrievalTraces: [],
            ingestionTraces: [],
            health: { status: "ok", timestamp: new Date().toISOString() },
          };
        } else if (path.includes("/memory")) body = { memories: [] };
        else if (path.includes("/health")) body = { status: "ok" };
        else if (path.includes("/diagnostics/drift")) body = { report: { signals: [] } };
        else if (path.includes("/diagnostics/operational")) {
          body = {
            report: {
              mode: "slim",
              counts: { lowConfidenceRetrievals: 1, failedRetrievals: 0 },
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

      const { fetchWorkspaceTelemetry } = await import("./workspaceTelemetry.js");
      const result = await fetchWorkspaceTelemetry("ws-sprint-06");

      expect(result?.panelData.retrievalConfidence.contextualConfidence).toBeNull();
      expect(result?.panelData.retrievalConfidence.lowConfidenceCount).toBe(1);
      expect(result?.metrics.tokenEfficiency).toBeNull();
    });
  });

  describe("objective 3: Observability loads ranking on demand", () => {
    it("ObservabilityPage calls fetchRankingBreakdown after telemetry", () => {
      const source = readSrc("pages/ObservabilityPage.tsx");
      expect(source).toMatch(/fetchRankingBreakdown/);
      expect(source).not.toMatch(/telemetry\.rankingRows/);
    });

    it("fetchRankingBreakdown fetches /retrieval/:id/ranking", async () => {
      const mockFetch = vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              rankingBreakdown: [{ memoryId: "m1", chunkId: "c1", finalScore: 0.9, rankingRank: 1 }],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        ),
      );
      vi.stubGlobal("fetch", mockFetch);
      vi.resetModules();

      const { fetchRankingBreakdown } = await import("./workspaceTelemetry.js");
      const rows = await fetchRankingBreakdown("ret-trace-1");

      expect(mockFetch.mock.calls.some(([u]) => String(u).includes("/retrieval/ret-trace-1/ranking"))).toBe(
        true,
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]?.finalScore).toBe(0.9);
    });
  });
});
