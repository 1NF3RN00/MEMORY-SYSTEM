import { preprocessQuery } from "@memory-middleware/retrieval";
import type { QueryDecomposition } from "@memory-middleware/shared-types";

const OPERATIONAL_DOMAIN_KEYWORDS: Record<string, string[]> = {
  liquidity: ["liquidity", "capital", "funding", "cash flow"],
  volatility: ["volatility", "variance", "risk", "exposure"],
  operations: ["operational", "operations", "systems", "infrastructure"],
  incident: ["incident", "outage", "failure", "degradation", "alert"],
  compliance: ["compliance", "regulatory", "audit", "policy"],
  trading: ["trading", "execution", "market", "order"],
};

const PRIORITY_SIGNALS: Record<string, string> = {
  recent: "recency priority",
  latest: "recency priority",
  urgent: "operational urgency",
  critical: "operational urgency",
  important: "importance priority",
  overnight: "temporal scope",
  during: "temporal scope",
  improved: "change detection",
  degraded: "incident signal",
};

const TIME_PATTERNS = [
  /\b(overnight|today|yesterday|last\s+\w+|this\s+\w+|recent(?:ly)?)\b/gi,
  /\b(q[1-4]\s*\d{4}|\d{4}-\d{2}-\d{2})\b/gi,
  /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/gi,
];

const WORKFLOW_TERMS = [
  "deploy", "rollback", "migrate", "configure", "monitor", "escalate",
  "review", "approve", "validate", "investigate", "remediate", "mitigate",
  "incident", "outage", "recovery", "postmortem", "runbook",
];

const INTENT_SIGNALS: Record<string, string> = {
  how: "procedural intent",
  why: "causal intent",
  what: "definitional intent",
  when: "temporal intent",
  where: "locational intent",
  compare: "comparative intent",
  explain: "explanatory intent",
  summarize: "summary intent",
  list: "enumeration intent",
};

const TECHNICAL_TERM_PATTERN = /\b(?:api|sdk|sql|json|http|grpc|kafka|redis|postgres|vector|embedding|retrieval|pipeline|middleware)\b/gi;

function cleanPhrase(phrase: string): string {
  return phrase.replace(/[?!.,;:]+$/g, "").trim();
}

function extractPhrases(normalizedQuery: string, keywords: string[]): string[] {
  const words = normalizedQuery.split(/\s+/).filter(Boolean);
  const phrases: string[] = [];

  for (let size = 2; size <= 3; size++) {
    for (let i = 0; i <= words.length - size; i++) {
      const phrase = cleanPhrase(words.slice(i, i + size).join(" "));
      const hasKeyword = keywords.some((k) => phrase.includes(k));
      if (hasKeyword && phrase.length > 5) {
        phrases.push(phrase);
      }
    }
  }

  return [...new Set(phrases)].sort();
}

function extractDomains(normalizedQuery: string): string[] {
  const domains: string[] = [];
  for (const [domain, terms] of Object.entries(OPERATIONAL_DOMAIN_KEYWORDS)) {
    if (terms.some((t) => normalizedQuery.includes(t))) {
      domains.push(domain);
    }
  }
  return domains;
}

function extractTimeReferences(query: string): string[] {
  const refs = new Set<string>();
  for (const pattern of TIME_PATTERNS) {
    for (const match of query.matchAll(pattern)) {
      refs.add(match[0].toLowerCase());
    }
  }
  return [...refs].sort();
}

function extractPriorities(normalizedQuery: string): string[] {
  const priorities = new Set<string>();
  for (const [signal, priority] of Object.entries(PRIORITY_SIGNALS)) {
    if (normalizedQuery.includes(signal)) {
      priorities.add(priority);
    }
  }
  return [...priorities].sort();
}

const ENTITY_PATTERN = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g;

function extractWorkflowTerms(normalizedQuery: string): string[] {
  const terms: string[] = [];
  for (const term of WORKFLOW_TERMS) {
    if (normalizedQuery.includes(term)) terms.push(term);
  }
  return terms.sort();
}

function extractIntentSignals(query: string): string[] {
  const normalized = query.toLowerCase();
  const signals = new Set<string>();
  for (const [word, intent] of Object.entries(INTENT_SIGNALS)) {
    if (normalized.includes(word)) signals.add(intent);
  }
  return [...signals].sort();
}

function extractTechnicalTerms(query: string): string[] {
  const matches = query.match(TECHNICAL_TERM_PATTERN) ?? [];
  return [...new Set(matches.map((m) => m.toLowerCase()))].sort();
}

function extractEntities(originalQuery: string): string[] {
  const matches = originalQuery.match(ENTITY_PATTERN) ?? [];
  return [...new Set(matches.map((m) => m.trim()))].sort();
}

export interface DecompositionResult {
  decomposition: QueryDecomposition;
  decomposedConcepts: string[];
  reasons: string[];
}

/**
 * Shallow deterministic query decomposition — no recursive reasoning or intent inference.
 */
export function decomposeQuery(query: string, maxConcepts = 12): DecompositionResult {
  const preprocessed = preprocessQuery(query);
  const phrases = extractPhrases(preprocessed.normalizedQuery, preprocessed.keywords);
  const domains = extractDomains(preprocessed.normalizedQuery);
  const timeReferences = extractTimeReferences(query);
  const contextualPriorities = extractPriorities(preprocessed.normalizedQuery);
  const entities = extractEntities(query);
  const workflowTerms = extractWorkflowTerms(preprocessed.normalizedQuery);
  const intentSignals = extractIntentSignals(query);
  const technicalTerms = extractTechnicalTerms(query);

  const operationalConcepts = [
    ...phrases,
    ...workflowTerms,
    ...technicalTerms,
    ...preprocessed.keywords.filter((k) => k.length > 4),
  ]
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .slice(0, maxConcepts);

  const decomposedConcepts = [
    ...operationalConcepts,
    ...domains,
    ...intentSignals.map((p) => p.replace(/\s+/g, "-")),
    ...contextualPriorities.map((p) => p.replace(/\s+/g, "-")),
  ]
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .slice(0, maxConcepts);

  const reasons: string[] = [];
  if (phrases.length > 0) {
    reasons.push(`Extracted ${phrases.length} operational phrase(s) from query tokens.`);
  }
  if (domains.length > 0) {
    reasons.push(`Matched operational domain(s): ${domains.join(", ")}.`);
  }
  if (timeReferences.length > 0) {
    reasons.push(`Detected time reference(s): ${timeReferences.join(", ")}.`);
  }
  if (contextualPriorities.length > 0) {
    reasons.push(`Identified contextual priorit(ies): ${contextualPriorities.join(", ")}.`);
  }
  if (workflowTerms.length > 0) {
    reasons.push(`Extracted workflow terms: ${workflowTerms.join(", ")}.`);
  }
  if (intentSignals.length > 0) {
    reasons.push(`Detected intent signal(s): ${intentSignals.join(", ")}.`);
  }
  if (reasons.length === 0) {
    reasons.push("Decomposed query into keyword concepts via deterministic token extraction.");
  }

  return {
    decomposition: {
      operationalConcepts,
      entities,
      domains,
      timeReferences,
      contextualPriorities,
    },
    decomposedConcepts,
    reasons,
  };
}
