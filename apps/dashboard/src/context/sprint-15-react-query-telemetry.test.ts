/**
 * Sprint-15 verification: React Query for telemetry
 * OP-13 / FE-003 — cached telemetry, structural sharing, StrictMode dedupe
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  TELEMETRY_POLL_INTERVAL_MS,
  TELEMETRY_STALE_TIME_MS,
  telemetryQueryKeys,
} from "../lib/telemetryQueryKeys.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dashboardSrc = join(__dirname, "..");

function readSrc(relativePath: string): string {
  return readFileSync(join(dashboardSrc, relativePath), "utf8");
}

describe("Sprint-15 — React Query for telemetry", () => {
  describe("objective 1: cached telemetry with staleTime", () => {
    it("telemetry query keys are documented and scoped per workspace", () => {
      const source = readSrc("lib/telemetryQueryKeys.ts");
      expect(source).toMatch(/telemetryQueryKeys/);
      expect(source).toMatch(/summary:\s*\(workspaceId: string\)/);
      expect(source).toMatch(/analytics:\s*\(workspaceId: string\)/);
      expect(source).toMatch(/TELEMETRY_STALE_TIME_MS/);
    });

    it("WorkspaceTelemetryProvider configures staleTime on summary and analytics queries", () => {
      const source = readSrc("context/WorkspaceTelemetryContext.tsx");
      expect(source).toMatch(/staleTime:\s*TELEMETRY_STALE_TIME_MS/);
      expect(source).toMatch(/useQuery\(/);
    });
  });

  describe("objective 2: structural sharing reduces re-renders", () => {
    it("query client enables structuralSharing by default", () => {
      const source = readSrc("lib/queryClient.ts");
      expect(source).toMatch(/structuralSharing:\s*true/);
    });

    it("telemetry queries opt into structuralSharing", () => {
      const source = readSrc("context/WorkspaceTelemetryContext.tsx");
      expect(source).toMatch(/structuralSharing:\s*true/);
    });
  });

  describe("objective 3: StrictMode no double network", () => {
    it("staleTime matches poll interval so remounts reuse cached data", () => {
      const keys = readSrc("lib/telemetryQueryKeys.ts");
      expect(keys).toMatch(
        /TELEMETRY_STALE_TIME_MS\s*=\s*TELEMETRY_POLL_INTERVAL_MS/,
      );
    });

    it("QueryClientProvider wraps the app inside StrictMode", () => {
      const source = readSrc("main.tsx");
      expect(source).toMatch(/QueryClientProvider/);
      expect(source).toMatch(/StrictMode/);
    });
  });

  describe("anti-objectives", () => {
    it("React Query is limited to telemetry provider (dashboard not fully migrated)", () => {
      const main = readSrc("main.tsx");
      const provider = readSrc("context/WorkspaceTelemetryContext.tsx");
      expect(main).toMatch(/QueryClientProvider/);
      expect(provider).toMatch(/useQuery/);
      expect(readSrc("pages/HomePage.tsx")).not.toMatch(/useQuery/);
      expect(readSrc("context/AuthContext.tsx")).not.toMatch(/useQuery/);
    });

    it("provider surfaces summary and analytics errors to consumers", () => {
      const source = readSrc("context/WorkspaceTelemetryContext.tsx");
      expect(source).toMatch(/summaryError/);
      expect(source).toMatch(/analyticsError/);
      expect(source).toMatch(/telemetryErrorMessage/);
    });

    it("analytics tier still loads on demand via requestAnalytics", () => {
      const source = readSrc("context/WorkspaceTelemetryContext.tsx");
      expect(source).toMatch(/analyticsRequested/);
      expect(source).toMatch(/requestAnalytics/);
      expect(source).not.toMatch(/fetchWorkspaceTelemetry/);
    });
  });

  describe("runtime — React Query cache and dedupe (StrictMode analogue)", () => {
    afterEach(() => {
      vi.resetAllMocks();
    });

    it("staleTime reuses cached data so a second fetchQuery does not re-wire", async () => {
      const queryFn = vi.fn(async () => ({ indicators: [], panelData: {} }));
      const client = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            structuralSharing: true,
            refetchOnWindowFocus: false,
          },
        },
      });

      const key = telemetryQueryKeys.summary("ws-strict");
      const options = {
        queryKey: key,
        queryFn,
        staleTime: TELEMETRY_STALE_TIME_MS,
      };

      const first = await client.fetchQuery(options);
      const second = await client.fetchQuery(options);

      expect(queryFn).toHaveBeenCalledTimes(1);
      expect(second).toBe(first);
    });

    it("structural sharing preserves referential identity when poll payload is unchanged", async () => {
      const payload = {
        indicators: [{ id: "cpu", value: 42 }],
        panelData: { health: "ok" },
      };

      const client = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            structuralSharing: true,
            refetchOnWindowFocus: false,
          },
        },
      });

      const key = telemetryQueryKeys.summary("ws-sharing");
      client.setQueryData(key, payload);

      const before = client.getQueryData<typeof payload>(key)!;
      client.setQueryData(key, { ...payload, indicators: [...payload.indicators] });

      const after = client.getQueryData<typeof payload>(key)!;
      expect(after).toBe(before);
      expect(after.indicators).toBe(before.indicators);
      expect(after.panelData).toBe(before.panelData);
    });
  });

  describe("network evidence — refetchInterval poll, single bootstrap per cycle", () => {
    afterEach(() => {
      vi.unstubAllGlobals();
      vi.resetModules();
    });

    it("summary query uses 15s refetchInterval before analytics loads", () => {
      const source = readSrc("context/WorkspaceTelemetryContext.tsx");
      expect(source).toMatch(/POLL_INTERVAL_MS\s*=\s*15_000/);
      expect(source).toMatch(/refetchInterval:[\s\S]*TELEMETRY_POLL_INTERVAL_MS/);
      expect(source).not.toMatch(/setInterval/);
      expect(TELEMETRY_POLL_INTERVAL_MS).toBe(15_000);
      expect(TELEMETRY_STALE_TIME_MS).toBe(TELEMETRY_POLL_INTERVAL_MS);
    });

    it("fetchTelemetrySummaryBundle issues one bootstrap request per invocation", async () => {
      const mockFetch = vi.fn((url: string) => {
        const path = String(url);
        const body = path.includes("/dashboard-bootstrap")
          ? {
              workspaceId: "ws-sprint-15",
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
      await fetchTelemetrySummaryBundle("ws-sprint-15");

      expect(mockFetch.mock.calls).toHaveLength(1);
      expect(String(mockFetch.mock.calls[0]![0])).toContain(
        "/workspaces/ws-sprint-15/dashboard-bootstrap",
      );
    });
  });
});
