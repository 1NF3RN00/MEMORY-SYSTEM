import type {
  Observation,
  ObservationMetricDefinition,
  ObservationProviderDefinition,
  ObservationValidationResult,
} from "@memory-middleware/shared-types";
import { normalizeObservation, type NormalizeObservationOptions } from "./normalize.js";
import { validateObservationAgainstMetric } from "./validate.js";

function metricKey(providerKey: string, categoryKey: string, metricKeyName: string): string {
  return `${providerKey}:${categoryKey}:${metricKeyName}`;
}

export class ObservationRegistry {
  private readonly providers = new Map<string, ObservationProviderDefinition>();
  private readonly metrics = new Map<string, ObservationMetricDefinition>();

  registerProvider(definition: ObservationProviderDefinition): void {
    if (this.providers.has(definition.providerKey)) {
      throw new Error(`Provider already registered: ${definition.providerKey}`);
    }
    this.providers.set(definition.providerKey, definition);
  }

  registerMetric(definition: ObservationMetricDefinition): void {
    const key = metricKey(definition.providerKey, definition.categoryKey, definition.metricKey);
    if (this.metrics.has(key)) {
      throw new Error(`Metric already registered: ${key}`);
    }
    this.metrics.set(key, definition);
  }

  getProvider(providerKey: string): ObservationProviderDefinition | undefined {
    return this.providers.get(providerKey);
  }

  getMetric(
    providerKey: string,
    categoryKey: string,
    metricKeyName: string,
  ): ObservationMetricDefinition | undefined {
    return this.metrics.get(metricKey(providerKey, categoryKey, metricKeyName));
  }

  listProviders(): ObservationProviderDefinition[] {
    return [...this.providers.values()].sort((a, b) => a.providerKey.localeCompare(b.providerKey));
  }

  listMetrics(filter?: {
    providerKey?: string;
    categoryKey?: string;
  }): ObservationMetricDefinition[] {
    let result = [...this.metrics.values()];
    if (filter?.providerKey) {
      result = result.filter((m) => m.providerKey === filter.providerKey);
    }
    if (filter?.categoryKey) {
      result = result.filter((m) => m.categoryKey === filter.categoryKey);
    }
    return result.sort((a, b) => {
      const byProvider = a.providerKey.localeCompare(b.providerKey);
      if (byProvider !== 0) return byProvider;
      const byCategory = a.categoryKey.localeCompare(b.categoryKey);
      if (byCategory !== 0) return byCategory;
      return a.metricKey.localeCompare(b.metricKey);
    });
  }

  validateObservation(observation: Observation): ObservationValidationResult {
    const metric = this.getMetric(
      observation.metadata.provider,
      observation.metadata.category,
      observation.metadata.metric,
    );
    return validateObservationAgainstMetric(observation, metric);
  }

  normalizeObservation(
    raw: unknown,
    providerKey: string,
    options: Omit<NormalizeObservationOptions, "metric"> & {
      categoryKey?: string;
      metricKey?: string;
    } = {},
  ): Observation {
    const provider = this.providers.get(providerKey);
    if (!provider) {
      throw new Error(`Unknown provider: ${providerKey}`);
    }

    let metric: ObservationMetricDefinition | undefined;
    if (options.metricKey && options.categoryKey) {
      metric = this.getMetric(providerKey, options.categoryKey, options.metricKey);
    } else if (isRecord(raw) && typeof raw.metric === "string") {
      const rawMeta = isRecord(raw.metadata) ? raw.metadata : {};
      const category =
        options.categoryKey ??
        (typeof rawMeta.category === "string" ? rawMeta.category : undefined);
      if (category) {
        metric = this.getMetric(providerKey, category, raw.metric);
      }
    }

    const observation = normalizeObservation(raw, providerKey, {
      ...options,
      ...(metric ? { metric } : {}),
    });

    if (observation.metadata.provider !== providerKey) {
      observation.metadata.provider = providerKey;
    }

    return observation;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export const defaultRegistry = new ObservationRegistry();

export function registerProvider(definition: ObservationProviderDefinition): void {
  defaultRegistry.registerProvider(definition);
}

export function registerMetric(definition: ObservationMetricDefinition): void {
  defaultRegistry.registerMetric(definition);
}

export function listProviders(): ObservationProviderDefinition[] {
  return defaultRegistry.listProviders();
}

export function listMetrics(filter?: {
  providerKey?: string;
  categoryKey?: string;
}): ObservationMetricDefinition[] {
  return defaultRegistry.listMetrics(filter);
}

export function validateObservation(observation: Observation): ObservationValidationResult {
  return defaultRegistry.validateObservation(observation);
}

export function normalizeObservationFromRegistry(
  raw: unknown,
  providerKey: string,
  options?: Parameters<ObservationRegistry["normalizeObservation"]>[2],
): Observation {
  return defaultRegistry.normalizeObservation(raw, providerKey, options);
}
