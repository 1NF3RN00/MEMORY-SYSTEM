export {
  buildAdjacencyView,
  generateAdjacency,
  assignSemanticGroups,
  type ChunkWithLineage,
} from "./adjacency.js";
export {
  structureAwareChunk,
  toCanonicalChunks,
  averageDensityScore,
  type StructureAwareChunkInput,
} from "./chunker.js";
export {
  extractSemanticSurface,
  buildChunkRetrievalSurface,
  buildEnrichedEmbeddingText,
} from "./semantic-enrichment.js";
export {
  computeSemanticDensity,
  computeInformationalConcentration,
  computeContextualUniqueness,
  averageDensityScore as averageDensity,
} from "./density.js";
export {
  parseMarkdownStructure,
  splitSectionOnBoundaries,
  type ParsedDocument,
  type ParsedSection,
} from "./parser.js";
export { estimateTokens } from "./token-estimator.js";
export {
  emitStructureParsingCompleted,
  emitSemanticSegmentationCompleted,
  emitAdjacencyGenerationCompleted,
  emitSemanticDensityScored,
  emitStructuralFallback,
  emitReinforcementUpdated,
  emitDecayUpdated,
  emitArchivalTransitioned,
  emitRetrievalExpansionApplied,
} from "./events.js";
