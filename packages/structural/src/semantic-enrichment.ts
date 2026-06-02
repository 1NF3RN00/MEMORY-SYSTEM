import type {
  ChunkLineage,
  ChunkRetrievalSurface,
  SemanticSurface,
} from "@memory-middleware/shared-types";

const STOP_WORDS = new Set([
  "the", "and", "for", "are", "but", "not", "you", "all", "can", "had", "her", "was",
  "one", "our", "out", "has", "have", "been", "were", "will", "with", "this", "that",
  "from", "they", "what", "when", "where", "which", "while", "about", "into", "through",
  "during", "before", "after", "above", "below", "between", "under", "again", "further",
  "then", "once", "here", "there", "each", "other", "some", "such", "only", "own",
  "same", "than", "too", "very", "just", "also", "now", "how", "why", "who", "whom",
]);

const OPERATIONAL_DOMAIN_LEXICON: Record<string, string[]> = {
  liquidity: ["liquidity", "capital", "funding", "cash", "treasury"],
  volatility: ["volatility", "variance", "risk", "exposure", "hedge"],
  operations: ["operational", "operations", "systems", "infrastructure", "runbook"],
  incident: ["incident", "outage", "failure", "degradation", "alert", "oncall"],
  compliance: ["compliance", "regulatory", "audit", "policy", "governance"],
  trading: ["trading", "execution", "market", "order", "settlement"],
  workflow: ["workflow", "process", "procedure", "step", "pipeline", "stage"],
  architecture: ["architecture", "design", "component", "service", "module"],
};

const WORKFLOW_TERMS = [
  "deploy", "rollback", "migrate", "configure", "monitor", "escalate",
  "review", "approve", "validate", "investigate", "remediate", "mitigate",
];

const ENTITY_PATTERN = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g;
const ACRONYM_PATTERN = /\b[A-Z]{2,6}\b/g;
const HEADING_PATTERN = /^#{1,6}\s+(.+)$/m;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));
}

function uniqueSorted(terms: string[]): string[] {
  return [...new Set(terms.map((t) => t.trim()).filter(Boolean))].sort();
}

function extractHeading(content: string, lineage?: ChunkLineage): string | undefined {
  const match = content.match(HEADING_PATTERN);
  if (match?.[1]) return match[1].trim();
  if (lineage?.headingHierarchy.length) {
    return lineage.headingHierarchy[lineage.headingHierarchy.length - 1];
  }
  return undefined;
}

function extractPrimaryConcepts(tokens: string[], heading?: string): string[] {
  const concepts: string[] = [];
  const freq = new Map<string, number>();

  for (const token of tokens) {
    freq.set(token, (freq.get(token) ?? 0) + 1);
  }

  const sorted = [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([t]) => t);

  concepts.push(...sorted);

  if (heading) {
    for (const part of tokenize(heading)) {
      if (!concepts.includes(part)) concepts.push(part);
    }
  }

  for (const term of WORKFLOW_TERMS) {
    if (tokens.includes(term) && !concepts.includes(term)) {
      concepts.push(term);
    }
  }

  return uniqueSorted(concepts).slice(0, 12);
}

function extractOperationalDomains(tokens: string[]): string[] {
  const domains: string[] = [];
  const tokenSet = new Set(tokens);

  for (const [domain, lexicon] of Object.entries(OPERATIONAL_DOMAIN_LEXICON)) {
    if (lexicon.some((term) => tokenSet.has(term) || tokens.some((t) => term.includes(t)))) {
      domains.push(domain);
    }
  }

  return domains.sort();
}

function extractSemanticAliases(concepts: string[]): string[] {
  const aliases: string[] = [];

  for (const concept of concepts) {
    if (concept.endsWith("s") && concept.length > 4) {
      aliases.push(concept.slice(0, -1));
    } else if (!concept.endsWith("s")) {
      aliases.push(`${concept}s`);
    }
    if (concept.includes("-")) {
      aliases.push(concept.replace(/-/g, " "));
    }
  }

  return uniqueSorted(aliases).slice(0, 10);
}

