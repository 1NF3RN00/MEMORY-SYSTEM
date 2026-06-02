import type {
  ContextPackage,
  MetadataExpansionResult,
  PreprocessingEnhancementResult,
  QueryHints,
} from "@memory-middleware/shared-types";

const TAG_SYNONYMS: Record<string, string[]> = {
  policy: ["policy", "policies", "rule", "rules", "guideline"],
  decision: ["decision", "decisions", "resolution", "determination"],
  meeting: ["meeting", "meetings", "standup", "sync", "discussion"],
  technical: ["technical", "engineering", "architecture", "implementation"],
  customer: ["customer", "client", "user", "stakeholder"],
};

export function buildQueryHints(
  query: string,
  keywords: string[],
): QueryHints {
  const normalized = query.toLowerCase();
  const retrievalHints: string[] = [];
  const contextualWeights: Record<string, number> = {};

  for (const keyword of keywords) {
    retrievalHints.push(`keyword:${keyword}`);
    if (normalized.includes(keyword)) {
      contextualWeights[`keyword:${keyword}`] = 1.15;
    }
  }

  if (normalized.includes("recent") || normalized.includes("latest")) {
    retrievalHints.push("recency:boost");
  }
  if (normalized.includes("important") || normalized.includes("critical")) {
    retrievalHints.push("importance:boost");
  }

  const metadataTags = expandTags(keywords);

  return {
    retrievalHints,
    contextualWeights,
    metadataTags,
  };
}

export function expandMetadata(
  pkg: ContextPackage,
  expandedTags: string[],
): MetadataExpansionResult {
  const matchedMetadataKeys: string[] = [];
  let enrichmentScore = 0;

  for (const memory of pkg.memories) {
    const memoryType = memory.memoryType.toLowerCase();
    if (expandedTags.some((t) => memoryType.includes(t) || t.includes(memoryType))) {
      matchedMetadataKeys.push(`memoryType:${memory.memoryType}`);
      enrichmentScore += 0.1;
    }

    if (memory.title) {
      const titleLower = memory.title.toLowerCase();
      for (const tag of expandedTags) {
        if (titleLower.includes(tag)) {
          matchedMetadataKeys.push(`title:${memory.memoryId}`);
          enrichmentScore += 0.05;
        }
      }
    }
  }

  return {
    expandedTags,
    matchedMetadataKeys: [...new Set(matchedMetadataKeys)],
    enrichmentScore: Math.min(1, enrichmentScore),
  };
}

export function applyPreprocessingEnhancements(
  pkg: ContextPackage,
  keywords: string[],
): PreprocessingEnhancementResult {
  const queryHints = buildQueryHints(pkg.query, keywords);
  const metadataExpansion = expandMetadata(pkg, queryHints.metadataTags);

  return { queryHints, metadataExpansion };
}

export function deriveContextualWeights(
  pkg: ContextPackage,
  preprocessing: PreprocessingEnhancementResult,
): Record<string, number> {
  const weights: Record<string, number> = {};

  for (const memory of pkg.memories) {
    for (const chunk of memory.chunks) {
      let weight = 1;

      for (const tag of preprocessing.metadataExpansion.expandedTags) {
        if (
          chunk.content.toLowerCase().includes(tag) ||
          memory.title.toLowerCase().includes(tag)
        ) {
          weight += 0.08;
        }
      }

      for (const hint of preprocessing.queryHints.retrievalHints) {
        const keyword = hint.replace("keyword:", "");
        if (chunk.content.toLowerCase().includes(keyword)) {
          weight += 0.05;
        }
      }

      weights[chunk.chunkId] = Math.min(1.5, weight);
    }
  }

  return weights;
}

function expandTags(keywords: string[]): string[] {
  const expanded = new Set<string>(keywords);

  for (const keyword of keywords) {
    for (const [root, synonyms] of Object.entries(TAG_SYNONYMS)) {
      if (synonyms.some((s) => keyword.includes(s) || s.includes(keyword))) {
        expanded.add(root);
        for (const syn of synonyms) expanded.add(syn);
      }
    }
  }

  return [...expanded].sort();
}
