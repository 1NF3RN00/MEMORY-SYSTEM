/**
 * Observation System contracts (Phase 1).
 * @see docs/observation-system/CONTRACTS.md
 */

export type ObservationValue =
  | number
  | string
  | boolean
  | null
  | ObservationValue[]
  | { [key: string]: ObservationValue };

export interface ObservationMetadata {
  provider: string;
  category: string;
  metric: string;
  businessId?: string;
  competitorId?: string;
  platform?: string;
  collectedAt: string;
  unit?: string;
  sourceLabel?: string;
}

export interface Observation {
  observationId: string;
  workspaceId: string;
  metric: string;
  value: ObservationValue;
  source: string;
  timestamp: string;
  metadata: ObservationMetadata;
}

export interface ObservationFilter {
  providers?: string[];
  categories?: string[];
  metrics?: string[];
  platforms?: string[];
  businessId?: string;
  competitorId?: string;
  collectedAfter?: string;
  collectedBefore?: string;
}

/** Only shape downstream systems (workflow LLM, reports, dashboard) may consume. */
export interface NormalizedObservation {
  observationId: string;
  provider: string;
  category: string;
  metric: string;
  value: ObservationValue;
  unit?: string;
  source: string;
  sourceLabel?: string;
  timestamp: string;
  collectedAt: string;
  businessId?: string;
  competitorId?: string;
  platform?: string;
}

export function normalizeObservationForContext(observation: Observation): NormalizedObservation {
  const normalized: NormalizedObservation = {
    observationId: observation.observationId,
    provider: observation.metadata.provider,
    category: observation.metadata.category,
    metric: observation.metric,
    value: observation.value,
    source: observation.source,
    timestamp: observation.timestamp,
    collectedAt: observation.metadata.collectedAt,
  };
  if (observation.metadata.unit) normalized.unit = observation.metadata.unit;
  if (observation.metadata.sourceLabel) normalized.sourceLabel = observation.metadata.sourceLabel;
  if (observation.metadata.businessId) normalized.businessId = observation.metadata.businessId;
  if (observation.metadata.competitorId) normalized.competitorId = observation.metadata.competitorId;
  if (observation.metadata.platform) normalized.platform = observation.metadata.platform;
  return normalized;
}

export type ObservationMetricValueType = "number" | "string" | "boolean" | "object" | "array";

export interface ObservationMetricDefinition {
  metricKey: string;
  categoryKey: string;
  providerKey: string;
  valueType: ObservationMetricValueType;
  unit?: string;
  description: string;
}

export interface ObservationProviderDefinition {
  providerKey: string;
  name: string;
  description: string;
  categories: string[];
  metrics: string[];
  collectionInputSchema: Record<string, unknown>;
}

export interface ObservationValidationResult {
  valid: boolean;
  errors: string[];
}

export interface CollectInput {
  workspaceId: string;
  businessId?: string;
  competitorId?: string;
  traceId: string;
  params: Record<string, unknown>;
}

export interface CollectResult {
  providerKey: string;
  observations: Observation[];
  rawItemCount: number;
  collectedAt: string;
}

export interface ObservationProvider {
  definition: ObservationProviderDefinition;
  collect(input: CollectInput): Promise<CollectResult>;
}

export const OBSERVATION_EVENT_TYPES = {
  OBSERVATION_CREATED: "observation_created",
  OBSERVATION_UPDATED: "observation_updated",
  OBSERVATION_ARCHIVED: "observation_archived",
  OBSERVATION_RETRIEVED: "observation_retrieved",
  OBSERVATION_COLLECTION_STARTED: "observation_collection_started",
  OBSERVATION_COLLECTION_COMPLETED: "observation_collection_completed",
  OBSERVATION_COLLECTION_FAILED: "observation_collection_failed",
} as const;

export type ObservationEventType =
  (typeof OBSERVATION_EVENT_TYPES)[keyof typeof OBSERVATION_EVENT_TYPES];

/** Lowercase slug: provider keys, category keys, metric keys */
export const OBSERVATION_SLUG_REGEX = /^[a-z][a-z0-9_]*$/;

export function isObservationSlug(value: string): boolean {
  return OBSERVATION_SLUG_REGEX.test(value);
}
