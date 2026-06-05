import type { NormalizedObservation } from "@memory-middleware/shared-types";
import { recordToNormalizedObservation } from "@memory-middleware/retrieval";
import { parseObservationMetadata } from "@memory-middleware/observation-ingestion";

export interface ObservationListQuery {
  provider?: string;
  category?: string;
  metric?: string;
  businessId?: string;
  competitorId?: string;
  collectedAfter?: string;
  collectedBefore?: string;
}

export function memoryRowToNormalizedObservation(
  workspaceId: string,
  row: {
    id: string;
    metadata: unknown;
    chunks: Array<{ content: string }>;
  },
): NormalizedObservation | null {
  if (!row.chunks[0]) return null;
  return recordToNormalizedObservation(workspaceId, {
    memoryId: row.id,
    metadata: row.metadata,
    chunkContent: row.chunks[0].content,
  });
}

export function matchesObservationQuery(
  observation: NormalizedObservation,
  query: ObservationListQuery,
): boolean {
  if (query.provider && observation.provider !== query.provider) return false;
  if (query.category && observation.category !== query.category) return false;
  if (query.metric && observation.metric !== query.metric) return false;
  if (query.businessId && observation.businessId !== query.businessId) return false;
  if (query.competitorId && observation.competitorId !== query.competitorId) return false;

  const collectedAt = Date.parse(observation.collectedAt);
  if (query.collectedAfter) {
    const after = Date.parse(query.collectedAfter);
    if (Number.isFinite(after) && collectedAt < after) return false;
  }
  if (query.collectedBefore) {
    const before = Date.parse(query.collectedBefore);
    if (Number.isFinite(before) && collectedAt > before) return false;
  }

  return true;
}

export function parseObservationMemoryMetadata(metadata: unknown): {
  provider: string;
  category: string;
  metric: string;
} | null {
  const parsed = parseObservationMetadata(metadata);
  if (!parsed) return null;
  return {
    provider: parsed.provider,
    category: parsed.category,
    metric: parsed.metric,
  };
}
