function tokenSet(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/i)
      .filter((t) => t.length > 2),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export interface MemoryForGeneration {
  memoryId: string;
  title: string;
  memoryType: string;
  sourceType: string;
  ingestionTraceId?: string;
  tags: string[];
  contentTokens: Set<string>;
}

export interface GeneratedRelationshipCandidate {
  sourceMemoryId: string;
  targetMemoryId: string;
  relationshipType:
    | "semantic_similarity"
    | "structural_adjacency"
    | "metadata_overlap"
    | "retrieval_cooccurrence"
    | "operational_association";
  weight: number;
  generatedFrom: string[];
  metadata: Record<string, unknown>;
}

function deriveDomain(memoryType: string, sourceType: string): string {
  if (memoryType && memoryType !== "generic") return memoryType;
  if (sourceType && sourceType !== "unknown") return sourceType;
  return "operational";
}

function tagOverlap(tagsA: string[], tagsB: string[]): number {
  if (tagsA.length === 0 || tagsB.length === 0) return 0;
  const setA = new Set(tagsA.map((t) => t.toLowerCase()));
  let overlap = 0;
  for (const tag of tagsB) {
    if (setA.has(tag.toLowerCase())) overlap += 1;
  }
  return overlap / Math.max(setA.size, tagsB.length);
}

export interface CoOccurrencePair {
  memoryIdA: string;
  memoryIdB: string;
  count: number;
}

/** Generate deterministic relationships from workspace memory data. */
export function generateRelationships(
  memories: MemoryForGeneration[],
  coOccurrences: CoOccurrencePair[],
  options: {
    confidenceThreshold?: number;
    sources?: Array<
      | "semantic_similarity"
      | "structural_adjacency"
      | "metadata_overlap"
      | "retrieval_cooccurrence"
      | "operational_domain_overlap"
    >;
    anchorMemoryId?: string;
  } = {},
): GeneratedRelationshipCandidate[] {
  const threshold = options.confidenceThreshold ?? 0.45;
  const sources = new Set(
    options.sources ?? [
      "semantic_similarity",
      "structural_adjacency",
      "metadata_overlap",
      "retrieval_cooccurrence",
      "operational_domain_overlap",
    ],
  );

  const candidates: GeneratedRelationshipCandidate[] = [];
  const memoryList = options.anchorMemoryId
    ? memories.filter((m) => m.memoryId === options.anchorMemoryId)
    : memories;

  for (let i = 0; i < memoryList.length; i += 1) {
    for (let j = i + 1; j < memories.length; j += 1) {
      const a = memoryList[i]!;
      const b = memories[j]!;

      if (sources.has("semantic_similarity")) {
        const overlap = jaccard(a.contentTokens, b.contentTokens);
        if (overlap >= threshold) {
          candidates.push({
            sourceMemoryId: a.memoryId,
            targetMemoryId: b.memoryId,
            relationshipType: "semantic_similarity",
            weight: overlap,
            generatedFrom: ["semantic similarity"],
            metadata: { semanticOverlap: overlap, overlapScore: overlap },
          });
        }
      }

      if (sources.has("metadata_overlap")) {
        const tagScore = tagOverlap(a.tags, b.tags);
        const lineageMatch =
          a.ingestionTraceId && a.ingestionTraceId === b.ingestionTraceId ? 0.7 : 0;
        const metaScore = Math.max(tagScore, lineageMatch);
        if (metaScore >= threshold) {
          const from: string[] = [];
          if (tagScore >= threshold) from.push("metadata overlap");
          if (lineageMatch > 0) from.push("shared lineage");
          candidates.push({
            sourceMemoryId: a.memoryId,
            targetMemoryId: b.memoryId,
            relationshipType: "metadata_overlap",
            weight: metaScore,
            generatedFrom: from,
            metadata: { metadataOverlap: metaScore, tagOverlap: tagScore },
          });
        }
      }

      if (sources.has("operational_domain_overlap")) {
        const domainA = deriveDomain(a.memoryType, a.sourceType);
        const domainB = deriveDomain(b.memoryType, b.sourceType);
        if (domainA === domainB && domainA !== "operational") {
          candidates.push({
            sourceMemoryId: a.memoryId,
            targetMemoryId: b.memoryId,
            relationshipType: "operational_association",
            weight: 0.75,
            generatedFrom: ["operational domain overlap"],
            metadata: { operationalDomainOverlap: 0.75, domain: domainA },
          });
        }
      }
    }
  }

  if (sources.has("retrieval_cooccurrence")) {
    for (const pair of coOccurrences) {
      const score = Math.min(1, pair.count * 0.15);
      if (score >= threshold) {
        candidates.push({
          sourceMemoryId: pair.memoryIdA,
          targetMemoryId: pair.memoryIdB,
          relationshipType: "retrieval_cooccurrence",
          weight: score,
          generatedFrom: ["retrieval co-occurrence"],
          metadata: {
            retrievalCoOccurrence: score,
            coOccurrenceCount: pair.count,
          },
        });
      }
    }
  }

  return dedupeCandidates(candidates);
}

function dedupeCandidates(
  candidates: GeneratedRelationshipCandidate[],
): GeneratedRelationshipCandidate[] {
  const seen = new Map<string, GeneratedRelationshipCandidate>();

  for (const c of candidates) {
    const key = `${c.sourceMemoryId}:${c.targetMemoryId}:${c.relationshipType}`;
    const existing = seen.get(key);
    if (!existing || c.weight > existing.weight) {
      seen.set(key, c);
    }
  }

  return [...seen.values()].sort((a, b) => b.weight - a.weight);
}

export function buildContentTokens(chunks: Array<{ content: string }>): Set<string> {
  const combined = chunks.map((c) => c.content).join(" ");
  return tokenSet(combined);
}
