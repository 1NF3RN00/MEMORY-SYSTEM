import type { QueryDecomposition } from "@memory-middleware/shared-types";

export function generateRetrievalHints(input: {
  keywords: string[];
  decomposedConcepts: string[];
  decomposition: QueryDecomposition;
  expansionTerms: string[];
}): string[] {
  const hints: string[] = [];

  for (const keyword of input.keywords) {
    hints.push(`keyword:${keyword}`);
  }

  for (const concept of input.decomposedConcepts) {
    hints.push(`concept:${concept}`);
  }

  for (const domain of input.decomposition.domains) {
    hints.push(`domain:${domain}`);
  }

  for (const priority of input.decomposition.contextualPriorities) {
    hints.push(`priority:${priority.replace(/\s+/g, "-")}`);
  }

  for (const timeRef of input.decomposition.timeReferences) {
    hints.push(`time:${timeRef}`);
  }

  for (const term of input.expansionTerms.slice(0, 8)) {
    hints.push(`expansion:${term}`);
  }

  return [...new Set(hints)].sort();
}
