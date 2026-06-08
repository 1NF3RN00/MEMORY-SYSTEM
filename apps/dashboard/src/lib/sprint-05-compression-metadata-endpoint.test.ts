/**
 * Sprint-05 verification: Compression metadata-only endpoint
 * OP-5 — home telemetry uses ?summary=true instead of full context packages
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

describe("Sprint-05 — compression metadata-only endpoint", () => {
  describe("objective 1: home telemetry uses summary endpoint", () => {
    it("fetchWorkspaceTelemetry requests compression detail with ?summary=true", () => {
      const source = readSrc("lib/workspaceTelemetry.ts");
      const fetchBody = source.slice(
        source.indexOf("async function loadCompressionAnalytics"),
        source.indexOf("export async function fetchTelemetryAnalyticsBundle"),
      );
      expect(fetchBody).toMatch(/\/compression\/\$\{latestCompressionId\}\?summary=true/);
      expect(fetchBody).not.toMatch(/\/compression\/\$\{latestCompressionId\}`\)/);
    });

    it("fetchWorkspaceTelemetry reads compressionMetadata from summary shape", async () => {
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
              counts: { lowConfidenceRetrievals: 0, failedRetrievals: 0 },
            },
          };
        } else if (path.includes("/heatmaps")) body = { entries: [] };
        else if (path.includes("/compression?")) {
          body = {
            traces: [
              {
                compressionTraceId: "01JCOMPRESSIONSUMMARYTEST000001",
                status: "completed",
                createdAt: new Date().toISOString(),
              },
            ],
          };
        } else if (path.includes("/compression/") && path.includes("summary=true")) {
          body = {
            trace: {
              compressionTraceId: "01JCOMPRESSIONSUMMARYTEST000001",
              compressionMetadata: {
                originalTokens: 6400,
                optimizedTokens: 4200,
                tokenSavings: 2200,
                fidelityScore: 0.94,
              },
              fidelityReport: { fidelityScore: 0.94 },
              mergeCount: 2,
              trimCount: 1,
            },
          };
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

      const telemetry = await fetchWorkspaceTelemetry("ws-test");
      expect(telemetry?.compressionAnalytics).toEqual({
        originalTokens: 6400,
        compressedTokens: 4200,
        fidelityScore: 0.94,
        mergeCount: 2,
        trimCount: 1,
      });
      expect(telemetry?.metrics.compressionRatio).toBeCloseTo(4200 / 6400, 5);
      expect(telemetry?.indicators.compressionEfficiency).toBeCloseTo(1 - 4200 / 6400, 5);

      const summaryCalls = mockFetch.mock.calls.filter(([url]) =>
        String(url).includes("/compression/") && String(url).includes("summary=true"),
      );
      expect(summaryCalls).toHaveLength(1);
    });
  });

  describe("objective 2: compression traces page keeps full detail route", () => {
    it("CompressionTracesPage still fetches full /compression/:traceId without summary flag", () => {
      const source = readSrc("pages/CompressionTracesPage.tsx");
      expect(source).toMatch(/apiGet<TraceDetail>\(`\/compression\/\$\{traceId\}`\)/);
      expect(source).not.toMatch(/summary=true/);
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.resetModules();
  });
});
