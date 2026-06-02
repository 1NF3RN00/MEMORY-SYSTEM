import type {
  HistorianCompressionArtifact,
  HistorianDeliveryArtifact,
  ReplayMode,
  ReplayResult,
  ReplaySnapshot,
  ReplayStage,
  ReplayStageName,
} from "@memory-middleware/shared-types";
import type {
  ContextPackage,
  PreprocessedQuery,
  RankingBreakdown,
  RetrievalMode,
  RetrievalStageRecord,
} from "@memory-middleware/shared-types";
import { newUlid } from "@memory-middleware/shared-types";
import { computeReplayIntegrityHash, validateReplayIntegrity } from "./integrity.js";

export interface BuildSnapshotInput {
  retrievalTraceId: string;
  workspaceId: string;
  originalQuery: string;
  retrievalMode: RetrievalMode;
  tokenBudget: number;
  contextPackage: ContextPackage;
  retrievalStages: RetrievalStageRecord[];
  preprocessedQuery?: PreprocessedQuery;
  compressionArtifacts?: HistorianCompressionArtifact[];
  deliveryArtifacts?: HistorianDeliveryArtifact[];
}

const RETRIEVAL_STAGE_MAP: Record<string, ReplayStageName | null> = {
  preprocessing: "preprocessing",
  vector_retrieval: "vector_retrieval",
  reranking: "reranking",
  deduplication: "deduplication",
  token_budgeting: null,
  context_assembly: "context_assembly",
};

function stageRecordToReplayStage(
  record: RetrievalStageRecord,
  stageName: ReplayStageName,
  inputs: unknown,
  outputs: unknown,
): ReplayStage | null {
  if (record.status !== "completed") return null;

  return {
    stage: stageName,
    inputs,
    outputs,
    latencyMs: record.latencyMs ?? 0,
    timestamp: record.completedAt ?? record.startedAt,
  };
}

export function buildReplayStages(input: BuildSnapshotInput): ReplayStage[] {
  const stages: ReplayStage[] = [];

  for (const record of input.retrievalStages) {
    const mapped = RETRIEVAL_STAGE_MAP[record.stage];
    if (!mapped) continue;

    let stageInputs: unknown = { query: input.originalQuery };
    let stageOutputs: unknown = record.metadata ?? {};

    if (mapped === "preprocessing" && input.preprocessedQuery) {
      stageOutputs = input.preprocessedQuery;
    }
    if (mapped === "context_assembly") {
      stageOutputs = {
        memoryCount: input.contextPackage.memories.length,
        tokenBudget: input.contextPackage.tokenBudget,
        finalChunkCount: input.contextPackage.retrievalMetadata.finalChunkCount,
      };
    }

    const replayStage = stageRecordToReplayStage(record, mapped, stageInputs, stageOutputs);
    if (replayStage) stages.push(replayStage);
  }

  for (const artifact of input.compressionArtifacts ?? []) {
    const compressionLatency = artifact.stageTraces.reduce(
      (sum, t) => sum + (t.metadata?.latencyMs as number | undefined ?? 0),
      0,
    );

    stages.push({
      stage: "compression",
      inputs: {
        retrievalTraceId: artifact.retrievalTraceId,
        fidelityMode: artifact.fidelityMode,
        sourceTokens: artifact.optimizedContextPackage?.compressionMetadata.originalTokens,
      },
      outputs: {
        mergeDecisions: artifact.mergeDecisions,
        trimmingDecisions: artifact.trimmingDecisions,
        stageTraces: artifact.stageTraces,
        fidelityReport: artifact.fidelityReport,
        optimizedTokens: artifact.optimizedContextPackage?.compressionMetadata.optimizedTokens,
      },
      latencyMs: compressionLatency,
      timestamp: artifact.optimizedContextPackage?.generatedAt ?? new Date().toISOString(),
    });
  }

  for (const artifact of input.deliveryArtifacts ?? []) {
    const deliveryLatency = artifact.stages.reduce((sum, s) => sum + (s.latencyMs ?? 0), 0);

    stages.push({
      stage: "context_delivery",
      inputs: {
        retrievalTraceId: artifact.retrievalTraceId,
        compressionTraceId: artifact.compressionTraceId,
        mode: artifact.mode,
      },
      outputs: {
        deliveryContext: artifact.deliveryContext,
        renderingDecisions: artifact.renderingDecisions,
        tokenCount: artifact.deliveryContext.tokenCount,
      },
      latencyMs: deliveryLatency,
      timestamp: artifact.deliveryContext.generatedAt,
    });
  }

  return stages.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
}

export function buildReplaySnapshot(input: BuildSnapshotInput): ReplaySnapshot {
  const stages = buildReplayStages(input);
  const rankingBreakdowns =
    input.contextPackage.rankingBreakdown.length > 0
      ? input.contextPackage.rankingBreakdown
      : input.contextPackage.chunkTraces.map(
          (t): RankingBreakdown => ({
            memoryId: t.memoryId,
            chunkId: t.chunkId,
            semanticSimilarity: t.semanticSimilarity,
            importanceBoost: t.importanceBoost,
            recencyBoost: t.recencyBoost,
            reinforcementBoost: t.reinforcementBoost,
            semanticDensityBoost: t.semanticDensityBoost,
            finalScore: t.finalScore,
            weights: {
              importance: 0.12,
              recency: 0.08,
              reinforcement: 0.06,
              semanticDensity: 0.05,
            },
            rankingRank: t.rankingRank,
          }),
        );

  const base = {
    retrievalTraceId: input.retrievalTraceId,
    workspaceId: input.workspaceId,
    originalQuery: input.originalQuery,
    retrievalMode: input.retrievalMode,
    tokenBudget: input.tokenBudget,
    stages,
    contextPackage: input.contextPackage,
    compressionArtifacts: input.compressionArtifacts ?? [],
    deliveryArtifacts: input.deliveryArtifacts ?? [],
    rankingBreakdowns,
    ...(input.preprocessedQuery ? { preprocessedQuery: input.preprocessedQuery } : {}),
  };

  const integrityHash = computeReplayIntegrityHash(base);

  return {
    replayId: newUlid(),
    ...base,
    integrityHash,
    replayTimestamp: new Date().toISOString(),
  };
}

export function executeReplay(
  snapshot: ReplaySnapshot,
  mode: ReplayMode = "exact",
  stageFilter?: ReplayStageName,
): ReplayResult {
  const integrityValid = validateReplayIntegrity(snapshot);

  let reconstructedStages = snapshot.stages;

  if (mode === "stage" && stageFilter) {
    reconstructedStages = snapshot.stages.filter((s) => s.stage === stageFilter);
  }

  return {
    replayId: snapshot.replayId,
    retrievalTraceId: snapshot.retrievalTraceId,
    mode,
    snapshot,
    integrityValid,
    reconstructedStages,
    replayedAt: new Date().toISOString(),
  };
}

export function reconstructContextFromSnapshot(snapshot: ReplaySnapshot): ContextPackage {
  return snapshot.contextPackage;
}

export function reconstructStageOutputs(
  snapshot: ReplaySnapshot,
  stage: ReplayStageName,
): ReplayStage | undefined {
  return snapshot.stages.find((s) => s.stage === stage);
}
