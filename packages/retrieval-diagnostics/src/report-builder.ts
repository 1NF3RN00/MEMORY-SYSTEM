import type {
  BuildReportInput,
  RetrievalSystemReport,
  WorkspaceDiagnosticsSummary,
} from "@memory-middleware/shared-types";
import { newUlid } from "@memory-middleware/shared-types";
import { computeRetrievalQualityMetrics, averageMetrics } from "./metrics.js";
import { countProblemsByStage, detectProblems } from "./problem-detection.js";
import { normalizeReportInput } from "./snapshot-normalize.js";

export function buildRetrievalSystemReport(input: BuildReportInput): RetrievalSystemReport {
  const normalized = normalizeReportInput(input);
  const metrics = computeRetrievalQualityMetrics(normalized);
  const detectedProblems = detectProblems(metrics, normalized);

  return {
    reportId: newUlid(),
    retrievalTraceId: normalized.snapshot.retrievalTraceId,
    query: normalized.snapshot.originalQuery,
    metrics,
    detectedProblems,
    generatedAt: new Date().toISOString(),
  };
}

export function buildWorkspaceDiagnosticsSummary(
  workspaceId: string,
  reports: RetrievalSystemReport[],
): WorkspaceDiagnosticsSummary {
  return {
    workspaceId,
    traceCount: reports.length,
    averageMetrics: averageMetrics(reports.map((r) => r.metrics)),
    problemFrequency: countProblemsByStage(reports),
    recentReports: reports.slice(0, 20),
    generatedAt: new Date().toISOString(),
  };
}
