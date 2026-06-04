import type {
  DomainExecutionContext,
  RelationshipNeighborhoodConstraint,
  RetrievalQuery,
  RetrievalRule,
} from "@memory-middleware/shared-types";
import type { RelationshipAugmentationConfig } from "@memory-middleware/shared-types";
import type { VectorSearchFilter } from "./vector-retrieval.js";

/** Serializable scope applied during vector search (Postgres metadata filters). */
export interface DomainVectorScope {
  metadataFilters: string[];
  rules: Array<{
    memoryTypes?: string[];
    requiredMetadataKeys?: string[];
    metadataMatch?: Record<string, string | string[]>;
  }>;
}

export interface ResolvedDomainRetrievalScope {
  filter: VectorSearchFilter;
  query: RetrievalQuery;
  relationshipConfig: Partial<RelationshipAugmentationConfig>;
  relationshipConstraints: RelationshipNeighborhoodConstraint;
}

export function buildDomainVectorScope(
  context: DomainExecutionContext | undefined,
): DomainVectorScope | undefined {
  if (!context) return undefined;

  const rules = context.retrievalRules
    .map((rule) => ({
      ...(rule.memoryTypes?.length ? { memoryTypes: rule.memoryTypes } : {}),
      ...(rule.requiredMetadataKeys?.length
        ? { requiredMetadataKeys: rule.requiredMetadataKeys }
        : {}),
      ...(rule.metadataMatch ? { metadataMatch: rule.metadataMatch } : {}),
    }))
    .filter(
      (r) =>
        (r.memoryTypes?.length ?? 0) > 0 ||
        (r.requiredMetadataKeys?.length ?? 0) > 0 ||
        (r.metadataMatch != null && Object.keys(r.metadataMatch).length > 0),
    );

  const hasFilters = context.metadataFilters.length > 0;
  if (!hasFilters && rules.length === 0) return undefined;

  return {
    metadataFilters: context.metadataFilters,
    rules,
  };
}

function mergeMemoryTypes(
  queryTypes: string[] | undefined,
  rules: RetrievalRule[],
): string[] | undefined {
  const merged = new Set<string>(queryTypes ?? []);
  for (const rule of rules) {
    for (const t of rule.memoryTypes ?? []) merged.add(t);
  }
  return merged.size > 0 ? [...merged] : queryTypes;
}

function resolveTokenBudget(query: RetrievalQuery, rules: RetrievalRule[]): number {
  for (const rule of rules) {
    if (rule.tokenBudgetOverride != null && rule.tokenBudgetOverride > 0) {
      return Math.min(query.tokenBudget, rule.tokenBudgetOverride);
    }
  }
  return query.tokenBudget;
}

export function resolveDomainRetrievalScope(
  query: RetrievalQuery,
  context?: DomainExecutionContext,
): ResolvedDomainRetrievalScope {
  const domainScope = buildDomainVectorScope(context);
  const memoryTypes = context ? mergeMemoryTypes(query.memoryTypes, context.retrievalRules) : query.memoryTypes;
  const effectiveQuery: RetrievalQuery = {
    ...query,
    ...(memoryTypes?.length ? { memoryTypes } : {}),
    tokenBudget: context ? resolveTokenBudget(query, context.retrievalRules) : query.tokenBudget,
  };

  const filter: VectorSearchFilter = {
    workspaceId: query.workspaceId,
    ...(effectiveQuery.memoryTypes?.length ? { memoryTypes: effectiveQuery.memoryTypes } : {}),
    ...(effectiveQuery.timeframe ? { timeframe: effectiveQuery.timeframe } : {}),
    ...(domainScope ? { domainScope } : {}),
  };

  const constraints = context?.relationshipConstraints ?? { maxDepth: 1 };
  const relationshipConfig: Partial<RelationshipAugmentationConfig> = {
    ...(constraints.maxNeighbors != null ? { maxNeighbors: constraints.maxNeighbors } : {}),
  };

  return {
    filter,
    query: effectiveQuery,
    relationshipConfig,
    relationshipConstraints: constraints,
  };
}

export interface RelationshipRowForFilter {
  sourceMemoryId: string;
  targetMemoryId: string;
  relationshipType: string;
  confidence: number;
  weight: number;
  generatedFrom: string[];
}

export function filterRelationshipsByNeighborhoodConstraints<
  T extends RelationshipRowForFilter,
>(
  relationships: T[],
  constraints: RelationshipNeighborhoodConstraint,
  targetMetadataByMemoryId: Map<string, Record<string, unknown>>,
): T[] {
  let filtered = relationships;

  if (constraints.allowedTypes?.length) {
    const allowed = new Set(constraints.allowedTypes);
    filtered = filtered.filter((r) => allowed.has(r.relationshipType));
  }

  if (constraints.targetMetadataKeys?.length) {
    const required = constraints.targetMetadataKeys;
    filtered = filtered.filter((r) => {
      const targetMeta =
        targetMetadataByMemoryId.get(r.targetMemoryId) ??
        targetMetadataByMemoryId.get(r.sourceMemoryId);
      if (!targetMeta) return false;
      return required.every((key) => key in targetMeta && targetMeta[key] != null);
    });
  }

  if (constraints.maxNeighbors != null) {
    filtered = filtered.slice(0, constraints.maxNeighbors);
  }

  return filtered;
}
