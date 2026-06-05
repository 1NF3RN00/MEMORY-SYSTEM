import type { EmbeddingClient } from "@memory-middleware/ingestion";
import { runIngestionPipeline } from "@memory-middleware/ingestion";
import type { EventEmitter } from "@memory-middleware/observability";
import type { PipelineStore } from "@memory-middleware/ingestion";
import type { Observation, ObservationMetadata } from "@memory-middleware/shared-types";
import { emitObservationEvent, OBSERVATION_EVENT_TYPES } from "./events.js";
import {
  matchesObservationIdentity,
  observationIdentity,
  type ObservationIdentity,
} from "./identity.js";
import { buildObservationPipelineInput } from "./memory-builder.js";

export interface StoredObservationRecord {
  memoryId: string;
  collectedAt: string;
  metadata: ObservationMetadata;
}

export interface ObservationIngestionStore {
  createIngestionTrace(workspaceId: string, traceId: string): Promise<void>;
  listActiveObservations(workspaceId: string): Promise<StoredObservationRecord[]>;
  archiveMemory(memoryId: string): Promise<void>;
  pipelineStore: PipelineStore;
}

export interface ObservationIngestionDeps {
  store: ObservationIngestionStore;
  events: EventEmitter;
  embeddingClient: EmbeddingClient | null;
  traceId: string;
}

export interface StoreObservationResult {
  memoryId: string;
  observationId: string;
  supersededMemoryIds: string[];
  eventType:
    | typeof OBSERVATION_EVENT_TYPES.OBSERVATION_CREATED
    | typeof OBSERVATION_EVENT_TYPES.OBSERVATION_UPDATED;
}

function parseObservationMetadata(metadata: unknown): ObservationMetadata | null {
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
  const parsed: ObservationMetadata = {
    provider: obs.provider,
    category: obs.category,
    metric: obs.metric,
    collectedAt: obs.collectedAt,
  };
  if (typeof obs.businessId === "string") parsed.businessId = obs.businessId;
  if (typeof obs.competitorId === "string") parsed.competitorId = obs.competitorId;
  if (typeof obs.platform === "string") parsed.platform = obs.platform;
  if (typeof obs.unit === "string") parsed.unit = obs.unit;
  if (typeof obs.sourceLabel === "string") parsed.sourceLabel = obs.sourceLabel;
  return parsed;
}

async function findSupersededMemories(
  store: ObservationIngestionStore,
  observation: Observation,
): Promise<StoredObservationRecord[]> {
  const identity = observationIdentity(observation);
  const newCollectedAt = Date.parse(observation.metadata.collectedAt);
  const candidates = await store.listActiveObservations(observation.workspaceId);

  return candidates.filter((record) => {
    if (!matchesObservationIdentity(record.metadata, observation.workspaceId, identity)) {
      return false;
    }
    const existingCollectedAt = Date.parse(record.collectedAt);
    return Number.isFinite(existingCollectedAt) && existingCollectedAt <= newCollectedAt;
  });
}

export async function storeObservation(
  deps: ObservationIngestionDeps,
  observation: Observation,
): Promise<StoreObservationResult> {
  await deps.store.createIngestionTrace(observation.workspaceId, deps.traceId);

  const superseded = await findSupersededMemories(deps.store, observation);
  for (const prior of superseded) {
    await deps.store.archiveMemory(prior.memoryId);
    await emitObservationEvent(deps.events, OBSERVATION_EVENT_TYPES.OBSERVATION_ARCHIVED, {
      traceId: deps.traceId,
      workspaceId: observation.workspaceId,
      observationId: prior.memoryId,
      provider: prior.metadata.provider,
      category: prior.metadata.category,
      metric: prior.metadata.metric,
      extra: { superseded_by: observation.observationId },
    });
  }

  const pipelineInput = buildObservationPipelineInput(observation, deps.traceId);
  await runIngestionPipeline(pipelineInput, {
    events: deps.events,
    store: deps.store.pipelineStore,
    embeddingClient: deps.embeddingClient,
  });

  const eventType =
    superseded.length > 0
      ? OBSERVATION_EVENT_TYPES.OBSERVATION_UPDATED
      : OBSERVATION_EVENT_TYPES.OBSERVATION_CREATED;

  await emitObservationEvent(deps.events, eventType, {
    traceId: deps.traceId,
    workspaceId: observation.workspaceId,
    observationId: observation.observationId,
    provider: observation.metadata.provider,
    category: observation.metadata.category,
    metric: observation.metadata.metric,
    extra: {
      superseded_count: superseded.length,
      value: observation.value,
    },
  });

  return {
    memoryId: observation.observationId,
    observationId: observation.observationId,
    supersededMemoryIds: superseded.map((record) => record.memoryId),
    eventType,
  };
}

export { parseObservationMetadata, type ObservationIdentity };
