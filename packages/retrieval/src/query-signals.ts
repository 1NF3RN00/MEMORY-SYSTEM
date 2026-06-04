/**
 * Deterministic query signal extraction for retrieval calibration.
 * No LLM inference — lexical and structural analysis only.
 */

const OPERATIONAL_DOMAIN_KEYWORDS: Record<string, string[]> = {
  liquidity: ["liquidity", "capital", "funding", "cash", "treasury"],
  volatility: ["volatility", "variance", "risk", "exposure", "hedge"],
  operations: ["operational", "operations", "systems", "infrastructure", "runbook"],
  incident: ["incident", "outage", "failure", "degradation", "alert", "oncall"],
  compliance: ["compliance", "regulatory", "audit", "policy", "governance"],
  trading: ["trading", "execution", "market", "order", "settlement"],
  workflow: ["workflow", "process", "procedure", "pipeline", "stage"],
  architecture: ["architecture", "design", "component", "service", "module"],
};

const WORKFLOW_TERMS = [
  "deploy", "rollback", "migrate", "configure", "monitor", "escalate",
  "review", "approve", "validate", "investigate", "remediate", "mitigate",
  "incident", "outage", "recovery", "postmortem", "runbook",
];

const INTENT_SIGNALS: Record<string, string> = {
  how: "procedural",
  why: "causal",
  what: "definitional",
  when: "temporal",
  where: "locational",
  explain: "explanatory",
  summarize: "summary",
  list: "enumeration",
};

const TECHNICAL_TERM_PATTERN =
  /\b(?:api|sdk|sql|json|http|grpc|kafka|redis|postgres|vector|embedding|retrieval|pipeline|middleware)\b/gi;

const ENTITY_PATTERN = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g;

export interface QuerySignalExtraction {
  operationalConcepts: string[];
  domains: string[];
  intentSignals: string[];
  entities: string[];
  workflowTerms: string[];
}

function uniqueSorted(terms: string[]): string[] {
  return [...new Set(terms.map((t) => t.trim()).filter(Boolean))].sort();
}

function cleanPhrase(phrase: string): string {
  return phrase.replace(/[?!.,;:]+$/g, "").trim();
}

export function extractOperationalDomains(normalizedQuery: string): string[] {
  const domains: string[] = [];
  for (const [domain, terms] of Object.entries(OPERATIONAL_DOMAIN_KEYWORDS)) {
    if (terms.some((t) => normalizedQuery.includes(t))) {
      domains.push(domain);
    }
  }
  return domains.sort();
}

export function extractOperationalPhrases(
  normalizedQuery: string,
  keywords: string[],
): string[] {
  const words = normalizedQuery.split(/\s+/).filter(Boolean);
  const phrases: string[] = [];

  for (let size = 2; size <= 3; size++) {
    for (let i = 0; i <= words.length - size; i++) {
      const phrase = cleanPhrase(words.slice(i, i + size).join(" "));
      if (keywords.some((k) => phrase.includes(k)) && phrase.length > 5) {
        phrases.push(phrase);
      }
    }
  }

  return uniqueSorted(phrases);
}

export function extractQuerySignals(
  originalQuery: string,
  normalizedQuery: string,
  keywords: string[],
): QuerySignalExtraction {
  const phrases = extractOperationalPhrases(normalizedQuery, keywords);
  const domains = extractOperationalDomains(normalizedQuery);
  const workflowTerms = WORKFLOW_TERMS.filter((t) => normalizedQuery.includes(t)).sort();
  const entities = uniqueSorted(
    (originalQuery.match(ENTITY_PATTERN) ?? []).map((m) => m.trim()),
  );
  const technicalTerms = uniqueSorted(
    (originalQuery.match(TECHNICAL_TERM_PATTERN) ?? []).map((m) => m.toLowerCase()),
  );

  const intentSignals: string[] = [];
  for (const [word, intent] of Object.entries(INTENT_SIGNALS)) {
    if (normalizedQuery.includes(word)) intentSignals.push(intent);
  }

  const operationalConcepts = uniqueSorted([
    ...phrases,
    ...workflowTerms,
    ...technicalTerms,
    ...keywords.filter((k) => k.length > 4),
    ...entities.map((e) => e.toLowerCase()),
  ]).slice(0, 12);

  return {
    operationalConcepts,
    domains,
    intentSignals: uniqueSorted(intentSignals),
    entities,
    workflowTerms,
  };
}

export interface EmbeddingTextInput {
  normalizedQuery: string;
  operationalConcepts: string[];
  domains: string[];
  expansionTerms?: string[];
  decompositionConcepts?: string[];
}

/** Build deterministic embedding text — enriches vector query without changing stored query. */
export function buildRetrievalEmbeddingText(input: EmbeddingTextInput): string {
  const anchorTerms = uniqueSorted([
    ...input.domains,
    ...input.operationalConcepts.slice(0, 8),
    ...(input.expansionTerms ?? []).slice(0, 8),
    ...(input.decompositionConcepts ?? []).slice(0, 6),
  ]).slice(0, 16);

  if (anchorTerms.length === 0) return input.normalizedQuery;

  const prefix = `[${anchorTerms.join(", ")}]`;
  return `${prefix}\n${input.normalizedQuery}`;
}
