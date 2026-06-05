export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readNumber(source: unknown, keys: string[]): number | null {
  if (!isRecord(source)) return null;
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value.replace(/,/g, ""));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

export function readString(source: unknown, keys: string[]): string | null {
  if (!isRecord(source)) return null;
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export function readNestedNumber(
  source: unknown,
  paths: string[][],
): number | null {
  for (const path of paths) {
    let current: unknown = source;
    for (const segment of path) {
      if (!isRecord(current)) {
        current = undefined;
        break;
      }
      current = current[segment];
    }
    const value = readNumber(current, [""]);
    if (value !== null) return value;
    if (typeof current === "number" && Number.isFinite(current)) return current;
  }
  return null;
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function parseDate(value: unknown): Date | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
  }
  if (typeof value === "string" && value.trim()) {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
  }
  return null;
}

export function countItemsInLastDays(
  items: unknown[],
  dateKeys: string[],
  days: number,
): number {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  let count = 0;
  for (const item of items) {
    if (!isRecord(item)) continue;
    for (const key of dateKeys) {
      const date = parseDate(item[key]);
      if (date && date.getTime() >= cutoff) {
        count += 1;
        break;
      }
    }
  }
  return count;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
}
