import type {
  Observation,
  ObservationMetadata,
  ObservationMetricDefinition,
  ObservationValue,
} from "@memory-middleware/shared-types";
import { newUlid } from "@memory-middleware/shared-types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toIso8601(value: unknown, fallback: string): string {
  if (typeof value === "string" && Number.isFinite(Date.parse(value))) {
    return new Date(value).toISOString();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }
  return fallback;
}

function clampNumber(value: number, unit: string | undefined): number {
  if (unit === "score_0_100") return Math.min(100, Math.max(0, value));
  if (unit === "score_0_5") return Math.min(5, Math.max(0, value));
  if (unit === "count" || unit === "count_per_month" || unit === "rank") {
    return Math.max(0, Math.round(value));
  }
  if (unit === "ms" || unit === "days") return Math.max(0, value);
  if (unit === "ratio") return value;
  return value;
}

function coerceValue(
  raw: unknown,
  metric: ObservationMetricDefinition | undefined,
): ObservationValue {
  if (raw === null || raw === undefined) return null;

  const valueType = metric?.valueType ?? "number";

  if (valueType === "boolean") {
    if (typeof raw === "boolean") return raw;
    if (raw === "true") return true;
    if (raw === "false") return false;
    return Boolean(raw);
  }

  if (valueType === "number") {
    const num = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(num)) return 0;
    return clampNumber(num, metric?.unit);
  }

  if (valueType === "string") {
    return String(raw);
  }

  if (valueType === "array") {
    return Array.isArray(raw) ? (raw as ObservationValue[]) : [raw as ObservationValue];
  }

  if (valueType === "object") {
    return isRecord(raw) ? (raw as ObservationValue) : { value: raw as ObservationValue };
  }

  return raw as ObservationValue;
}

function buildMetadata(
  raw: Record<string, unknown>,
  providerKey: string,
  metric: ObservationMetricDefinition | undefined,
  collectedAt: string,
): ObservationMetadata {
  const metricKey =
    (typeof raw.metric === "string" ? raw.metric : undefined) ??
    metric?.metricKey ??
    (typeof raw.metadata === "object" && raw.metadata !== null
      ? (raw.metadata as Record<string, unknown>).metric
      : undefined);

  const rawMeta = isRecord(raw.metadata) ? raw.metadata : {};
  const categoryKey =
    (typeof rawMeta.category === "string" ? rawMeta.category : undefined) ??
    metric?.categoryKey ??
    "unknown";

  const metadata: ObservationMetadata = {
    provider: providerKey,
    category: categoryKey,
    metric: typeof metricKey === "string" ? metricKey : "unknown",
    collectedAt,
  };

  if (metric?.unit) metadata.unit = metric.unit;
  else if (typeof rawMeta.unit === "string") metadata.unit = rawMeta.unit;

  if (typeof rawMeta.businessId === "string") metadata.businessId = rawMeta.businessId;
  if (typeof rawMeta.competitorId === "string") metadata.competitorId = rawMeta.competitorId;
  if (typeof rawMeta.platform === "string") metadata.platform = rawMeta.platform;
  if (typeof rawMeta.sourceLabel === "string") metadata.sourceLabel = rawMeta.sourceLabel;

  return metadata;
}

export interface NormalizeObservationOptions {
  metric?: ObservationMetricDefinition;
  defaultWorkspaceId?: string;
  defaultSource?: string;
}

export function normalizeObservation(
  raw: unknown,
  providerKey: string,
  options: NormalizeObservationOptions = {},
): Observation {
  if (!isRecord(raw)) {
    throw new Error("Observation input must be an object");
  }

  const now = new Date().toISOString();
  const metric = options.metric;
  const metricKey =
    (typeof raw.metric === "string" ? raw.metric : undefined) ??
    metric?.metricKey ??
    "unknown";

  const metadata = buildMetadata(raw, providerKey, metric, now);
  metadata.metric = metricKey;
  if (metric) {
    metadata.category = metric.categoryKey;
    if (metric.unit) metadata.unit = metric.unit;
  }

  const collectedAt = toIso8601(
    isRecord(raw.metadata) ? raw.metadata.collectedAt : undefined,
    now,
  );
  metadata.collectedAt = collectedAt;

  const timestamp = toIso8601(raw.timestamp, collectedAt);
  const value = coerceValue(raw.value, metric);

  const observation: Observation = {
    observationId:
      typeof raw.observationId === "string" && raw.observationId.trim()
        ? raw.observationId
        : newUlid(),
    workspaceId:
      typeof raw.workspaceId === "string" && raw.workspaceId.trim()
        ? raw.workspaceId
        : (options.defaultWorkspaceId ?? ""),
    metric: metricKey,
    value,
    source:
      typeof raw.source === "string" && raw.source.trim()
        ? raw.source
        : (options.defaultSource ?? providerKey),
    timestamp,
    metadata,
  };

  return observation;
}
