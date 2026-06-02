import type { MemoryRelationshipType } from "./types.js";

export const RELATIONSHIP_COLORS: Record<
  MemoryRelationshipType,
  { stroke: string; glow: string; label: string }
> = {
  co_retrieval: {
    stroke: "#38bdf8",
    glow: "rgba(56, 189, 248, 0.6)",
    label: "Co-Retrieval",
  },
  retrieval_cooccurrence: {
    stroke: "#38bdf8",
    glow: "rgba(56, 189, 248, 0.6)",
    label: "Retrieval Co-Occurrence",
  },
  semantic_overlap: {
    stroke: "#a78bfa",
    glow: "rgba(167, 139, 250, 0.6)",
    label: "Semantic Overlap",
  },
  semantic_similarity: {
    stroke: "#a78bfa",
    glow: "rgba(167, 139, 250, 0.6)",
    label: "Semantic Similarity",
  },
  same_lineage: {
    stroke: "#4ade80",
    glow: "rgba(74, 222, 128, 0.5)",
    label: "Same Lineage",
  },
  metadata_overlap: {
    stroke: "#4ade80",
    glow: "rgba(74, 222, 128, 0.5)",
    label: "Metadata Overlap",
  },
  chunk_adjacency: {
    stroke: "#71717a",
    glow: "rgba(113, 113, 122, 0.4)",
    label: "Chunk Adjacency",
  },
  structural_adjacency: {
    stroke: "#71717a",
    glow: "rgba(113, 113, 122, 0.4)",
    label: "Structural Adjacency",
  },
  operational_association: {
    stroke: "#fbbf24",
    glow: "rgba(251, 191, 36, 0.5)",
    label: "Operational Association",
  },
};

export const DOMAIN_COLORS = [
  "#38bdf8",
  "#4ade80",
  "#fbbf24",
  "#a78bfa",
  "#f87171",
  "#fb923c",
  "#2dd4bf",
  "#e879f9",
];

export function domainColor(index: number): string {
  return DOMAIN_COLORS[index % DOMAIN_COLORS.length]!;
}

export const EVENT_TYPE_LABELS: Record<string, string> = {
  relationship_created: "REL",
  relationship_updated: "REL↑",
  reinforcement: "REIN",
  archival: "ARCH",
  retrieval: "RETR",
  compression: "COMP",
};
