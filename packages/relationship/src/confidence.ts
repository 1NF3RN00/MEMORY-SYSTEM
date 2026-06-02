import type {
  ConfidenceReasoning,
  RelationshipType,
} from "@memory-middleware/shared-types";
import { normalizeRelationshipType } from "@memory-middleware/shared-types";

export interface ConfidenceInput {
  relationshipType: RelationshipType;
  weight: number;
  metadata?: Record<string, unknown>;
}

const ORIGIN_EXPLANATIONS: Record<string, string> = {
  semantic_similarity: "High semantic token overlap between memories",
  structural_adjacency: "Structural adjacency — sequential or contextual proximity",
  metadata_overlap: "Shared metadata tags, domains, or lineage",
  retrieval_cooccurrence: "Frequently retrieved together in context assemblies",
  operational_association: "Shared operational domain or memory type grouping",
};

export function computeConfidenceReasoning(input: ConfidenceInput): ConfidenceReasoning {
  const meta = input.metadata ?? {};
  const normalized = normalizeRelationshipType(input.relationshipType);

  const semanticOverlap = Number(
    meta.semanticOverlap ?? meta.semantic_overlap ?? meta.overlapScore ??
      (normalized === "semantic_similarity" ? input.weight : 0),
  );
  const metadataOverlap = Number(
    meta.metadataOverlap ?? meta.metadata_overlap ?? meta.tagOverlap ??
      (normalized === "metadata_overlap" ? input.weight : 0),
  );
  const structuralAdjacency = Number(
    meta.structuralAdjacency ?? meta.structural_adjacency ??
      (normalized === "structural_adjacency" ? input.weight : 0),
  );
  const retrievalCoOccurrence = Number(
    meta.retrievalCoOccurrence ?? meta.co_retrieval_count ?? meta.coOccurrenceCount ??
      (normalized === "retrieval_cooccurrence" ? input.weight : 0),
  );
  const operationalDomainOverlap = Number(
    meta.operationalDomainOverlap ?? meta.domain_overlap ??
      (normalized === "operational_association" ? input.weight : 0),
  );

  const weights: Record<string, number> = {
    semantic_similarity: 0.45,
    structural_adjacency: 0.2,
    metadata_overlap: 0.15,
    retrieval_cooccurrence: 0.12,
    operational_association: 0.08,
  };

  const w = weights[normalized] ?? 0.2;
  const signal =
    normalized === "semantic_similarity"
      ? semanticOverlap
      : normalized === "structural_adjacency"
        ? structuralAdjacency
        : normalized === "metadata_overlap"
          ? metadataOverlap
          : normalized === "retrieval_cooccurrence"
            ? retrievalCoOccurrence
            : operationalDomainOverlap;

  const confidence = Math.min(1, input.weight * w + signal * (1 - w));

  const parts: string[] = [];
  if (semanticOverlap > 0) parts.push(`${semanticOverlap.toFixed(2)} semantic overlap`);
  if (metadataOverlap > 0) parts.push(`${metadataOverlap.toFixed(2)} metadata overlap`);
  if (structuralAdjacency > 0) parts.push(`${structuralAdjacency.toFixed(2)} structural adjacency`);
  if (retrievalCoOccurrence > 0) parts.push(`${retrievalCoOccurrence.toFixed(2)} co-occurrence`);
  if (operationalDomainOverlap > 0) {
    parts.push(`${operationalDomainOverlap.toFixed(2)} operational domain overlap`);
  }

  const base = ORIGIN_EXPLANATIONS[normalized] ?? "Deterministic relationship derivation";
  const explanation =
    parts.length > 0
      ? `${base} (${parts.join(", ")})`
      : `${base} (weight=${input.weight.toFixed(2)})`;

  return {
    semanticOverlap,
    metadataOverlap,
    structuralAdjacency,
    retrievalCoOccurrence,
    operationalDomainOverlap,
    explanation,
  };
}

export function computeConfidence(input: ConfidenceInput): number {
  return scoreRelationshipConfidence(input);
}

/** Deterministic weighted confidence — primary scoring function. */
export function scoreRelationshipConfidence(input: ConfidenceInput): number {
  const reasoning = computeConfidenceReasoning(input);
  const normalized = normalizeRelationshipType(input.relationshipType);

  const typeWeight =
    normalized === "semantic_similarity"
      ? reasoning.semanticOverlap
      : normalized === "metadata_overlap"
        ? reasoning.metadataOverlap
        : normalized === "structural_adjacency"
          ? reasoning.structuralAdjacency
          : normalized === "retrieval_cooccurrence"
            ? reasoning.retrievalCoOccurrence
            : reasoning.operationalDomainOverlap;

  return Math.min(1, input.weight * 0.4 + typeWeight * 0.6);
}
