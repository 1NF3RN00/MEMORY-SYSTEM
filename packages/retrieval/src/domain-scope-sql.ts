/**
 * Builds SQL fragments for domain-scoped memory eligibility (deterministic).
 */

import type { DomainVectorScope } from "./domain-scope.js";

export function appendDomainScopeConditions(
  scope: DomainVectorScope,
  conditions: string[],
  params: unknown[],
  paramIndex: number,
): number {
  let idx = paramIndex;

  if (scope.metadataFilters.length > 0) {
    conditions.push(`(
      COALESCE(m.metadata->'tags', '[]'::jsonb) ?| $${idx}::text[]
      OR m.metadata ?| $${idx}::text[]
    )`);
    params.push(scope.metadataFilters);
    idx += 1;
  }

  if (scope.rules.length > 0) {
    const ruleParts: string[] = [];
    for (const rule of scope.rules) {
      const parts: string[] = [];

      if (rule.memoryTypes?.length) {
        parts.push(`m.memory_type = ANY($${idx}::text[])`);
        params.push(rule.memoryTypes);
        idx += 1;
      }

      if (rule.requiredMetadataKeys?.length) {
        parts.push(`m.metadata ?& $${idx}::text[]`);
        params.push(rule.requiredMetadataKeys);
        idx += 1;
      }

      if (rule.metadataMatch) {
        for (const [key, value] of Object.entries(rule.metadataMatch)) {
          if (Array.isArray(value)) {
            parts.push(`m.metadata->>'${escapeSqlKey(key)}' = ANY($${idx}::text[])`);
            params.push(value);
            idx += 1;
          } else {
            parts.push(`m.metadata->>'${escapeSqlKey(key)}' = $${idx}`);
            params.push(value);
            idx += 1;
          }
        }
      }

      if (parts.length > 0) {
        ruleParts.push(`(${parts.join(" AND ")})`);
      }
    }

    if (ruleParts.length > 0) {
      conditions.push(`(${ruleParts.join(" OR ")})`);
    }
  }

  return idx;
}

function escapeSqlKey(key: string): string {
  return key.replace(/'/g, "''");
}
