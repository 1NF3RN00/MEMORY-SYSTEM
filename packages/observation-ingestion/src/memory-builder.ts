import { estimateTokens, type PipelineJobInput } from "@memory-middleware/ingestion";
import { newUlid, type Observation } from "@memory-middleware/shared-types";

export function buildObservationBody(observation: Observation): string {
  return JSON.stringify({
    metric: observation.metric,
    value: observation.value,
    source: observation.source,
    timestamp: observation.timestamp,
  });
}

export function buildObservationPipelineInput(
  observation: Observation,
  traceId: string,
): PipelineJobInput {
  const body = buildObservationBody(observation);
  const chunkId = newUlid();

  const input: PipelineJobInput = {
    workspaceId: observation.workspaceId,
    traceId,
    sourceType: "json",
    persistenceMode: "persistent",
    memoryType: "observation",
    rawContent: body,
    title: `${observation.metadata.provider}/${observation.metric}`,
    memoryId: observation.observationId,
    metadataPatch: {
      isObservation: true,
      observation: observation.metadata,
    },
    fixedChunks: [
      {
        id: chunkId,
        memoryId: observation.observationId,
        chunkIndex: 0,
        content: body,
        tokenCount: estimateTokens(body),
        embeddingStatus: "pending",
        metadata: {
          chunkingStrategy: "observation-v1",
        },
        observability: {
          retrievalCount: 0,
        },
        createdAt: new Date().toISOString(),
      },
    ],
  };

  if (observation.metadata.sourceLabel) {
    input.sourceLabel = observation.metadata.sourceLabel;
    input.metadataPatch = {
      ...input.metadataPatch,
      sourceLabel: observation.metadata.sourceLabel,
    };
  }

  return input;
}
