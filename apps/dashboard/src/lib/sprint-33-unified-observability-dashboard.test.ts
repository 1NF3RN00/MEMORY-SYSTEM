/**
 * Sprint-33 verification: Unified observability dashboard
 * Correlate timing + LLM + DB per traceId in one read-only pane.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type {
  ExecutionTimingAudit,
  LlmCallAudit,
  RetrievalDbObservability,
} from "@memory-middleware/shared-types";
import {
  buildObservabilitySummary,
  hasDbData,
  hasLlmData,
  hasTimingData,
  observabilityTraceHref,
  parseObservabilitySubview,
} from "./traceObservability.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dashboardSrc = join(__dirname, "..");
const repoRoot = join(__dirname, "../../../..");

function readSrc(relativePath: string): string {
  return readFileSync(join(dashboardSrc, relativePath), "utf8");
}

function readRepo(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), "utf8");
}

const SAMPLE_TIMING: ExecutionTimingAudit = {
  requestId: "01JSPRINT33TRACE001",
  totalLatency: 88.5,
  stages: [
    {
      stage: "retrieval",
      startTime: "2026-06-08T12:00:00.000Z",
      endTime: "2026-06-08T12:00:00.088Z",
      durationMs: 88.5,
    },
  ],
};

const SAMPLE_LLM: LlmCallAudit = {
  requestId: "01JSPRINT33TRACE001",
  totalPromptTokens: 120,
  totalCompletionTokens: 40,
  totalLatencyMs: 450,
  totalCostUsd: 0.0024,
  calls: [
    {
      operation: "embedding",
      model: "text-embedding-3-small",
      promptTokens: 120,
      completionTokens: 0,
      latencyMs: 450,
      costUsd: 0.0024,
      timestamp: "2026-06-08T12:00:00.010Z",
    },
  ],
};

const SAMPLE_DB: RetrievalDbObservability = {
  retrievalId: "01JSPRINT33TRACE001",
  totalQueries: 5,
  totalDbTime: 32.5,
  slowQueries: [
    {
      queryId: "q1",
      model: "MemoryChunk",
      operation: "findMany",
      durationMs: 18.2,
      fingerprint: "abc123fingerprint",
      isSlow: true,
      timestamp: "2026-06-08T12:00:00.020Z",
    },
  ],
  duplicateQueries: [
    {
      fingerprint: "dup456fingerprint",
      count: 3,
      totalDurationMs: 9.6,
      sample: {
        queryId: "q2",
        model: "MemoryObject",
        operation: "findUnique",
        durationMs: 3.2,
        fingerprint: "dup456fingerprint",
        isSlow: false,
        timestamp: "2026-06-08T12:00:00.030Z",
      },
    },
  ],
};

describe("Sprint-33 — Unified observability dashboard", () => {
  describe("objective 1: all three audits on trace detail", () => {
    it("builds summary from timing, LLM, and DB audits", () => {
      const summary = buildObservabilitySummary({
        timingAudit: SAMPLE_TIMING,
        llmCallAudit: SAMPLE_LLM,
        dbObservability: SAMPLE_DB,
      });
      expect(summary.timingMs).toBe(88.5);
      expect(summary.llmCalls).toBe(1);
      expect(summary.llmTokens).toBe(160);
      expect(summary.dbQueries).toBe(5);
      expect(summary.slowQueryCount).toBe(1);
      expect(summary.duplicateQueryCount).toBe(1);
    });

    it("TraceObservabilityPanel renders timing, LLM, and DB sections", () => {
      const source = readSrc("components/observability/TraceObservabilityPanel.tsx");
      expect(source).toMatch(/Execution Timing/);
      expect(source).toMatch(/LLM Call Audit/);
      expect(source).toMatch(/Database Query Audit/);
      expect(source).toMatch(/RetrievalTimeline/);
    });

    it("RetrievalTracesPage wires all three audit fields into unified panel", () => {
      const source = readSrc("pages/RetrievalTracesPage.tsx");
      expect(source).toMatch(/TraceObservabilityPanel/);
      expect(source).toMatch(/timingAudit: trace\.timingAudit/);
      expect(source).toMatch(/llmCallAudit: trace\.llmCallAudit/);
      expect(source).toMatch(/dbObservability: trace\.dbObservability/);
      expect(source).not.toMatch(/<RetrievalTimeline/);
    });
  });

  describe("objective 2: link from list", () => {
    it("builds observability deep link with view query param", () => {
      expect(observabilityTraceHref("01JTRACE")).toBe(
        "/retrieval-traces/01JTRACE?view=observability",
      );
    });

    it("RetrievalTracesPage list links to observability subview", () => {
      const source = readSrc("pages/RetrievalTracesPage.tsx");
      expect(source).toMatch(/observabilityTraceHref/);
      expect(source).toMatch(/Observability/);
    });

    it("ObservabilityPage request traces link to observability subview", () => {
      const source = readSrc("pages/ObservabilityPage.tsx");
      expect(source).toMatch(/observabilityTraceHref/);
    });

    it("RetrievalTracesPage scrolls and highlights observability panel on deep link", () => {
      const source = readSrc("pages/RetrievalTracesPage.tsx");
      expect(source).toMatch(/scrollIntoView/);
      expect(source).toMatch(/highlightObservability/);
      expect(source).toMatch(/ref=\{observabilityRef\}/);
    });
  });

  describe("objective 3: read-only", () => {
    it("TraceObservabilityPanel has no mutation controls", () => {
      const source = readSrc("components/observability/TraceObservabilityPanel.tsx");
      expect(source).not.toMatch(/apiPost|apiPut|apiDelete|onSubmit|type="submit"/);
      expect(source).toMatch(/type="button"/);
    });
  });

  describe("anti-objective: partial data OK on old traces", () => {
    it("detects missing audit sections independently", () => {
      expect(hasTimingData({ timingAudit: SAMPLE_TIMING })).toBe(true);
      expect(hasLlmData({})).toBe(false);
      expect(hasDbData({})).toBe(false);
    });

    it("builds summary with only timing when LLM and DB are absent", () => {
      const summary = buildObservabilitySummary({ timingAudit: SAMPLE_TIMING });
      expect(summary.timingMs).toBe(88.5);
      expect(summary.llmCalls).toBe(0);
      expect(summary.dbQueries).toBe(0);
      expect(summary.slowQueryCount).toBe(0);
    });

    it("builds summary with only DB when timing and LLM are absent", () => {
      const summary = buildObservabilitySummary({ dbObservability: SAMPLE_DB });
      expect(summary.timingSource).toBe("none");
      expect(summary.dbQueries).toBe(5);
      expect(summary.llmCalls).toBe(0);
    });

    it("shows graceful unavailable messages for missing DB data", () => {
      const source = readSrc("components/observability/TraceObservabilityPanel.tsx");
      expect(source).toMatch(/No database observability on this trace/);
      expect(source).toMatch(/Older traces may predate DB instrumentation/);
    });

    it("parseObservabilitySubview accepts observability and section views", () => {
      expect(parseObservabilitySubview("observability")).toBeUndefined();
      expect(parseObservabilitySubview("llm")).toBe("llm");
      expect(parseObservabilitySubview("db")).toBe("db");
      expect(parseObservabilitySubview("timing")).toBe("timing");
    });
  });

  describe("anti-objective: no unnecessary duplication", () => {
    it("replaces standalone Pipeline Timeline panel with unified observability", () => {
      const source = readSrc("pages/RetrievalTracesPage.tsx");
      expect(source).toMatch(/Unified Observability/);
      expect(source).not.toMatch(/Pipeline Timeline/);
    });
  });

  describe("anti-objective: no new tables + persisted audits on GET", () => {
    it("persists llmCallAudit and returns dbObservability from retrieval store", () => {
      const store = readRepo("apps/api/src/lib/retrieval-store.ts");
      expect(store).toMatch(/llmCallAudit\?: LlmCallAudit/);
      expect(store).toMatch(/dbObservability: result\.dbObservability/);
      expect(store).toMatch(/llmCallAudit: result\.llmCallAudit/);
    });

    it("retrieval route persists llmCallAudit on completion", () => {
      const route = readRepo("apps/api/src/routes/retrieval.ts");
      expect(route).toMatch(/llmCallAudit: request\.llmCallCollector\.toAudit\(\)/);
      expect(route).toMatch(/dbObservability: storedDbObservability/);
    });

    it("RetrievalTraceView contract includes both audit fields", () => {
      const contracts = readRepo("packages/shared-types/src/retrieval-contracts.ts");
      expect(contracts).toMatch(/llmCallAudit\?: LlmCallAudit/);
      expect(contracts).toMatch(/dbObservability\?: RetrievalDbObservability/);
    });
  });
});
