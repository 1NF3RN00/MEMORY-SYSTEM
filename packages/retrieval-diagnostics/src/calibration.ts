import type {
  CalibrationChangeRecord,
  SystemCalibrationConfig,
  WorkspaceConfig,
} from "@memory-middleware/shared-types";
import {
  DEFAULT_RETRIEVAL_RUNTIME_CONFIG,
  DEFAULT_RELATIONSHIP_AUGMENTATION_CONFIG,
  DEFAULT_SYSTEM_CALIBRATION,
} from "@memory-middleware/shared-types";
import { newUlid } from "@memory-middleware/shared-types";

export function mergeSystemCalibration(
  workspaceConfig?: WorkspaceConfig | null,
  storedCalibration?: Partial<SystemCalibrationConfig> | null,
): SystemCalibrationConfig {
  const base = { ...DEFAULT_SYSTEM_CALIBRATION };

  if (workspaceConfig?.retrieval?.runtime) {
    const rt = workspaceConfig.retrieval.runtime;
    if (rt.vector?.similarityThreshold !== undefined) {
      base.retrieval.semanticThreshold = rt.vector.similarityThreshold;
    }
    if (rt.vector?.topKPrecision !== undefined) {
      base.retrieval.topK = rt.vector.topKPrecision;
    }
    if (rt.ranking) {
      base.ranking.importanceWeighting = rt.ranking.importance ?? base.ranking.importanceWeighting;
      base.ranking.recencyWeighting = rt.ranking.recency ?? base.ranking.recencyWeighting;
      base.ranking.reinforcementWeighting =
        rt.ranking.reinforcement ?? base.ranking.reinforcementWeighting;
      base.ranking.semanticDensityWeighting =
        rt.ranking.semanticDensity ?? base.ranking.semanticDensityWeighting;
    }
  }

  if (workspaceConfig?.compression) {
    base.compression.fidelityAggressiveness =
      workspaceConfig.compression.default_token_optimization ??
      base.compression.fidelityAggressiveness;
    base.compression.summarizationThreshold =
      workspaceConfig.compression.default_nuance_preservation ??
      base.compression.summarizationThreshold;
  }

  if (storedCalibration) {
    return deepMergeCalibration(base, storedCalibration);
  }

  return base;
}

export function applyCalibrationToWorkspaceConfig(
  config: Record<string, unknown>,
  calibration: SystemCalibrationConfig,
): Record<string, unknown> {
  const retrieval = (config.retrieval ?? {}) as Record<string, unknown>;
  const runtime = (retrieval.runtime ?? {}) as Record<string, unknown>;
  const vector = (runtime.vector ?? {}) as Record<string, unknown>;
  const ranking = (runtime.ranking ?? {}) as Record<string, unknown>;
  const compression = (config.compression ?? {}) as Record<string, unknown>;

  return {
    ...config,
    calibration,
    retrieval: {
      ...retrieval,
      runtime: {
        ...runtime,
        vector: {
          ...vector,
          similarityThreshold: calibration.retrieval.semanticThreshold,
          topKPrecision: calibration.retrieval.topKStrict || calibration.retrieval.topK,
          topKExpanded: calibration.retrieval.topKBalanced || Math.round(calibration.retrieval.topK * calibration.retrieval.retrievalBreadth),
          topKExploratory: calibration.retrieval.topKExploratory || Math.round(calibration.retrieval.topK * calibration.retrieval.retrievalBreadth * 1.5),
          topKIncidentResponse: Math.round((calibration.retrieval.topKBalanced || calibration.retrieval.topK) * 0.9),
        },
        ranking: {
          ...ranking,
          importance: calibration.ranking.importanceWeighting,
          recency: calibration.ranking.recencyWeighting,
          reinforcement: calibration.ranking.reinforcementWeighting,
          semanticDensity: calibration.ranking.semanticDensityWeighting,
        },
      },
    },
    compression: {
      ...compression,
      default_token_optimization: calibration.compression.fidelityAggressiveness,
      default_nuance_preservation: calibration.compression.summarizationThreshold,
    },
    relationship: {
      maxNeighbors: calibration.relationships.neighborLimit,
      confidenceThreshold: calibration.relationships.confidenceThreshold,
      augmentationWeight: calibration.relationships.augmentationWeighting,
    },
    chunking: {
      chunkSize: calibration.chunking.chunkSize,
      hierarchySensitivity: calibration.chunking.hierarchySensitivity,
      adjacencyPreservation: calibration.chunking.adjacencyPreservation,
    },
    rendering: {
      hierarchyPreservation: calibration.rendering.hierarchyPreservation,
      contextualGrouping: calibration.rendering.contextualGrouping,
      deliveryDensity: calibration.rendering.deliveryDensity,
    },
  };
}

