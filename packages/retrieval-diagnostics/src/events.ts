import type { EventEmitter } from "@memory-middleware/observability";
import { RETRIEVAL_DIAGNOSTICS_EVENT_TYPES } from "@memory-middleware/shared-types";

export async function emitDiagnosticsReportGenerated(
  events: EventEmitter,
  traceId: string,
  workspaceId: string,
  reportId: string,
  retrievalTraceId: string,
  problemCount: number,
): Promise<void> {
  await events.emit({
    event_type: RETRIEVAL_DIAGNOSTICS_EVENT_TYPES.REPORT_GENERATED,
    trace_id: traceId,
    workspace_id: workspaceId,
    metadata: {
      operation: "retrieval_diagnostics",
      success: true,
      report_id: reportId,
      retrieval_trace_id: retrievalTraceId,
      problem_count: problemCount,
    },
  });
}

export async function emitCalibrationChanged(
  events: EventEmitter,
  traceId: string,
  workspaceId: string,
  changeCount: number,
  section: string,
): Promise<void> {
  await events.emit({
    event_type: RETRIEVAL_DIAGNOSTICS_EVENT_TYPES.CALIBRATION_CHANGED,
    trace_id: traceId,
    workspace_id: workspaceId,
    metadata: {
      operation: "calibration_change",
      success: true,
      change_count: changeCount,
      section,
    },
  });
}

export async function emitCalibrationBenchmarkExecuted(
  events: EventEmitter,
  traceId: string,
  workspaceId: string,
  benchmarkId: string,
  retrievalTraceId: string,
): Promise<void> {
  await events.emit({
    event_type: RETRIEVAL_DIAGNOSTICS_EVENT_TYPES.CALIBRATION_BENCHMARK_EXECUTED,
    trace_id: traceId,
    workspace_id: workspaceId,
    metadata: {
      operation: "calibration_benchmark",
      success: true,
      benchmark_id: benchmarkId,
      retrieval_trace_id: retrievalTraceId,
    },
  });
}

export async function emitTraceAnalysisCompleted(
  events: EventEmitter,
  traceId: string,
  workspaceId: string,
  retrievalTraceId: string,
  stageCount: number,
): Promise<void> {
  await events.emit({
    event_type: RETRIEVAL_DIAGNOSTICS_EVENT_TYPES.TRACE_ANALYSIS_COMPLETED,
    trace_id: traceId,
    workspace_id: workspaceId,
    metadata: {
      operation: "trace_analysis",
      success: true,
      retrieval_trace_id: retrievalTraceId,
      stage_count: stageCount,
    },
  });
}
