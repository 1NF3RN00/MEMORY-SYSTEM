import { Prisma, type PrismaClient } from "@prisma/client";
import {
  applyCalibrationToWorkspaceConfig,
  buildCalibrationChangeRecords,
  clampCalibrationValue,
  computeMetricDeltas,
  computeRetrievalQualityMetrics,
  mergeSystemCalibration,
  resolveDefaultsFromRuntime,
  CALIBRATION_BOUNDS,
} from "@memory-middleware/retrieval-diagnostics";
import { getReplaySnapshotByTraceId } from "./historian-store.js";
import type {
  BuildReportInput,
  CalibrationChangeRecord,
  CalibrationPatchRequest,
  CalibrationThresholdMode,
  CalibrationView,
  SystemCalibrationConfig,
  WorkspaceConfig,
} from "@memory-middleware/shared-types";
import { RETRIEVAL_DIAGNOSTICS_EVENT_TYPES } from "@memory-middleware/shared-types";
import type { StoredRetrievalResult } from "./retrieval-store.js";
import { getWorkspaceRetrievalConfig } from "./retrieval-store.js";

const HISTORY_EVENT = RETRIEVAL_DIAGNOSTICS_EVENT_TYPES.CALIBRATION_CHANGED;

function parseStoredCalibration(config: Record<string, unknown>): Partial<SystemCalibrationConfig> | null {
  const calibration = config.calibration;
  if (!calibration || typeof calibration !== "object") return null;
  return calibration as Partial<SystemCalibrationConfig>;
}

export async function getCalibrationView(
  prisma: PrismaClient,
  workspaceId: string,
): Promise<CalibrationView | null> {
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) return null;

  const config = workspace.config as Record<string, unknown>;
  const wsConfig = await getWorkspaceRetrievalConfig(prisma, workspaceId);
  const stored = parseStoredCalibration(config);
  const merged = mergeSystemCalibration(wsConfig, stored);
  const history = await loadCalibrationHistory(prisma, workspaceId);

  return {
    workspaceId,
    config: merged,
    defaults: resolveDefaultsFromRuntime(),
    history,
  };
}

