/**
 * Strip secrets from Playwright HAR artifacts before committing to the repo.
 * Removes Authorization, Cookie, x-api-key headers and redacts query tokens.
 */

const SENSITIVE_HEADER_NAMES = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "x-supabase-auth",
]);

const SENSITIVE_QUERY_KEYS = new Set([
  "token",
  "access_token",
  "refresh_token",
  "api_key",
  "apikey",
  "key",
]);

export interface HarLog {
  log: {
    entries: HarEntry[];
    [key: string]: unknown;
  };
}

export interface HarEntry {
  request?: {
    url?: string;
    headers?: Array<{ name: string; value: string }>;
    postData?: { text?: string };
    [key: string]: unknown;
  };
  response?: {
    headers?: Array<{ name: string; value: string }>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

function redactQueryParamUrl(url: string): string {
  try {
    const parsed = new URL(url);
    for (const key of [...parsed.searchParams.keys()]) {
      if (SENSITIVE_QUERY_KEYS.has(key.toLowerCase())) {
        parsed.searchParams.set(key, "[REDACTED]");
      }
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

function sanitizeHeaders(
  headers: Array<{ name: string; value: string }> | undefined,
): Array<{ name: string; value: string }> | undefined {
  if (!headers) return headers;
  return headers.map((header) => {
    if (SENSITIVE_HEADER_NAMES.has(header.name.toLowerCase())) {
      return { name: header.name, value: "[REDACTED]" };
    }
    return header;
  });
}

/** Returns a sanitized copy safe to commit; does not mutate the input. */
export function sanitizeHar(har: HarLog): HarLog {
  const entries = har.log.entries.map((entry) => {
    const next: HarEntry = { ...entry };
    if (entry.request) {
      next.request = {
        ...entry.request,
        url:
          typeof entry.request.url === "string"
            ? redactQueryParamUrl(entry.request.url)
            : entry.request.url,
        headers: sanitizeHeaders(entry.request.headers),
        postData: entry.request.postData?.text
          ? { text: "[REDACTED]" }
          : entry.request.postData,
      };
    }
    if (entry.response) {
      next.response = {
        ...entry.response,
        headers: sanitizeHeaders(entry.response.headers),
      };
    }
    return next;
  });

  return {
    log: {
      ...har.log,
      entries,
    },
  };
}

/** Count API-like entries and response bytes from a sanitized HAR. */
export function summarizeHar(har: HarLog): {
  entryCount: number;
  apiEntryCount: number;
  totalResponseBytes: number;
  paths: string[];
} {
  const entries = har.log.entries ?? [];
  let totalResponseBytes = 0;
  let apiEntryCount = 0;
  const paths: string[] = [];

  for (const entry of entries) {
    const url = entry.request?.url ?? "";
    let pathname = url;
    try {
      pathname = new URL(url).pathname;
    } catch {
      // keep raw url
    }

    const isApi =
      /\/(auth|workspaces|memory|retrieval|ingestion|compression|context|diagnostics|relationships|health)\b/.test(
        pathname,
      );
    if (isApi) {
      apiEntryCount += 1;
      paths.push(pathname);
    }

    const bodySize = (entry.response as { bodySize?: number } | undefined)?.bodySize;
    if (typeof bodySize === "number" && bodySize > 0) {
      totalResponseBytes += bodySize;
    }
  }

  return {
    entryCount: entries.length,
    apiEntryCount,
    totalResponseBytes,
    paths,
  };
}
