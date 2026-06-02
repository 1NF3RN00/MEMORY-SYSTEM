import type {
  CompressionFidelityProfile,
  CompressionRuntimeConfig,
  FidelityMode,
} from "@memory-middleware/shared-types";
import {
  DEFAULT_COMPRESSION_RUNTIME_CONFIG,
  DEFAULT_NUANCE_PRESERVATION,
  DEFAULT_TOKEN_OPTIMIZATION,
} from "@memory-middleware/shared-types";

const FIDELITY_PROFILES: Record<FidelityMode, Omit<CompressionFidelityProfile, "mode">> = {
  maximum_fidelity: {
    overlapThreshold: 0.88,
    duplicateThreshold: 0.95,
    minRetentionRatio: 0.92,
    abstractionEnabled: false,
    trimAggressiveness: 0.15,
  },
  balanced: {
    overlapThreshold: 0.75,
    duplicateThreshold: 0.9,
    minRetentionRatio: 0.8,
    abstractionEnabled: true,
    trimAggressiveness: 0.45,
  },
  aggressive: {
    overlapThreshold: 0.62,
    duplicateThreshold: 0.85,
    minRetentionRatio: 0.65,
    abstractionEnabled: true,
    trimAggressiveness: 0.75,
  },
};

export interface ResolvedCompressionConfig {
  fidelityMode: FidelityMode;
  nuancePreservation: number;
  tokenOptimization: number;
  profile: CompressionFidelityProfile;
  runtime: CompressionRuntimeConfig;
}

export function mergeCompressionConfig(
  overrides?: Partial<CompressionRuntimeConfig>,
  fidelityMode: FidelityMode = "maximum_fidelity",
  nuancePreservation = DEFAULT_NUANCE_PRESERVATION,
  tokenOptimization = DEFAULT_TOKEN_OPTIMIZATION,
): ResolvedCompressionConfig {
  const base = FIDELITY_PROFILES[fidelityMode];
  const nuanceFactor = clamp(nuancePreservation, 0, 1);
  const optimizationFactor = clamp(tokenOptimization, 0, 1);

  const adjustedOverlap =
    base.overlapThreshold + nuanceFactor * 0.08 - optimizationFactor * 0.1;
  const adjustedDuplicate =
    base.duplicateThreshold + nuanceFactor * 0.03 - optimizationFactor * 0.05;
  const adjustedRetention =
    base.minRetentionRatio + nuanceFactor * 0.05 - optimizationFactor * 0.15;
  const trimAggressiveness =
    base.trimAggressiveness + optimizationFactor * 0.2 - nuanceFactor * 0.15;

  const profile: CompressionFidelityProfile = {
    mode: fidelityMode,
    overlapThreshold: clamp(adjustedOverlap, 0.5, 0.98),
    duplicateThreshold: clamp(adjustedDuplicate, 0.7, 0.99),
    minRetentionRatio: clamp(adjustedRetention, 0.5, 0.98),
    abstractionEnabled: base.abstractionEnabled && optimizationFactor > 0.4,
    trimAggressiveness: clamp(trimAggressiveness, 0.05, 0.95),
  };

  const runtime: CompressionRuntimeConfig = {
    overlap: {
      overlapThreshold: profile.overlapThreshold,
      duplicateThreshold: profile.duplicateThreshold,
      ...overrides?.overlap,
    },
    trim: {
      minRetentionRatio: profile.minRetentionRatio,
      rankingWeight: 1.0 + nuanceFactor * 0.5,
      ...overrides?.trim,
    },
    abstraction: {
      enabled: profile.abstractionEnabled,
      maxAbstractionRatio: 0.15 + optimizationFactor * 0.25,
      ...overrides?.abstraction,
    },
  };

  return {
    fidelityMode,
    nuancePreservation: nuanceFactor,
    tokenOptimization: optimizationFactor,
    profile,
    runtime,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export { DEFAULT_COMPRESSION_RUNTIME_CONFIG };
