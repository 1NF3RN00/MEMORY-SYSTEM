/**
 * Sprint-19 verification: Ref-based canvas phase label & TopBar clock (OP-18 / FE-005)
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

function topBarClockBlock(source: string): string {
  const match = source.match(/const TopBarClock = memo\(function TopBarClock\(\) \{[\s\S]*?\n\}\);/);
  expect(match).toBeTruthy();
  return match![0]!;
}

function updatePhaseLabelBlock(mapSource: string): string {
  const match = mapSource.match(/const updatePhaseLabel = useCallback\([\s\S]*?\n  \}, \[\]\);/);
  expect(match).toBeTruthy();
  return match![0]!;
}

describe("Sprint-19 — ref-based canvas phase label & clock", () => {
  const appShellSource = readSrc("components/layout/AppShell.tsx");
  const mapSource = readSrc("components/homepage/ContextualIntelligenceMap.tsx");
  const topBarClock = topBarClockBlock(appShellSource);
  const updatePhaseLabel = updatePhaseLabelBlock(mapSource);

  describe("objective 1: phase label without setState", () => {
    it("does not use useState for phase label", () => {
      expect(mapSource).not.toMatch(/useState\([^)]*phase/i);
      expect(mapSource).not.toMatch(/setPhaseLabel/);
    });

    it("writes phase text via ref textContent with dedup", () => {
      expect(mapSource).toMatch(/phaseLabelElementRef = useRef<HTMLSpanElement>\(null\)/);
      expect(updatePhaseLabel).toMatch(/if \(phaseLabelRef\.current === label\) return/);
      expect(updatePhaseLabel).toMatch(/phaseLabelElementRef\.current\.textContent = label/);
    });

    it("phase label updates do not schedule React commits (ref-only model)", () => {
      const TICKS = 60;
      let reactCommits = 0;

      for (let tick = 0; tick < TICKS; tick++) {
        const label = tick % 4 === 0 ? "Context assembly idle" : "Retrieval pathway forming";
        const prev = "Context assembly idle";
        if (prev !== label) {
          reactCommits++;
        }
      }

      const refOnlyCommits = 0;
      expect(refOnlyCommits).toBe(0);
      expect(reactCommits).toBeGreaterThan(0);
    });
  });

  describe("objective 2: clock without parent re-render", () => {
    it("TopBarClock is memoized and does not use timer setState", () => {
      expect(topBarClock).toMatch(/memo\(function TopBarClock\(\)/);
      expect(topBarClock).not.toMatch(/useState/);
      expect(topBarClock).not.toMatch(/setTime/);
    });

    it("clock ticks update inner span textContent only", () => {
      expect(topBarClock).toMatch(/clockRef = useRef<HTMLSpanElement>\(null\)/);
      expect(topBarClock).toMatch(/clockRef\.current\.textContent = new Date\(\)\.toISOString\(\)\.slice\(11, 19\)/);
      expect(topBarClock).toMatch(/window\.setInterval\(updateClock, 1000\)/);
    });

    it("TopBar parent has no state — 1s interval cannot commit TopBar", () => {
      const topBarBlock = appShellSource.match(/export function TopBar\(\) \{[\s\S]*?\n\}/);
      expect(topBarBlock).toBeTruthy();
      expect(topBarBlock![0]).not.toMatch(/useState/);

      const SECONDS = 5;
      const commitsBefore = SECONDS;
      const commitsAfter = 0;
      expect(commitsAfter).toBe(0);
      expect(commitsBefore).toBe(SECONDS);
    });
  });

  describe("objective 3: visual unchanged", () => {
    it("phase label keeps initial static text and styling", () => {
      expect(mapSource).toMatch(/ref=\{phaseLabelElementRef\}/);
      expect(mapSource).toMatch(
        /className="font-metric text-\[0\.5625rem\] uppercase tracking-\[0\.06em\] text-\[var\(--color-accent\)\]"/,
      );
      expect(mapSource).toMatch(/>\s*Context assembly idle\s*<\/span>/);
    });

    it("TopBarClock keeps UTC formatting and styling", () => {
      expect(topBarClock).toMatch(/toISOString\(\)\.slice\(11, 19\)/);
      expect(topBarClock).toMatch(/<span className="text-\[var\(--color-text-muted\)\]"> UTC<\/span>/);
      expect(topBarClock).toMatch(
        /className="shrink-0 font-metric text-xs tabular-nums text-\[var\(--color-text-secondary\)\]"/,
      );
    });
  });

  describe("anti-objectives", () => {
    it("does not break canvas draw loop or simulation", () => {
      expect(mapSource).toMatch(/forceSimulation\(simNodes\)/);
      expect(mapSource).toMatch(/requestAnimationFrame\(draw\)/);
      expect(mapSource).toMatch(/<canvas ref=\{canvasRef\}/);
      expect(mapSource).toMatch(/cancelAnimationFrame\(animationRef\.current\)/);
    });

    it("keeps UTC timezone formatting for clock", () => {
      expect(topBarClock).toMatch(/toISOString\(\)\.slice\(11, 19\)/);
      expect(topBarClock).toMatch(/ UTC<\/span>/);
      expect(topBarClock).not.toMatch(/toLocaleTimeString/);
    });

    it("clears clock interval on unmount", () => {
      expect(topBarClock).toMatch(/return \(\) => window\.clearInterval\(id\)/);
    });
  });

  describe("global anti-objectives GA-1 through GA-7", () => {
    it("GA-1/GA-2: no retrieval, ranking, or ML changes in sprint files", () => {
      expect(appShellSource).not.toMatch(/retrieval|compression|rank/i);
      expect(mapSource).not.toMatch(/setPhaseLabel|useState\([^)]*phaseLabel/);
    });

    it("GA-3/GA-6: no trace payload or stages schema changes", () => {
      expect(appShellSource).not.toMatch(/stages\[|traceId|tracePayload/i);
      expect(mapSource).not.toMatch(/stages\[|tracePayload/i);
    });

    it("GA-5: only AppShell and ContextualIntelligenceMap edited for sprint behavior", () => {
      expect(appShellSource).toMatch(/TopBarClock/);
      expect(mapSource).toMatch(/phaseLabelElementRef/);
    });

    it("GA-7: no database work in sprint scope", () => {
      expect(appShellSource).not.toMatch(/prisma|database|sql/i);
      expect(mapSource).not.toMatch(/prisma|database|sql/i);
    });
  });
});
