import type {
  NormalizedObservation,
  Observation,
  ObservationFilter,
  ObservationValue,
} from "@memory-middleware/shared-types";
import { normalizeObservationForContext } from "@memory-middleware/shared-types";

export interface ObservationMemoryRecord {
  memoryId: string;
  metadata: unknown;
  chunkContent: string;
}

export interface ObservationRetrievalStore {
  listObservationMemories(workspaceId: string): Promise<ObservationMemoryRecord[]>;
}

function parseObservationBody(
  content: string,
): Pick<Observation, "metric" | "value" | "source" | "timestamp"> | null {
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    if (
      typeof parsed.metric !== "string" ||
      typeof parsed.source !== "string" ||
      typeof parsed.timestamp !== "string"
    ) {
      return null;
    }
    return {
      metric: parsed.metric,
      value: parsed.value as ObservationValue,
      source: parsed.source,
      timestamp: parsed.timestamp,
    };
  } catch {
    return null;
  }
}

function parseObservationMetadata(metadata: unknown): Observation["metadata"] | null {
  if (!metadata || typeof metadata !== "object") return null;
  const root = metadata as Record<string, unknown>;
  if (root.isObservation !== true) return null;
  const observation = root.observation;
  if (!observation || typeof observation !== "object") return null;
  const obs = observation as Record<string, unknown>;
  if (
    typeof obs.provider !== "string" ||
    typeof obs.category !== "string" ||
    typeof obs.metric !== "string" ||
    typeof obs.collectedAt !== "string"
  ) {
    return null;
  }
  return {
    provider: obs.provider,
    category: obs.category,
    metric: obs.metric,
    collectedAt: obs.collectedAt,
    ...(typeof obs.businessId === "string" ? { businessId: obs.businessId } : {}),
    ...(typeof obs.competitorId === "string" ? { competitorId: obs.competitorId } : {}),
    ...(typeof obs.platform === "string" ? { platform: obs.platform } : {}),
    ...(typeof obs.unit === "string" ? { unit: obs.unit } : {}),
    ...(typeof obs.sourceLabel === "string" ? { sourceLabel: obs.sourceLabel } : {}),
  };
}

export function recordToNormalizedObservation(
  workspaceId: string,
  record: ObservationMemoryRecord,
): NormalizedObservation | null {
  const metadata = parseObservationMetadata(record.metadata);
  const body = parseObservationBody(record.chunkContent);
  if (!metadata || !body) return null;

  return normalizeObservationForContext({
    observationId: record.memoryId,
    workspaceId,
    metric: body.metric,
    value: body.value,
    source: body.source,
    timestamp: body.timestamp,
    metadata,
  });
}

export function matchesObservationFilter(
  observation: NormalizedObservation,
  filter: ObservationFilter,
): boolean {
  if (filter.providers?.length && !filter.providers.includes(observation.provider)) {
    return false;
  }
  if (filter.categories?.length && !filter.categories.includes(observation.category)) {
    return false;
  }
  if (filter.metrics?.length && !filter.metrics.includes(observation.metric)) {
    return false;
  }
  if (filter.platforms?.length) {
    const platform = observation.platform ?? "";
    if (!filter.platforms.includes(platform)) return false;
  }
  if (filter.businessId && observation.businessId !== filter.businessId) return false;
  if (filter.competitorId && observation.competitorId !== filter.competitorId) return false;

  const collectedAt = Date.parse(observation.collectedAt);
  if (filter.collectedAfter) {
    const after = Date.parse(filter.collectedAfter);
    if (Number.isFinite(after) && collectedAt < after) return false;
  }
  if (filter.collectedBefore) {
    const before = Date.parse(filter.collectedBefore);
    if (Number.isFinite(before) && collectedAt > before) return false;
  }

  return true;
}

export function applyObservationFilters(
  observations: NormalizedObservation[],
  filters: ObservationFilter[],
): NormalizedObservation[] {
  if (filters.length === 0) return [];

  const matched = observations.filter((observation) =>
    filters.some((filter) => matchesObservationFilter(observation, filter)),
  );

  const seen = new Set<string>();
  const deduped: NormalizedObservation[] = [];
  for (const observation of matched) {
    if (seen.has(observation.observationId)) continue;
    seen.add(observation.observationId);
    deduped.push(observation);
  }

  return deduped.sort(
    (left, right) => Date.parse(right.collectedAt) - Date.parse(left.collectedAt),
  );
}

export async function retrieveObservations(
  store: ObservationRetrievalStore,
  scope: {
    workspaceId: string;
    filters: ObservationFilter[];
  },
): Promise<NormalizedObservation[]> {
  const rows = await store.listObservationMemories(scope.workspaceId);
  const observations: NormalizedObservation[] = [];

  for (const row of rows) {
    const normalized = recordToNormalizedObservation(scope.workspaceId, row);
    if (normalized) observations.push(normalized);
  }

  return applyObservationFilters(observations, scope.filters);
}
