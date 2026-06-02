export {
  applyReinforcement,
  createInitialEvolution,
  recordRetrieval,
  type ReinforcementInput,
  type ReinforcementResult,
} from "./reinforcement.js";
export {
  applyRecencyDecay,
  recencyBoostFromEvolution,
  type RecencyDecayResult,
} from "./recency-decay.js";
export {
  evaluateArchivalEligibility,
  transitionToArchived,
  type ArchivalEvaluation,
} from "./archival.js";
export {
  evolutionFromScoring,
  scoringFromEvolution,
  reinforceMemory,
  updateDecay,
  onRetrieval,
  prepareArchive,
  buildEvolutionView,
  type EvolutionState,
} from "./evolution.js";
