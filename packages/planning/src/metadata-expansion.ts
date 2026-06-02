import type {
  ExpansionReason,
  PlanningMetadataExpansion,
  QueryDecomposition,
} from "@memory-middleware/shared-types";

const TAG_SYNONYMS: Record<string, string[]> = {
  policy: ["policy", "policies", "rule", "rules", "guideline"],
  decision: ["decision", "decisions", "resolution", "determination"],
  meeting: ["meeting", "meetings", "standup", "sync", "discussion"],
  technical: ["technical", "engineering", "architecture", "implementation"],
  customer: ["customer", "client", "user", "stakeholder"],
  incident: ["incident", "outage", "failure", "alert", "degradation"],
  operational: ["operational", "operations", "systems", "runbook"],
};

const OPERATIONAL_DOMAIN_EXPANSION: Record<string, string[]> = {
  liquidity: ["liquidity response", "capital allocation", "funding"],
  volatility: ["volatility management", "risk exposure", "market variance"],
  operations: ["operational systems", "infrastructure", "runbook"],
  incident: ["incident response", "outage", "operational priority"],
  compliance: ["compliance policy", "regulatory", "audit trail"],
  trading: ["trade execution", "market operations", "order flow"],
};

export interface WorkspaceMetadataContext {
  memoryTags: string[];
  memoryTypes: string[];
  relationships: Array<{
    sourceMemoryId: string;
    targetMemoryId: string;
    relationshipType: string;
    weight: number;
  }>;
}

export interface MetadataExpansionInput {
  keywords: string[];
  decomposedConcepts: string[];
  decomposition: QueryDecomposition;
  workspaceContext?: WorkspaceMetadataContext;
  maxTerms?: number;
}

export interface MetadataExpansionOutput {
  metadataExpansion: PlanningMetadataExpansion;
  expansionTerms: string[];
  expansionReasons: ExpansionReason[];
}

function expandTags(keywords: string[], concepts: string[]): string[] {
  const seeds = new Set([...keywords, ...concepts].map((s) => s.toLowerCase()));
  const expanded = new Set<string>(seeds);

  for (const seed of seeds) {
    for (const [root, synonyms] of Object.entries(TAG_SYNONYMS)) {
      if (synonyms.some((s) => seed.includes(s) || s.includes(seed))) {
        expanded.add(root);
        for (const syn of synonyms) expanded.add(syn);
      }
    }
  }

  return [...expanded].sort();
}

function expandOperationalDomains(domains: string[]): { terms: string[]; reasons: ExpansionReason[] } {
  const terms: string[] = [];
  const reasons: ExpansionReason[] = [];

  for (const domain of domains) {
    const domainTerms = OPERATIONAL_DOMAIN_EXPANSION[domain];
    if (!domainTerms) continue;
    for (const term of domainTerms) {
      terms.push(term);
      reasons.push({
        term,
        source: "operational_domain",
        reason: `Grounded in operational domain "${domain}" dictionary.`,
      });
    }
  }

  return { terms, reasons };
}

function expandFromWorkspaceTags(
  expandedTags: string[],
  workspaceTags: string[],
): { terms: string[]; reasons: ExpansionReason[] } {
  const terms: string[] = [];
  const reasons: ExpansionReason[] = [];

  for (const tag of workspaceTags) {
    const tagLower = tag.toLowerCase();
    if (expandedTags.some((t) => tagLower.includes(t) || t.includes(tagLower))) {
      terms.push(tag);
      reasons.push({
        term: tag,
        source: "tag",
        reason: "Matched workspace memory tag against decomposed query keywords.",
      });
    }
  }

  return { terms, reasons };
}

function expandFromRelationships(
  concepts: string[],
  relationships: WorkspaceMetadataContext["relationships"],
): { terms: string[]; reasons: ExpansionReason[] } {
  const terms: string[] = [];
  const reasons: ExpansionReason[] = [];

  for (const rel of relationships) {
    const relType = rel.relationshipType.toLowerCase();
    const matched = concepts.some((c) => relType.includes(c) || c.includes(relType));
    if (matched) {
      const term = `${rel.relationshipType}:${rel.targetMemoryId}`;
      terms.push(term);
      reasons.push({
        term,
        source: "relationship",
        reason: `Relationship type "${rel.relationshipType}" matched decomposed concept (weight ${rel.weight}).`,
      });
    }
  }

  return { terms, reasons };
}

function expandSemanticNeighbors(
  keywords: string[],
  memoryTypes: string[],
): { terms: string[]; reasons: ExpansionReason[] } {
  const terms: string[] = [];
  const reasons: ExpansionReason[] = [];

  for (const memoryType of memoryTypes) {
    const typeLower = memoryType.toLowerCase();
    if (keywords.some((k) => typeLower.includes(k) || k.includes(typeLower))) {
      terms.push(memoryType);
      reasons.push({
        term: memoryType,
        source: "semantic_neighbor",
        reason: "Memory type semantically adjacent to query keywords in workspace metadata.",
      });
    }
  }

  return { terms, reasons };
}

/** Metadata-grounded expansion — never hallucinates concepts or relationships. */
export function expandMetadata(input: MetadataExpansionInput): MetadataExpansionOutput {
  const maxTerms = input.maxTerms ?? 24;
  const expandedTags = expandTags(input.keywords, input.decomposedConcepts);
  const allReasons: ExpansionReason[] = [];
  const allTerms: string[] = [...expandedTags];

  for (const tag of expandedTags) {
    allReasons.push({
      term: tag,
      source: "tag",
      reason: "Deterministic tag synonym expansion from query keywords.",
    });
  }

  const domainExpansion = expandOperationalDomains(input.decomposition.domains);
  allTerms.push(...domainExpansion.terms);
  allReasons.push(...domainExpansion.reasons);

  if (input.workspaceContext) {
    const tagExpansion = expandFromWorkspaceTags(expandedTags, input.workspaceContext.memoryTags);
    allTerms.push(...tagExpansion.terms);
    allReasons.push(...tagExpansion.reasons);

    const relExpansion = expandFromRelationships(
      input.decomposedConcepts,
      input.workspaceContext.relationships,
    );
    allTerms.push(...relExpansion.terms);
    allReasons.push(...relExpansion.reasons);

    const neighborExpansion = expandSemanticNeighbors(
      input.keywords,
      input.workspaceContext.memoryTypes,
    );
    allTerms.push(...neighborExpansion.terms);
    allReasons.push(...neighborExpansion.reasons);
  }

  const uniqueTerms = [...new Set(allTerms)].slice(0, maxTerms);
  const termSet = new Set(uniqueTerms);
  const filteredReasons = allReasons.filter((r) => termSet.has(r.term));

  const metadataExpansion: PlanningMetadataExpansion = {
    tags: expandedTags.slice(0, maxTerms),
    relationships: filteredReasons
      .filter((r) => r.source === "relationship")
      .map((r) => r.term),
    operationalDomains: input.decomposition.domains,
  };

  return {
    metadataExpansion,
    expansionTerms: uniqueTerms,
    expansionReasons: filteredReasons,
  };
}
