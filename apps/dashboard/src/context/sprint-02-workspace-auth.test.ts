/**
 * Sprint-02 verification: Workspace ID in AuthContext
 * OP-2 / BUG-003 — duplicate GET /workspaces/default on home load
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

const HOME_LOAD_CONSUMERS = [
  "components/homepage/ContextualIntelligenceMap.tsx",
  "context/WorkspaceTelemetryContext.tsx",
  "lib/workspaceTelemetry.ts",
] as const;

const AUTH_LOADING_GUARD = /if\s*\(\s*authLoading\s*\|\|\s*!workspaceId\s*\)\s*return/;
const TELEMETRY_QUERY_GUARD =
  /queriesEnabled\s*=\s*!authLoading\s*&&\s*!!workspaceId/;

describe("Sprint-02 — workspace ID in AuthContext", () => {
  describe("objective 1: AuthContext exposes workspaceId after auth resolves", () => {
    it("declares workspaceId on AuthState and derives it from workspace", () => {
      const source = readSrc("context/AuthContext.tsx");

      expect(source).toMatch(/workspaceId:\s*string\s*\|\s*null/);
      expect(source).toMatch(/const workspaceId = workspace\?\.workspaceId \?\? null/);
      expect(source).toMatch(/workspaceId,\s*\n\s*profileError/);
    });

    it("keeps workspace resolution centralized in refreshProfile (/auth/me or dev fallback)", () => {
      const source = readSrc("context/AuthContext.tsx");

      expect(source).toMatch(/\/auth\/me/);
      expect(source).toMatch(/\/workspaces\/default/);
      const defaultFetchCount = (source.match(/apiGet[^)]*\/workspaces\/default/g) ?? []).length;
      expect(defaultFetchCount).toBe(1);
    });
  });

  describe("objective 2: home consumers stop fetching /workspaces/default independently", () => {
    it.each(HOME_LOAD_CONSUMERS)("%s does not call GET /workspaces/default", (relativePath) => {
      const source = readSrc(relativePath);
      expect(source).not.toMatch(/apiGet[^)]*\/workspaces\/default/);
    });

    it("homepage directory has no /workspaces/default references", () => {
      const map = readSrc("components/homepage/ContextualIntelligenceMap.tsx");
      const homeData = readSrc("components/homepage/useOperationalHomeData.ts");
      expect(map + homeData).not.toContain("/workspaces/default");
    });

    it("fetchWorkspaceTelemetry accepts workspaceId and uses it in API paths", async () => {
      const mockFetch = vi.fn((url: string) => {
        const path = String(url);
        let body: unknown = { traces: [] };
        if (path.includes("/dashboard-bootstrap")) {
          body = {
            workspaceId: "ws-sprint-02",
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

      const { fetchWorkspaceTelemetry } = await import("../lib/workspaceTelemetry.js");
      const result = await fetchWorkspaceTelemetry("ws-sprint-02");

      expect(result?.workspaceId).toBe("ws-sprint-02");
      const urls = mockFetch.mock.calls.map(([u]) => String(u));
      expect(urls.some((u) => u.includes("workspaceId=ws-sprint-02"))).toBe(true);
      expect(urls.some((u) => u.includes("/workspaces/default"))).toBe(false);
    });

    it("fetchWorkspaceTelemetry returns null without issuing requests when workspaceId is empty", async () => {
      const mockFetch = vi.fn();
      vi.stubGlobal("fetch", mockFetch);
      vi.resetModules();

      const { fetchWorkspaceTelemetry } = await import("../lib/workspaceTelemetry.js");
      const result = await fetchWorkspaceTelemetry("");

      expect(result).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("objective 3: loading states remain correct", () => {
    it.each([
      "components/homepage/ContextualIntelligenceMap.tsx",
      "pages/ObservabilityPage.tsx",
    ] as const)("%s gates workspace fetches on authLoading and workspaceId", (relativePath) => {
      const source = readSrc(relativePath);
      expect(source).toMatch(AUTH_LOADING_GUARD);
    });

    it("WorkspaceTelemetryContext gates React Query fetches on authLoading and workspaceId", () => {
      const source = readSrc("context/WorkspaceTelemetryContext.tsx");
      expect(source).toMatch(TELEMETRY_QUERY_GUARD);
    });

    it("useOperationalHomeData combines provider slice loading for consumers", () => {
      const source = readSrc("components/homepage/useOperationalHomeData.ts");
      expect(source).toMatch(/useTelemetryIndicators/);
      expect(source).toMatch(/const loading = indicatorsLoading \|\| panelLoading \|\| eventsLoading/);
    });

    it("MetricsSidebar reads loading from provider slice hook", () => {
      const source = readSrc("components/layout/MetricsSidebar.tsx");
      expect(source).toMatch(/useTelemetryMetrics/);
      expect(source).toMatch(/showLoading\s*=\s*loading/);
    });

    it("ContextualIntelligenceMap shows graph loading state while fetching", () => {
      const source = readSrc("components/homepage/ContextualIntelligenceMap.tsx");
      expect(source).toMatch(/graphLoading/);
      expect(source).toMatch(/Loading relationship graph/);
    });
  });

  describe("anti-objectives", () => {
    it("ProtectedRoute still gates on workspace (unauthenticated flows unchanged)", () => {
      const source = readSrc("components/auth/ProtectedRoute.tsx");
      expect(source).toMatch(/const authenticated = Boolean\(workspace\)/);
      expect(source).toMatch(/Navigate to="\/access"/);
    });

    it("consumers do not fetch before auth resolves (early return on missing workspaceId)", () => {
      for (const relativePath of HOME_LOAD_CONSUMERS) {
        if (relativePath === "lib/workspaceTelemetry.ts") continue;
        const source = readSrc(relativePath);
        const guard =
          relativePath === "context/WorkspaceTelemetryContext.tsx"
            ? TELEMETRY_QUERY_GUARD
            : AUTH_LOADING_GUARD;
        expect(source).toMatch(guard);
      }
    });

    it("does not add duplicate workspace context — only AuthContext holds workspace state", () => {
      const authSource = readSrc("context/AuthContext.tsx");
      expect(authSource).toMatch(/createContext<AuthState/);
      expect(authSource).not.toMatch(/WorkspaceContext/);
    });
  });

  describe("home load request budget", () => {
    it("AuthContext is the sole /workspaces/default caller among sprint-scoped home files", () => {
      const scopedFiles = [
        "context/AuthContext.tsx",
        ...HOME_LOAD_CONSUMERS,
      ];
      let defaultCallers = 0;
      for (const file of scopedFiles) {
        const matches = readSrc(file).match(/apiGet[^)]*\/workspaces\/default/g);
        defaultCallers += matches?.length ?? 0;
      }
      expect(defaultCallers).toBe(1);
    });
  });
});

describe("Sprint-02 — fetchWorkspaceTelemetry network isolation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.resetModules();
  });

  it("never resolves workspace via /workspaces/default", async () => {
    const mockFetch = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ memories: [], traces: [], status: "ok", entries: [], report: { signals: [], lowConfidenceRetrievals: [], failedRetrievals: [] } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    vi.stubGlobal("fetch", mockFetch);

    const { fetchWorkspaceTelemetry } = await import("../lib/workspaceTelemetry.js");
    await fetchWorkspaceTelemetry("ws-verify");

    for (const [url] of mockFetch.mock.calls) {
      expect(String(url)).not.toContain("/workspaces/default");
    }
  });
});
