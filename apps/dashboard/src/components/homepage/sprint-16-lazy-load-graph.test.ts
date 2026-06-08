/**
 * Sprint-16 verification: Lazy-load relationship graph on home map (OP-14)
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dashboardSrc = join(__dirname, "../..");

function readSrc(relativePath: string): string {
  return readFileSync(join(dashboardSrc, relativePath), "utf8");
}

describe("Sprint-16 — lazy-load relationship graph", () => {
  describe("objective 1: graph not in critical path", () => {
    it("ContextualIntelligenceMap gates graph fetch on telemetryReady and mapInView", () => {
      const source = readSrc("components/homepage/ContextualIntelligenceMap.tsx");
      expect(source).toMatch(/telemetryReady/);
      expect(source).toMatch(/mapInView/);
      expect(source).toMatch(/if \(!mapInView \|\| !telemetryReady\) return/);
    });

    it("HomePage passes telemetryReady after operational telemetry resolves", () => {
      const home = readSrc("pages/HomePage.tsx");
      expect(home).toMatch(/telemetryReady=\{!loading\}/);
    });

    it("useOperationalHomeData does not fetch relationship graph", () => {
      const source = readSrc("components/homepage/useOperationalHomeData.ts");
      expect(source).not.toMatch(/relationships\/graph/);
    });
  });

  describe("objective 2: Intersection Observer deferred fetch", () => {
    it("ContextualIntelligenceMap uses IntersectionObserver on map container", () => {
      const source = readSrc("components/homepage/ContextualIntelligenceMap.tsx");
      expect(source).toMatch(/new IntersectionObserver/);
      expect(source).toMatch(/setMapInView\(true\)/);
      expect(source).toMatch(/observer\.disconnect\(\)/);
    });

    it("graph fetch starts only once per workspace via graphFetchStartedRef", () => {
      const source = readSrc("components/homepage/ContextualIntelligenceMap.tsx");
      expect(source).toMatch(/graphFetchStartedRef/);
      expect(source).toMatch(/if \(graphFetchStartedRef\.current\) return/);
      expect(source).toMatch(/graphFetchStartedRef\.current = true/);
    });
  });

  describe("objective 3: loading skeleton", () => {
    it("ContextualIntelligenceMap renders GraphLoadingSkeleton while deferred or loading", () => {
      const source = readSrc("components/homepage/ContextualIntelligenceMap.tsx");
      expect(source).toMatch(/function GraphLoadingSkeleton/);
      expect(source).toMatch(/<GraphLoadingSkeleton \/>/);
      expect(source).toMatch(/animate-pulse/);
      expect(source).toMatch(/Loading relationship graph/);
    });
  });

  describe("anti-objectives", () => {
    it("IntersectionObserver disconnects after first visibility (scroll-to-map still triggers fetch)", () => {
      const source = readSrc("components/homepage/ContextualIntelligenceMap.tsx");
      expect(source).toMatch(/entry\?\.isIntersecting/);
      expect(source).toMatch(/rootMargin:\s*"80px 0px"/);
    });

    it("RelationshipMapPage still fetches graph immediately (graph-first page)", () => {
      const source = readSrc("pages/RelationshipMapPage.tsx");
      expect(source).toMatch(/useEffect\(\(\) => \{[\s\S]*?if \(!workspaceId\) return/);
      expect(source).not.toMatch(/IntersectionObserver/);
      expect(source).not.toMatch(/telemetryReady/);
    });

    it("workspace change resets fetch guard to avoid duplicate or stale loops", () => {
      const source = readSrc("components/homepage/ContextualIntelligenceMap.tsx");
      expect(source).toMatch(/graphFetchStartedRef\.current = false/);
      expect(source).toMatch(/setGraphStatus\("idle"\)/);
    });
  });

  describe("verification framework checklist", () => {
    it("1. waterfall: graph fetch runs only after telemetryReady and mapInView", () => {
      const map = readSrc("components/homepage/ContextualIntelligenceMap.tsx");
      const home = readSrc("pages/HomePage.tsx");
      const telemetry = readSrc("components/homepage/useOperationalHomeData.ts");

      expect(map).toMatch(/if \(!mapInView \|\| !telemetryReady\) return/);
      expect(map).toMatch(/\}, \[authLoading, workspaceId, mapInView, telemetryReady\]\)/);
      expect(home).toMatch(/telemetryReady=\{!loading\}/);
      expect(telemetry).not.toMatch(/relationships\/graph/);
    });

    it("2. map renders canvas when graph data is ready (skeleton while deferred)", () => {
      const source = readSrc("components/homepage/ContextualIntelligenceMap.tsx");

      expect(source).toMatch(/graphLoading \?/);
      expect(source).toMatch(/<GraphLoadingSkeleton \/>/);
      expect(source).toMatch(/<canvas ref=\{canvasRef\}/);
      expect(source).toMatch(
        /graphStatus === "loading" \|\| graphStatus === "idle"/,
      );
    });

    it("3. no duplicate fetches: single graph apiGet guarded by graphFetchStartedRef", () => {
      const source = readSrc("components/homepage/ContextualIntelligenceMap.tsx");
      const graphApiCalls = source.match(/relationships\/graph/g) ?? [];

      expect(graphApiCalls).toHaveLength(1);
      expect(source).toMatch(/if \(graphFetchStartedRef\.current\) return/);
      expect(source).toMatch(/graphFetchStartedRef\.current = true/);
    });
  });
});
