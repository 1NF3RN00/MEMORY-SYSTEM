import type { EventEmitter } from "@memory-middleware/observability";
import { HISTORIAN_EVENT_TYPES } from "@memory-middleware/shared-types";

export async function emitReplayStarted(
  events: EventEmitter,
  traceId: string,
  workspaceId: string,
  retrievalTraceId: string,
  mode: string,
): Promise<void> {
  await events.emit({
    event_type: HISTORIAN_EVENT_TYPES.REPLAY_STARTED,
    trace_id: traceId,
    workspace_id: workspaceId,
    metadata: {
      operation: "historian_replay",
      success: true,
      retrieval_trace_id: retrievalTraceId,
      replay_mode: mode,
    },
  });
}

export async function emitReplayCompleted(
  events: EventEmitter,
  traceId: string,
  workspaceId: string,
  replayId: string,
  integrityValid: boolean,
): Promise<void> {
  await events.emit({
    event_type: HISTORIAN_EVENT_TYPES.REPLAY_COMPLETED,
    trace_id: traceId,
    workspace_id: workspaceId,
    metadata: {
      operation: "historian_replay",
      success: true,
      replay_id: replayId,
      integrity_valid: integrityValid,
    },
  });
}

export async function emitBenchmarkExecuted(
  events: EventEmitter,
  traceId: string,
  workspaceId: string,
  benchmarkId: string,
  retrievalTraceId: string,
): Promise<void> {
  await events.emit({
    event_type: HISTORIAN_EVENT_TYPES.BENCHMARK_EXECUTED,
    trace_id: traceId,
    workspace_id: workspaceId,
    metadata: {
      operation: "historian_benchmark",
      success: true,
      benchmark_id: benchmarkId,
      retrieval_trace_id: retrievalTraceId,
    },
  });
}

export async function emitDriftDetected(
  events: EventEmitter,
  traceId: string,
  workspaceId: string,
  signalCount: number,
): Promise<void> {
  await events.emit({
    event_type: HISTORIAN_EVENT_TYPES.DRIFT_DETECTED,
    trace_id: traceId,
    workspace_id: workspaceId,
    severity: signalCount > 0 ? "warn" : "info",
    metadata: {
      operation: "historian_drift",
      success: true,
      signal_count: signalCount,
    },
  });
}

export async function emitRetentionArchived(
  events: EventEmitter,
  traceId: string,
  workspaceId: string,
  archivedCount: number,
  retentionMode: string,
): Promise<void> {
  await events.emit({
    event_type: HISTORIAN_EVENT_TYPES.RETENTION_ARCHIVED,
    trace_id: traceId,
    workspace_id: workspaceId,
    metadata: {
      operation: "historian_retention",
      success: true,
      archived_count: archivedCount,
      retention_mode: retentionMode,
    },
  });
}

export async function emitPermanentDeletionExecuted(
  events: EventEmitter,
  traceId: string,
  workspaceId: string,
  deletedId: string,
  removedCounts: Record<string, number>,
): Promise<void> {
  await events.emit({
    event_type: HISTORIAN_EVENT_TYPES.PERMANENT_DELETION_EXECUTED,
    trace_id: traceId,
    workspace_id: workspaceId,
    severity: "warn",
    metadata: {
      operation: "historian_permanent_deletion",
      success: true,
      deleted_id: deletedId,
      ...removedCounts,
    },
  });
}
