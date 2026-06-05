import type {
  Observation,
  ObservationMetricDefinition,
  ObservationMetricValueType,
  ObservationValidationResult,
  ObservationValue,
} from "@memory-middleware/shared-types";

function isIso8601(value: string): boolean {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed);
}

function valueTypeOf(value: ObservationValue): ObservationMetricValueType | "null" {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "number") return "number";
  if (typeof value === "string") return "string";
  if (typeof value === "boolean") return "boolean";
  return "object";
}

function isCountUnit(unit: string | undefined): boolean {
  return unit === "count" || unit === "count_per_month" || unit === "rank";
}

function validateNumericUnit(
  metricKey: string,
  value: number,
  unit: string | undefined,
  errors: string[],
): void {
  if (!Number.isFinite(value)) {
    errors.push(`value for metric "${metricKey}" must be a finite number`);
    return;
  }

  if (unit === "score_0_100" && (value < 0 || value > 100)) {
    errors.push(`value for metric "${metricKey}" must be between 0 and 100`);
  }
  if (unit === "score_0_5" && (value < 0 || value > 5)) {
    errors.push(`value for metric "${metricKey}" must be between 0 and 5`);
  }
  if (isCountUnit(unit) && (!Number.isInteger(value) || value < 0)) {
    errors.push(`value for metric "${metricKey}" must be a non-negative integer`);
  }
  if (unit === "ms" && value < 0) {
    errors.push(`value for metric "${metricKey}" must be non-negative`);
  }
  if (unit === "days" && value < 0) {
    errors.push(`value for metric "${metricKey}" must be non-negative`);
  }
  if (unit === "ratio" && metricKey.includes("engagement_rate") && (value < 0 || value > 1)) {
    errors.push(`value for metric "${metricKey}" must be between 0 and 1`);
  }
}

export function validateObservationValue(
  metric: ObservationMetricDefinition,
  value: ObservationValue,
): string[] {
  const errors: string[] = [];
  const actual = valueTypeOf(value);

  if (metric.valueType === "number") {
    if (actual !== "number") {
      errors.push(`value for metric "${metric.metricKey}" must be a number`);
      return errors;
    }
    validateNumericUnit(metric.metricKey, value as number, metric.unit, errors);
    return errors;
  }

  if (metric.valueType === "boolean") {
    if (actual !== "boolean") {
      errors.push(`value for metric "${metric.metricKey}" must be a boolean`);
    }
    return errors;
  }

  if (metric.valueType === "string") {
    if (actual !== "string") {
      errors.push(`value for metric "${metric.metricKey}" must be a string`);
    }
    return errors;
  }

  if (metric.valueType === "array") {
    if (actual !== "array") {
      errors.push(`value for metric "${metric.metricKey}" must be an array`);
    }
    return errors;
  }

  if (metric.valueType === "object") {
    if (actual !== "object") {
      errors.push(`value for metric "${metric.metricKey}" must be an object`);
    }
    return errors;
  }

  return errors;
}

export function validateObservationAgainstMetric(
  observation: Observation,
  metric: ObservationMetricDefinition | undefined,
): ObservationValidationResult {
  const errors: string[] = [];

  if (!observation.observationId?.trim()) {
    errors.push("observationId is required");
  }
  if (!observation.workspaceId?.trim()) {
    errors.push("workspaceId is required");
  }
  if (!observation.source?.trim()) {
    errors.push("source is required");
  }
  if (!observation.timestamp || !isIso8601(observation.timestamp)) {
    errors.push("timestamp must be a valid ISO-8601 date");
  }
  if (!observation.metadata?.collectedAt || !isIso8601(observation.metadata.collectedAt)) {
    errors.push("metadata.collectedAt must be a valid ISO-8601 date");
  }
  if (!observation.metric?.trim()) {
    errors.push("metric is required");
  }
  if (observation.metric !== observation.metadata?.metric) {
    errors.push("metric must match metadata.metric");
  }

  if (!metric) {
    errors.push(
      `unknown metric "${observation.metadata?.metric ?? observation.metric}" for provider "${observation.metadata?.provider ?? "unknown"}" and category "${observation.metadata?.category ?? "unknown"}"`,
    );
    return { valid: false, errors };
  }

  if (observation.metadata.provider !== metric.providerKey) {
    errors.push(`metadata.provider must be "${metric.providerKey}"`);
  }
  if (observation.metadata.category !== metric.categoryKey) {
    errors.push(`metadata.category must be "${metric.categoryKey}" for metric "${metric.metricKey}"`);
  }
  if (observation.metadata.metric !== metric.metricKey) {
    errors.push(`metadata.metric must be "${metric.metricKey}"`);
  }

  errors.push(...validateObservationValue(metric, observation.value));

  return { valid: errors.length === 0, errors };
}
