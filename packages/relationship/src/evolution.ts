import type { RelationshipEvolutionEntry } from "@memory-middleware/shared-types";

export function createEvolutionEntry(
  event: RelationshipEvolutionEntry["event"],
  previous: { confidence: number; weight: number },
  next: { confidence: number; weight: number },
  reason: string,
): RelationshipEvolutionEntry {
  return {
    timestamp: new Date().toISOString(),
    event,
    previousConfidence: previous.confidence,
    newConfidence: next.confidence,
    previousWeight: previous.weight,
    newWeight: next.weight,
    reason,
  };
}

/** Deterministic reinforcement — bounded increment based on co-occurrence. */
export function reinforceRelationship(
  current: { confidence: number; weight: number; retrievalFrequency: number },
  coOccurrenceDelta: number,
): {
  confidence: number;
  weight: number;
  retrievalFrequency: number;
  evolution: RelationshipEvolutionEntry;
} {
  const frequencyBoost = Math.min(0.05, coOccurrenceDelta * 0.02);
  const weightBoost = Math.min(0.08, coOccurrenceDelta * 0.03);
  const newFrequency = current.retrievalFrequency + coOccurrenceDelta;
  const newWeight = Math.min(1, current.weight + weightBoost);
  const newConfidence = Math.min(1, current.confidence + frequencyBoost);

  return {
    confidence: newConfidence,
    weight: newWeight,
    retrievalFrequency: newFrequency,
    evolution: createEvolutionEntry(
      "co_occurrence",
      { confidence: current.confidence, weight: current.weight },
      { confidence: newConfidence, weight: newWeight },
      `Retrieval co-occurrence reinforced (+${coOccurrenceDelta})`,
    ),
  };
}

export function appendEvolutionHistory(
  history: RelationshipEvolutionEntry[],
  entry: RelationshipEvolutionEntry,
  maxEntries = 50,
): RelationshipEvolutionEntry[] {
  return [...history, entry].slice(-maxEntries);
}
