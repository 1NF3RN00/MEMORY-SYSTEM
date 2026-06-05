import type { Observation } from "@memory-middleware/shared-types";
import { storeObservation, type ObservationIngestionDeps, type StoreObservationResult } from "./store.js";

export interface StoreObservationBatchResult {
  results: StoreObservationResult[];
  observationIds: string[];
}

export async function storeObservationBatch(
  deps: ObservationIngestionDeps,
  observations: Observation[],
): Promise<StoreObservationBatchResult> {
  const results: StoreObservationResult[] = [];
  for (const observation of observations) {
    results.push(await storeObservation(deps, observation));
  }
  return {
    results,
    observationIds: results.map((result) => result.observationId),
  };
}
