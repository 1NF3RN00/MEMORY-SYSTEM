import {
  buildOperationalDiagnostics,
  toOperationalDiagnosticsSlimReport,
  type TraceDiagnosticInput,
} from "@memory-middleware/historian";
import type {
  OperationalDiagnosticsReport,
  OperationalDiagnosticsSlimReport,
  ReplaySnapshot,
} from "@memory-middleware/shared-types";
import type { StoredRetrievalResult } from "./retrieval-store.js";

export type RetrievalTraceSummary = {
  retrievalTraceId: string;
  query: string;
  status: string;
  createdAt: string;
};

export function enrichTracesForOperationalDiagnostics(
  traces: RetrievalTraceSummary[],
  resultsByTraceId: Map<string, StoredRetrievalResult | { error?: string; failedStage?: string }>,
  snapshotByTrace: Map<string, ReplaySnapshot>,
): TraceDiagnosticInput[] {
  return traces.map((t) => {
    const result = resultsByTraceId.get(t.retrievalTraceId) ?? {};
    const failedStage =
      "stages" in result && Array.isArray(result.stages)
        ? result.stages.find((s) => s.status === "failed")?.stage
        : "failedStage" in result
          ? result.failedStage
          : undefined;
    const error = "error" in result ? result.error : undefined;
    const snapshot = snapshotByTrace.get(t.retrievalTraceId);
    return {
      retrievalTraceId: t.retrievalTraceId,
      query: t.query,
      status: t.status,
      createdAt: t.createdAt,
      ...(error ? { error } : {}),
      ...(failedStage ? { failedStage } : {}),
      ...(snapshot ? { snapshot } : {}),
    };
  });
}

export function buildFullOperationalDiagnosticsReport(
  workspaceId: string,
  enrichedTraces: TraceDiagnosticInput[],
): OperationalDiagnosticsReport {
  return buildOperationalDiagnostics(workspaceId, enrichedTraces);
}

export function buildSlimOperationalDiagnosticsReport(
  workspaceId: string,
  enrichedTraces: TraceDiagnosticInput[],
): OperationalDiagnosticsSlimReport {
  const full = buildOperationalDiagnostics(workspaceId, enrichedTraces);
  return toOperationalDiagnosticsSlimReport(full);
}