function extractContextualKeywords(
  tokens: string[],
  heading?: string,
  tags?: string[],
): string[] {
  const keywords = [...tokens.slice(0, 6)];
  if (heading) keywords.push(...tokenize(heading));
  if (tags) keywords.push(...tags.map((t) => t.toLowerCase()));
  return uniqueSorted(keywords).slice(0, 10);
}

function extractEntities(content: string): string[] {
  const proper = (content.match(ENTITY_PATTERN) ?? []).map((m) => m.trim());
  const acronyms = (content.match(ACRONYM_PATTERN) ?? []).map((m) => m.trim());
  return uniqueSorted([...proper, ...acronyms]).slice(0, 8);
}

/** Deterministic semantic surface extraction from chunk content and structure. */
export function extractSemanticSurface(input: {
  content: string;
  lineage?: ChunkLineage;
  tags?: string[];
  memoryType?: string;
}): SemanticSurface {
  const tokens = tokenize(input.content);
  const heading = extractHeading(input.content, input.lineage);
  const primaryConcepts = extractPrimaryConcepts(tokens, heading);
  const entities = extractEntities(input.content);

  const operationalDomains = extractOperationalDomains(tokens);
  if (input.memoryType) {
    const typeDomain = input.memoryType.toLowerCase();
    if (!operationalDomains.includes(typeDomain)) {
      operationalDomains.push(typeDomain);
      operationalDomains.sort();
    }
  }

  const hierarchyPath = input.lineage?.sectionPath.length
    ? [...input.lineage.sectionPath]
    : input.lineage?.headingHierarchy.length
      ? [...input.lineage.headingHierarchy]
      : undefined;

  const contextualKeywords = extractContextualKeywords(tokens, heading, input.tags);
  const semanticAliases = extractSemanticAliases([...primaryConcepts, ...entities]);

  return {
    primaryConcepts: uniqueSorted([...primaryConcepts, ...entities]).slice(0, 12),
    operationalDomains,
    semanticAliases,
    contextualKeywords,
    ...(hierarchyPath?.length ? { hierarchyPath } : {}),
  };
}

/** Build lightweight retrieval surface — semantic header + tags without bloating payload. */
export function buildChunkRetrievalSurface(input: {
  content: string;
  lineage?: ChunkLineage;
  tags?: string[];
  memoryType?: string;
}): ChunkRetrievalSurface {
  const semanticSurface = extractSemanticSurface(input);
  const heading = extractHeading(input.content, input.lineage);

  const semanticHeader = [
    heading,
    ...semanticSurface.primaryConcepts.slice(0, 4),
    ...semanticSurface.operationalDomains.slice(0, 2),
  ]
    .filter(Boolean)
    .join(" | ");

  const retrievalTags = uniqueSorted([
    ...semanticSurface.primaryConcepts.slice(0, 6),
    ...semanticSurface.operationalDomains,
    ...semanticSurface.contextualKeywords.slice(0, 4),
  ]).slice(0, 12);

  const contextualDescriptors = uniqueSorted([
    ...(semanticSurface.hierarchyPath ?? []),
    ...semanticSurface.semanticAliases.slice(0, 4),
  ]).slice(0, 8);

  return {
    semanticHeader: semanticHeader.slice(0, 200),
    retrievalTags,
    contextualDescriptors,
    semanticSurface,
  };
}

/** Build embedding text with retrieval surface prepended for richer vector matching. */
export function buildEnrichedEmbeddingText(
  content: string,
  surface: ChunkRetrievalSurface,
): string {
  const prefix = [
    surface.semanticHeader,
    surface.retrievalTags.length ? `[${surface.retrievalTags.join(", ")}]` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return prefix ? `${prefix}\n\n${content}` : content;
}
