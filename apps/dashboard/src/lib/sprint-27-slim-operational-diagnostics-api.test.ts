/**
 * Sprint-27 verification: Slim operational diagnostics API
 * RC-004 — home telemetry uses ?mode=slim instead of full diagnostic arrays
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

describe("Sprint-27 — slim operational diagnostics API", () => {
  describe("objective 3: dashboard uses slim mode", () => {
    it("fetchWorkspaceTelemetry requests operational diagnostics with mode=slim", () => {
      const source = readSrc("lib/workspaceTelemetry.ts");
      const fetchBody = source.slice(
        source.indexOf("export async function fetchTelemetryAnalyticsBundle"),
        source.indexOf("/** Analytics tier"),
      );
      expect(fetchBody).toMatch(/\/diagnostics\/operational\?workspaceId=\$\{workspaceId\}&limit=100&mode=slim/);
    });

    it("fetchWorkspaceTelemetry reads lowConfidenceCount from slim counts", async () => {
      const mockFetch = vi.fn((url: string) => {
        const path = String(url);
        let body: unknown = { traces: [] };
        if (path.includes("/dashboard-bootstrap")) {
          body = {
            workspaceId: "ws-test",
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
              counts: { lowConfidenceRetrievals: 3, failedRetrievals: 1 },
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

      const telemetry = await fetchWorkspaceTelemetry("ws-test");
      expect(telemetry?.panelData.retrievalConfidence.lowConfidenceCount).toBe(3);

      const slimCalls = mockFetch.mock.calls.filter(([url]) =>
        String(url).includes("/diagnostics/operational") && String(url).includes("mode=slim"),
      );
      expect(slimCalls).toHaveLength(1);
    });
  });

  describe("objective 2: historian keeps full mode", () => {
    it("HistorianPage fetches operational diagnostics without mode=slim", () => {
      const source = readSrc("pages/HistorianPage.tsx");
      expect(source).toMatch(/\/diagnostics\/operational\?workspaceId=\$\{workspaceId\}`/);
      expect(source).not.toMatch(/mode=slim/);
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.resetModules();
  });
});
