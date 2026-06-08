import { createHash } from "node:crypto";

const ULID_PATTERN = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CUID_PATTERN = /^c[a-z0-9]{24,}$/i;

const READ_OPERATIONS = new Set(["findUnique", "findFirst", "findMany"]);

function isIdString(value: string): boolean {
  return ULID_PATTERN.test(value) || UUID_PATTERN.test(value) || CUID_PATTERN.test(value);
}

function isIdKey(key: string): boolean {
  return key === "id" || key.endsWith("Id") || key.endsWith("_id");
}

export function normalizeQueryArgs(value: unknown, key?: string): unknown {
  if (typeof value === "string") {
    return isIdString(value) || (key && isIdKey(key)) ? "<id>" : value;
  }
  if (
    typeof value === "number" &&
    Number.isInteger(value) &&
    key &&
    isIdKey(key)
  ) {
    return "<id>";
  }
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeQueryArgs(entry));
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const entryKey of Object.keys(obj).sort()) {
      sorted[entryKey] = normalizeQueryArgs(obj[entryKey], entryKey);
    }
    return sorted;
  }
  return value;
}

export function fingerprintQuery(model: string, operation: string, args: unknown): string {
  const normalized = normalizeQueryArgs(args ?? {});
  const payload = `${model}:${operation}:${JSON.stringify(normalized)}`;
  return createHash("sha256").update(payload).digest("hex").slice(0, 12);
}

export function isReadOperation(operation: string): boolean {
  return READ_OPERATIONS.has(operation);
}

export function hasSingleIdFilter(args: unknown): boolean {
  if (!args || typeof args !== "object") return false;
  const where = (args as Record<string, unknown>).where;
  if (!where || typeof where !== "object") return false;

  const normalized = normalizeQueryArgs(where) as Record<string, unknown>;
  const idFields = ["id", "traceId", "memoryId", "workspaceId", "chunkId"];
  return idFields.some((field) => normalized[field] === "<id>");
}
