import type {
  HistorianRetentionConfig,
  RetentionArchiveResult,
  RetentionMode,
} from "@memory-middleware/shared-types";
import { DEFAULT_HISTORIAN_RETENTION_CONFIG } from "@memory-middleware/shared-types";

export interface RetentionCandidate {
  replayId: string;
  createdAt: Date;
  retentionMode: RetentionMode;
}

export function mergeRetentionConfig(
  partial?: Partial<HistorianRetentionConfig>,
): HistorianRetentionConfig {
  return {
    ...DEFAULT_HISTORIAN_RETENTION_CONFIG,
    ...partial,
  };
}

export function resolveRetentionTransition(
  createdAt: Date,
  currentMode: RetentionMode,
  config: HistorianRetentionConfig,
  now = new Date(),
): RetentionMode | null {
  const ageDays = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

  if (currentMode === "permanent_deletion") return null;

  if (currentMode === "operational" && ageDays >= config.operationalRetentionDays) {
    return "historical";
  }

  if (currentMode === "historical" && ageDays >= config.historicalRetentionDays) {
    return "compressed_archival";
  }

  if (
    currentMode === "compressed_archival" &&
    ageDays >= config.compressedArchivalDays
  ) {
    return null;
  }

  return null;
}

export function selectSnapshotsForArchival(
  candidates: RetentionCandidate[],
  config: HistorianRetentionConfig,
  now = new Date(),
): RetentionArchiveResult {
  const archivedReplayIds: string[] = [];
  let targetMode: RetentionMode = "historical";

  for (const candidate of candidates) {
    const next = resolveRetentionTransition(candidate.createdAt, candidate.retentionMode, config, now);
    if (next) {
      archivedReplayIds.push(candidate.replayId);
      targetMode = next;
    }
  }

  return {
    archivedCount: archivedReplayIds.length,
    archivedReplayIds,
    retentionMode: targetMode,
    executedAt: now.toISOString(),
  };
}

export function compressSnapshotPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const contextPackage = payload.contextPackage as Record<string, unknown> | undefined;
  if (!contextPackage) return payload;

  return {
    ...payload,
    contextPackage: {
      ...contextPackage,
      memories: (contextPackage.memories as unknown[])?.map((m) => {
        const memory = m as Record<string, unknown>;
        return {
          ...memory,
          chunks: (memory.chunks as unknown[])?.map((c) => {
            const chunk = c as Record<string, unknown>;
            return {
              chunkId: chunk.chunkId,
              chunkIndex: chunk.chunkIndex,
              tokenCount: chunk.tokenCount,
              finalScore: chunk.finalScore,
              rankingRank: chunk.rankingRank,
              contentPreview: String(chunk.content ?? "").slice(0, 120),
            };
          }),
        };
      }),
    },
    _archivalCompressed: true,
  };
}