export function calibrationToRetrievalRuntimeOverrides(
  calibration: Partial<SystemCalibrationConfig>,
): Record<string, unknown> {
  const overrides: Record<string, unknown> = {};

  if (calibration.retrieval) {
    overrides.vector = {
      similarityThreshold: calibration.retrieval.semanticThreshold,
      topKPrecision: calibration.retrieval.topK,
    };
  }
  if (calibration.ranking) {
    overrides.ranking = {
      importance: calibration.ranking.importanceWeighting,
      recency: calibration.ranking.recencyWeighting,
      reinforcement: calibration.ranking.reinforcementWeighting,
      semanticDensity: calibration.ranking.semanticDensityWeighting,
    };
  }

  return overrides;
}

export function buildCalibrationChangeRecords(
  workspaceId: string,
  section: keyof SystemCalibrationConfig,
  previous: SystemCalibrationConfig,
  next: SystemCalibrationConfig,
  benchmarkTraceId?: string,
): CalibrationChangeRecord[] {
  const records: CalibrationChangeRecord[] = [];
  const prevSection = previous[section] as unknown as Record<string, number>;
  const nextSection = next[section] as unknown as Record<string, number>;

  for (const field of Object.keys(nextSection)) {
    const prevValue = prevSection[field];
    const newValue = nextSection[field];
    if (prevValue !== newValue) {
      records.push({
        changeId: newUlid(),
        workspaceId,
        section,
        field,
        previousValue: prevValue ?? 0,
        newValue: newValue ?? 0,
        changedAt: new Date().toISOString(),
        ...(benchmarkTraceId ? { benchmarkTraceId } : {}),
      });
    }
  }

  return records;
}

export function resolveDefaultsFromRuntime(): SystemCalibrationConfig {
  return {
    ...DEFAULT_SYSTEM_CALIBRATION,
    retrieval: {
      ...DEFAULT_SYSTEM_CALIBRATION.retrieval,
      semanticThreshold: DEFAULT_RETRIEVAL_RUNTIME_CONFIG.vector.similarityThreshold,
      topK: DEFAULT_RETRIEVAL_RUNTIME_CONFIG.vector.topKPrecision,
    },
    ranking: {
      importanceWeighting: DEFAULT_RETRIEVAL_RUNTIME_CONFIG.ranking.importance,
      recencyWeighting: DEFAULT_RETRIEVAL_RUNTIME_CONFIG.ranking.recency,
      reinforcementWeighting: DEFAULT_RETRIEVAL_RUNTIME_CONFIG.ranking.reinforcement,
      semanticDensityWeighting: DEFAULT_RETRIEVAL_RUNTIME_CONFIG.ranking.semanticDensity,
    },
    relationships: {
      confidenceThreshold: DEFAULT_RELATIONSHIP_AUGMENTATION_CONFIG.confidenceThreshold,
      neighborLimit: DEFAULT_RELATIONSHIP_AUGMENTATION_CONFIG.maxNeighbors,
      augmentationWeighting: DEFAULT_RELATIONSHIP_AUGMENTATION_CONFIG.augmentationWeight,
    },
  };
}

function deepMergeCalibration(
  base: SystemCalibrationConfig,
  patch: Partial<SystemCalibrationConfig>,
): SystemCalibrationConfig {
  const mergedRetrieval = { ...base.retrieval, ...patch.retrieval };
  if (patch.retrieval && !patch.retrieval.thresholdMode) {
    mergedRetrieval.thresholdMode = base.retrieval.thresholdMode;
  }
  return {
    retrieval: mergedRetrieval,
    ranking: { ...base.ranking, ...patch.ranking },
    chunking: { ...base.chunking, ...patch.chunking },
    relationships: { ...base.relationships, ...patch.relationships },
    compression: { ...base.compression, ...patch.compression },
    rendering: { ...base.rendering, ...patch.rendering },
  };
}

export function clampCalibrationValue(value: number, min: number, max: number): number {
  return Number(Math.min(max, Math.max(min, value)).toFixed(4));
}

export const CALIBRATION_BOUNDS: Record<
  keyof SystemCalibrationConfig,
  Record<string, [number, number]>
> = {
  retrieval: {
    semanticThreshold: [0.45, 0.95],
    retrievalBreadth: [0.5, 2.0],
    topK: [8, 150],
    precisionWeighting: [0.5, 2.0],
    topKStrict: [10, 20],
    topKBalanced: [20, 40],
    topKExploratory: [40, 80],
    topKCalibration: [80, 150],
    breadthMultiplier: [0.5, 3.0],
    expansionWeighting: [0.5, 2.0],
  },
  ranking: {
    recencyWeighting: [0, 0.25],
    semanticDensityWeighting: [0, 0.2],
    reinforcementWeighting: [0, 0.2],
    importanceWeighting: [0, 0.25],
  },
  chunking: {
    chunkSize: [128, 1024],
    hierarchySensitivity: [0, 1],
    adjacencyPreservation: [0, 1],
  },
  relationships: {
    confidenceThreshold: [0.3, 0.9],
    neighborLimit: [0, 16],
    augmentationWeighting: [0, 0.1],
  },
  compression: {
    fidelityAggressiveness: [0, 1],
    mergeSensitivity: [0.5, 0.98],
    summarizationThreshold: [0.5, 1],
  },
  rendering: {
    hierarchyPreservation: [0, 1],
    contextualGrouping: [0, 1],
    deliveryDensity: [0, 1],
  },
};