export async function loadCalibrationHistory(
  prisma: PrismaClient,
  workspaceId: string,
  limit = 50,
): Promise<CalibrationChangeRecord[]> {
  const events = await prisma.eventLog.findMany({
    where: {
      workspaceId,
      eventType: HISTORY_EVENT,
    },
    orderBy: { timestamp: "desc" },
    take: limit,
  });

  const records: CalibrationChangeRecord[] = [];
  for (const event of events) {
    const payload = event.payload as { changes?: CalibrationChangeRecord[] };
    if (Array.isArray(payload.changes)) {
      records.push(...payload.changes);
    }
  }

  return records.sort(
    (a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime(),
  );
}

export async function patchCalibration(
  prisma: PrismaClient,
  request: CalibrationPatchRequest,
): Promise<{ view: CalibrationView; changes: CalibrationChangeRecord[] } | { error: string }> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: request.workspaceId },
  });
  if (!workspace) return { error: "Workspace not found" };

  const config = workspace.config as Record<string, unknown>;
  const wsConfig = await getWorkspaceRetrievalConfig(prisma, request.workspaceId);
  const stored = parseStoredCalibration(config);
  const previous = mergeSystemCalibration(wsConfig, stored);

  const sectionBounds = CALIBRATION_BOUNDS[request.section];
  const sectionValues = { ...previous[request.section] } as Record<string, number | string>;

  for (const [field, value] of Object.entries(request.values)) {
    if (field === "thresholdMode" && request.section === "retrieval") {
      const modes: CalibrationThresholdMode[] = ["strict", "balanced", "exploratory", "calibration"];
      if (typeof value === "string" && modes.includes(value as CalibrationThresholdMode)) {
        sectionValues[field] = value;
      }
      continue;
    }
    if (typeof value !== "number" || Number.isNaN(value)) continue;
    const bounds = sectionBounds[field];
    if (!bounds) continue;
    sectionValues[field] = clampCalibrationValue(value, bounds[0], bounds[1]);
  }

  const next: SystemCalibrationConfig = {
    ...previous,
    [request.section]: sectionValues,
  } as SystemCalibrationConfig;

  let changes = buildCalibrationChangeRecords(
    request.workspaceId,
    request.section,
    previous,
    next,
    request.benchmarkTraceId,
  );

  if (request.benchmarkTraceId && changes.length > 0) {
    const snapshot = await getReplaySnapshotByTraceId(prisma, request.benchmarkTraceId);
    if (snapshot) {
      const beforeInput = await buildReportInputFromTrace(
        prisma,
        request.benchmarkTraceId,
        snapshot,
      );
      const beforeMetrics = computeRetrievalQualityMetrics(beforeInput);
      const afterMetrics = { ...beforeMetrics };
      for (const key of Object.keys(beforeMetrics) as Array<
        keyof typeof beforeMetrics
      >) {
        if (request.section === "retrieval" && key === "retrievalBreadth") {
          afterMetrics.retrievalBreadth = Math.min(
            1,
            beforeMetrics.retrievalBreadth * (next.retrieval.breadthMultiplier / previous.retrieval.breadthMultiplier),
          );
        }
        if (request.section === "retrieval" && key === "retrievalPrecision") {
          const thresholdDelta = next.retrieval.semanticThreshold - previous.retrieval.semanticThreshold;
          afterMetrics.retrievalPrecision = Math.max(
            0,
            beforeMetrics.retrievalPrecision - thresholdDelta * 0.5,
          );
        }
      }
      const deltas = computeMetricDeltas(beforeMetrics, afterMetrics);
      changes = changes.map((record) => ({
        ...record,
        retrievalImpact: deltas,
      }));
    }
  }

  if (changes.length === 0) {
    const view = await getCalibrationView(prisma, request.workspaceId);
    if (!view) return { error: "Workspace not found" };
    return { view, changes: [] };
  }

  const nextConfig = applyCalibrationToWorkspaceConfig(config, next);
  await prisma.workspace.update({
    where: { id: request.workspaceId },
    data: { config: nextConfig as Prisma.InputJsonValue },
  });

  return {
    view: {
      workspaceId: request.workspaceId,
      config: next,
      defaults: resolveDefaultsFromRuntime(),
      history: [...changes, ...(await loadCalibrationHistory(prisma, request.workspaceId))],
    },
    changes,
  };
}

export async function buildReportInputFromTrace(
  prisma: PrismaClient,
  retrievalTraceId: string,
  snapshot: import("@memory-middleware/shared-types").ReplaySnapshot,
): Promise<BuildReportInput> {
  const op = await prisma.retrievalOperation.findFirst({
    where: { traceId: retrievalTraceId },
    orderBy: { createdAt: "desc" },
  });

  const result = (op?.result ?? {}) as unknown as StoredRetrievalResult;

  return {
    snapshot,
    ...(result.relationshipAugmentation
      ? {
          relationshipAugmentation: {
            augmentationApplied: result.relationshipAugmentation.augmentationApplied,
            neighborCount: result.relationshipAugmentation.neighborCount,
            rankingImpacts: result.relationshipAugmentation.rankingImpacts.map((i) => ({
              previousScore: i.previousScore,
              augmentedScore: i.augmentedScore,
            })),
          },
        }
      : {}),
  };
}

export function workspaceConfigFromRow(
  workspace: { id: string; name: string; slug: string; config: unknown },
): WorkspaceConfig {
  const config = workspace.config as Record<string, unknown>;
  const result: WorkspaceConfig = {
    workspace_id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    retrieval: (config.retrieval as WorkspaceConfig["retrieval"]) ?? {
      default_strategy: "deterministic-v1",
      token_budget_default: 4096,
    },
    observability: (config.observability as WorkspaceConfig["observability"]) ?? {
      trace_enabled: true,
      event_logging_enabled: true,
    },
  };
  if (config.compression && typeof config.compression === "object") {
    result.compression = config.compression as NonNullable<WorkspaceConfig["compression"]>;
  }
  return result;
}
