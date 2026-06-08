export type ListResource =
  | "memory"
  | "retrieval"
  | "ingestion"
  | "compression"
  | "contextRender";

/** Public list-row fields per resource. Internal Prisma columns are never exposed here. */
export const LIST_FIELD_ALLOWLISTS: Record<ListResource, readonly string[]> = {
  memory: [
    "id",
    "title",
    "memoryType",
    "sourceType",
    "persistenceMode",
    "archived",
    "retrievalEligible",
    "ingestionStatus",
    "chunkCount",
    "createdAt",
    "archivedAt",
  ],
  retrieval: [
    "retrievalTraceId",
    "workspaceId",
    "query",
    "status",
    "hasContextPackage",
    "createdAt",
    "completedAt",
  ],
  ingestion: [
    "traceId",
    "workspaceId",
    "memoryId",
    "status",
    "sourceType",
    "createdAt",
    "updatedAt",
  ],
  compression: [
    "compressionTraceId",
    "workspaceId",
    "retrievalTraceId",
    "status",
    "fidelityMode",
    "createdAt",
    "completedAt",
  ],
  contextRender: [
    "deliveryId",
    "workspaceId",
    "retrievalTraceId",
    "compressionTraceId",
    "status",
    "mode",
    "tokenCount",
    "createdAt",
    "completedAt",
  ],
};

export type ListFieldProjection =
  | { ok: true; fields: string[] | null }
  | { ok: false; error: string; invalidFields: string[] };

function normalizeFieldTokens(raw: string): string[] {
  const seen = new Set<string>();
  const tokens: string[] = [];

  for (const part of raw.split(",")) {
    const token = part.trim();
    if (!token || seen.has(token)) {
      continue;
    }
    seen.add(token);
    tokens.push(token);
  }

  return tokens;
}

/**
 * Parse optional `?fields=` for a list resource.
 * Returns `fields: null` when omitted — callers emit the full public row shape (default unchanged).
 */
export function parseListFieldsQuery(
  resource: ListResource,
  raw?: string,
): ListFieldProjection {
  if (raw === undefined || raw === "") {
    return { ok: true, fields: null };
  }

  const requested = normalizeFieldTokens(raw);
  if (requested.length === 0) {
    return {
      ok: false,
      error: "fields query parameter must include at least one allowed field name",
      invalidFields: [],
    };
  }

  const allowlist = new Set(LIST_FIELD_ALLOWLISTS[resource]);
  const invalidFields = requested.filter((field) => !allowlist.has(field));
  if (invalidFields.length > 0) {
    return {
      ok: false,
      error: `Invalid fields for ${resource} list: ${invalidFields.join(", ")}`,
      invalidFields,
    };
  }

  return { ok: true, fields: requested };
}

export function projectListRow<T extends Record<string, unknown>>(
  row: T,
  fields: string[] | null,
): Partial<T> {
  if (!fields) {
    return row;
  }

  const projected = {} as Partial<T>;
  for (const field of fields) {
    if (field in row) {
      projected[field as keyof T] = row[field as keyof T];
    }
  }
  return projected;
}

export function projectListRows<T extends Record<string, unknown>>(
  rows: T[],
  fields: string[] | null,
): Array<Partial<T>> {
  if (!fields) {
    return rows;
  }
  return rows.map((row) => projectListRow(row, fields));
}
