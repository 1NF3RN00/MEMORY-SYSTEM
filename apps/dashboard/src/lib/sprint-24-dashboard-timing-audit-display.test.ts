/**
 * Sprint-24 verification: Dashboard timingAudit display in RetrievalTimeline
 * OP-23 — hrtime stages in UI with legacy fallback
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { ExecutionTimingAudit } from "@memory-middleware/shared-types";
import type { StageRecord } from "../components/observability/RetrievalTimeline.js";
import {
  formatDurationMs,
  formatTimingStageLabel,
  resolveTimelineStages,
} from "./timelineTiming.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dashboardSrc = join(__dirname, "..");
const repoRoot = join(__dirname, "../../../..");

function readSrc(relativePath: string): string {
  return readFileSync(join(dashboardSrc, relativePath), "utf8");
}

function readRepo(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), "utf8");
}

const SAMPLE_TIMING_AUDIT: ExecutionTimingAudit = {
  requestId: "01JSPRINT24RETRIEVALTRACE001",
  totalLatency: 42.125,
  stages: [
    {
      stage: "retrieval",
      startTime: "2026-06-08T12:00:00.000Z",
      endTime: "2026-06-08T12:00:00.042Z",
      durationMs: 40.5,
    },
    {
      stage: "vector_search:embedding",
      startTime: "2026-06-08T12:00:00.001Z",
      endTime: "2026-06-08T12:00:00.015Z",
      durationMs: 14.375,
    },
    {
      stage: "intent_extraction",
      startTime: "2026-06-08T12:00:00.000Z",
      endTime: "2026-06-08T12:00:00.002Z",
      durationMs: 1.625,
    },
  ],
};

const LEGACY_STAGES: StageRecord[] = [
  { stage: "preprocessing", status: "completed", latencyMs: 2 },
  { stage: "vector_retrieval", status: "completed", latencyMs: 18 },
];

describe("Sprint-24 — Dashboard timingAudit display", () => {
  describe("objective 1: hrtime stages in UI", () => {
    it("prefers timingAudit stages when present", () => {
      const resolved = resolveTimelineStages({
        timingAudit: SAMPLE_TIMING_AUDIT,
        legacyStages: LEGACY_STAGES,
      });
      expect(resolved.source).toBe("hrtime");
      expect(resolved.stages).toHaveLength(3);
      expect(resolved.stages[0]?.stage).toBe("retrieval");
      expect(resolved.totalLatencyMs).toBe(42.125);
    });

    it("formats sub-millisecond hrtime durations", () => {
      expect(formatDurationMs(42.125)).toBe("42.125");
      expect(formatDurationMs(14.375)).toBe("14.375");
      expect(formatDurationMs(1.625)).toBe("1.625");
      expect(formatDurationMs(8968.67)).toBe("8968.67");
      expect(formatDurationMs(42)).toBe("42");
    });

    it("RetrievalTimeline accepts timingAudit prop and renders hrtime badge", () => {
      const source = readSrc("components/observability/RetrievalTimeline.tsx");
      expect(source).toMatch(/timingAudit\?: ExecutionTimingAudit/);
      expect(source).toMatch(/resolveTimelineStages/);
      expect(source).toMatch(/formatDurationMs/);
      expect(source).toMatch(/hrtime/);
    });

    it("RetrievalTracesPage passes timingAudit from trace detail", () => {
      const source = readSrc("pages/RetrievalTracesPage.tsx");
      expect(source).toMatch(/timingAudit\?: ExecutionTimingAudit/);
      expect(source).toMatch(/timingAudit: trace\.timingAudit/);
    });
  });

  describe("objective 2: fallback to legacy stages[]", () => {
    it("falls back when timingAudit is absent", () => {
      const resolved = resolveTimelineStages({
        legacyStages: LEGACY_STAGES,
        legacyTotalLatencyMs: 20,
      });
      expect(resolved.source).toBe("legacy");
      expect(resolved.stages).toEqual(LEGACY_STAGES);
      expect(resolved.totalLatencyMs).toBe(20);
    });

    it("falls back when timingAudit has empty stages", () => {
      const resolved = resolveTimelineStages({
        timingAudit: { requestId: "x", totalLatency: 0, stages: [] },
        legacyStages: LEGACY_STAGES,
      });
      expect(resolved.source).toBe("legacy");
      expect(resolved.stages).toEqual(LEGACY_STAGES);
    });

    it("HistorianPage keeps legacy-only timeline wiring", () => {
      const source = readSrc("pages/HistorianPage.tsx");
      expect(source).toMatch(/<RetrievalTimeline stages=\{timelineStages\}/);
      expect(source).not.toMatch(/timingAudit/);
    });
  });

  describe("objective 3: no new page", () => {
    it("does not add a new dashboard route", () => {
      const source = readSrc("App.tsx");
      expect(source).not.toMatch(/timing-audit|timingAudit/i);
    });
  });

  describe("anti-objective: correct hierarchy labels", () => {
    it("splits colon-delimited stage names into primary and sub labels", () => {
      expect(formatTimingStageLabel("vector_search:embedding")).toEqual({
        primary: "Vector Search",
        sub: "Embedding",
      });
      expect(formatTimingStageLabel("api_handler:POST /retrieve")).toEqual({
        primary: "Api Handler",
        sub: "POST /retrieve",
      });
      expect(formatTimingStageLabel("intent_extraction")).toEqual({
        primary: "Intent Extraction",
      });
    });

    it("RetrievalTimeline uses hierarchy labels for hrtime stages", () => {
      const source = readSrc("components/observability/RetrievalTimeline.tsx");
      expect(source).toMatch(/formatTimingStageLabel/);
      expect(source).toMatch(/stageLabel\.sub/);
    });
  });

  describe("anti-objective: no extra fetches", () => {
    it("RetrievalTracesPage does not add timingAudit fetch", () => {
      const source = readSrc("pages/RetrievalTracesPage.tsx");
      expect(source).not.toMatch(/apiGet<[^>]*timingAudit|\/timing-audit|\/timingAudit/);
      expect(source).toMatch(/timingAudit: trace\.timingAudit/);
    });

    it("persists timingAudit on retrieval trace result for GET reuse", () => {
      const store = readRepo("apps/api/src/lib/retrieval-store.ts");
      expect(store).toMatch(/timingAudit\?: ExecutionTimingAudit/);
      expect(store).toMatch(/timingAudit: result\.timingAudit/);

      const route = readRepo("apps/api/src/routes/retrieval.ts");
      expect(route).toMatch(/timingAudit: request\.timingCollector\.toAudit\(\)/);
    });
  });

  describe("anti-objective: do not break timeline", () => {
    it("RetrievalTimeline keeps legacy stages prop optional", () => {
      const source = readSrc("components/observability/RetrievalTimeline.tsx");
      expect(source).toMatch(/stages\?: StageRecord\[\]/);
      expect(source).toMatch(/legacyStages: stages/);
    });
  });
});
