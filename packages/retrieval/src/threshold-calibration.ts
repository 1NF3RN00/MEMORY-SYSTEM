import type {
  CalibrationThresholdMode,
  RetrievalCalibrationControls,
  RetrievalMode,
  RetrievalRuntimeConfig,
  SystemCalibrationConfig,
} from "@memory-middleware/shared-types";
import {
  DEFAULT_THRESHOLD_MODE_DELTAS,
  DEFAULT_THRESHOLD_MODE_TOP_K,
} from "@memory-middleware/shared-types";
import { MIN_SIMILARITY_THRESHOLD } from "./vector-retrieval.js";

export interface CalibratedRetrievalParams {
  topK: number;
  similarityThreshold: number;
  thresholdMode: CalibrationThresholdMode;
  precisionWeighting: number;
  breadthMultiplier: number;
}

function topKForThresholdMode(
  mode: CalibrationThresholdMode,
  calibration: RetrievalCalibrationControls,
): number {
  const overrides: Record<CalibrationThresholdMode, number> = {
    strict: calibration.topKStrict,
    balanced: calibration.topKBalanced,
    exploratory: calibration.topKExploratory,
    calibration: calibration.topKCalibration,
  };

  const configured = overrides[mode];
  if (configured > 0) return configured;
  return DEFAULT_THRESHOLD_MODE_TOP_K[mode];
}

/** Resolve deterministic threshold and top-K from calibration controls. */
export function resolveCalibratedRetrievalParams(
  calibration: Partial<RetrievalCalibrationControls> | undefined,
  retrievalMode: RetrievalMode,
  runtimeConfig: RetrievalRuntimeConfig,
): CalibratedRetrievalParams {
  const thresholdMode = calibration?.thresholdMode ?? "balanced";
  const baseThreshold = calibration?.semanticThreshold ?? runtimeConfig.vector.similarityThreshold;
  const modeDelta = DEFAULT_THRESHOLD_MODE_DELTAS[thresholdMode];
  const precisionWeighting = calibration?.precisionWeighting ?? 1.0;
  const breadthMultiplier = calibration?.breadthMultiplier ?? calibration?.retrievalBreadth ?? 1.0;

  const thresholdDelta = modeDelta + (precisionWeighting > 1 ? 0.02 * (precisionWeighting - 1) : 0);
  const adjustedThreshold = Math.max(
    MIN_SIMILARITY_THRESHOLD,
    Math.min(0.95, baseThreshold + thresholdDelta),
  );

  let topK = topKForThresholdMode(thresholdMode, {
    semanticThreshold: baseThreshold,
    retrievalBreadth: breadthMultiplier,
    topK: calibration?.topK ?? runtimeConfig.vector.topKPrecision,
    precisionWeighting,
    thresholdMode,
    topKStrict: calibration?.topKStrict ?? 15,
    topKBalanced: calibration?.topKBalanced ?? 30,
    topKExploratory: calibration?.topKExploratory ?? 60,
    topKCalibration: calibration?.topKCalibration ?? 120,
    breadthMultiplier,
    expansionWeighting: calibration?.expansionWeighting ?? 1,
  });

  topK = Math.round(topK * breadthMultiplier);

  const modeMultipliers: Record<RetrievalMode, number> = {
    precision: 0.75,
    expanded: 1.0,
    exploratory: 1.25,
    "incident-response": 0.9,
  };
  topK = Math.round(topK * (modeMultipliers[retrievalMode] ?? 1));

  if (calibration?.topK && calibration.topK > 0) {
    topK = Math.max(topK, Math.round(calibration.topK * breadthMultiplier));
  }

  const topKCap = thresholdMode === "calibration" ? 150 : 120;

  return {
    topK: Math.max(8, Math.min(topKCap, topK)),
    similarityThreshold: adjustedThreshold,
    thresholdMode,
    precisionWeighting,
    breadthMultiplier,
  };
}

/** Apply system calibration to retrieval runtime config deterministically. */
export function applyCalibrationToRetrievalConfig(
  config: RetrievalRuntimeConfig,
  calibration: SystemCalibrationConfig | Partial<SystemCalibrationConfig>,
  retrievalMode: RetrievalMode = "precision",
): RetrievalRuntimeConfig {
  const params = resolveCalibratedRetrievalParams(
    calibration.retrieval,
    retrievalMode,
    config,
  );

  const pw = params.precisionWeighting;
  const semanticWeightScale = pw >= 1 ? 1 / pw : pw;

  return {
    ...config,
    vector: {
      ...config.vector,
      similarityThreshold: params.similarityThreshold,
      topKPrecision: params.topK,
      topKExpanded: Math.round(params.topK * 1.5),
      topKExploratory: Math.round(params.topK * 2),
      topKIncidentResponse: Math.round(params.topK * 0.9),
    },
    ranking: {
      importance: (calibration.ranking?.importanceWeighting ?? config.ranking.importance) * semanticWeightScale,
      recency: calibration.ranking?.recencyWeighting ?? config.ranking.recency,
      reinforcement: calibration.ranking?.reinforcementWeighting ?? config.ranking.reinforcement,
      semanticDensity: (calibration.ranking?.semanticDensityWeighting ?? config.ranking.semanticDensity) * pw,
    },
  };
}

export { DEFAULT_THRESHOLD_MODE_DELTAS, DEFAULT_THRESHOLD_MODE_TOP_K };
