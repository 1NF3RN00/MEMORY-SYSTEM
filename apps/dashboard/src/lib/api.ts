/** Empty in local dev (Vite proxy) or when Vercel rewrites proxy same-origin to the API. */
const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

let authTokenProvider: (() => string | null) | null = null;

function apiUrl(path: string): string {
  return API_BASE ? `${API_BASE}${path}` : path;
}

export function setAuthTokenProvider(provider: () => string | null): void {
  authTokenProvider = provider;
}

function authHeaders(token?: string): HeadersInit {
  const resolved = token ?? authTokenProvider?.() ?? null;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (resolved) headers.Authorization = `Bearer ${resolved}`;
  return headers;
}

function networkErrorMessage(): string {
  if (API_BASE) {
    return `Cannot reach API at ${API_BASE}. Confirm the API is deployed and responding.`;
  }
  if (import.meta.env.PROD) {
    return (
      "Cannot reach API. Set VITE_API_URL on the dashboard Vercel project to your API URL " +
      "(e.g. https://memory-system-api.vercel.app), or set API_PROXY_TARGET for same-origin proxying."
    );
  }
  return "Cannot reach API at localhost:3000. Start it with: npm run dev:api";
}

export interface ApiErrorDetails {
  status: number;
  code?: string | undefined;
  retrievalTraceId?: string | undefined;
  compressionTraceId?: string | undefined;
  suppliedTraceId?: string | undefined;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string | undefined;
  readonly retrievalTraceId?: string | undefined;
  readonly compressionTraceId?: string | undefined;
  readonly suppliedTraceId?: string | undefined;

  constructor(message: string, details: ApiErrorDetails) {
    super(message);
    this.name = "ApiError";
    this.status = details.status;
    if (details.code !== undefined) this.code = details.code;
    if (details.retrievalTraceId !== undefined) this.retrievalTraceId = details.retrievalTraceId;
    if (details.compressionTraceId !== undefined) {
      this.compressionTraceId = details.compressionTraceId;
    }
    if (details.suppliedTraceId !== undefined) this.suppliedTraceId = details.suppliedTraceId;
  }
}

function parseApiError(status: number, text: string): ApiError {
  if (
    status === 404 &&
    (text.includes("NOT_FOUND") || text.includes("could not be found"))
  ) {
    if (import.meta.env.PROD && !API_BASE) {
      return new ApiError(
        "API not reachable from this deployment. Set VITE_API_URL on the dashboard " +
          "Vercel project to your API URL (e.g. https://your-api.vercel.app), then redeploy.",
        { status },
      );
    }
    return new ApiError(
      "API route not found. Confirm the API is deployed and VITE_API_URL points to it.",
      { status },
    );
  }
  try {
    const body = JSON.parse(text) as {
      error?: string;
      message?: string;
      code?: string;
      retrievalTraceId?: string;
      compressionTraceId?: string;
      suppliedTraceId?: string;
    };
    const message = body.error ?? body.message;
    if (message) {
      const details: ApiErrorDetails = { status };
      if (body.code !== undefined) details.code = body.code;
      if (body.retrievalTraceId !== undefined) details.retrievalTraceId = body.retrievalTraceId;
      if (body.compressionTraceId !== undefined) {
        details.compressionTraceId = body.compressionTraceId;
      }
      if (body.suppliedTraceId !== undefined) details.suppliedTraceId = body.suppliedTraceId;
      return new ApiError(message, details);
    }
  } catch {
    // not JSON
  }
  const fallback =
    text.length > 200 ? `${status}: ${text.slice(0, 200)}…` : `${status}: ${text}`;
  return new ApiError(fallback, { status });
}

async function apiRequest(
  path: string,
  init: RequestInit = {},
  token?: string,
): Promise<Response> {
  try {
    return await fetch(apiUrl(path), {
      ...init,
      headers: { ...authHeaders(token), ...(init.headers as Record<string, string> | undefined) },
    });
  } catch (err) {
    if (err instanceof TypeError) {
      throw new Error(networkErrorMessage());
    }
    throw err;
  }
}

async function parseApiResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text();
    throw parseApiError(response.status, text);
  }
  return response.json() as Promise<T>;
}

/** In-flight GET dedupe: identical concurrent URLs share one network call. */
const inFlightGets = new Map<string, Promise<unknown>>();

export async function apiGet<T>(path: string, token?: string): Promise<T> {
  const url = apiUrl(path);
  const existing = inFlightGets.get(url);
  if (existing) {
    return existing as Promise<T>;
  }

  const promise = (async (): Promise<T> => {
    const response = await apiRequest(path, {}, token);
    return parseApiResponse<T>(response);
  })().finally(() => {
    inFlightGets.delete(url);
  });

  inFlightGets.set(url, promise);
  return promise;
}

export async function apiPost<T>(path: string, body: unknown, token?: string): Promise<T> {
  const response = await apiRequest(
    path,
    { method: "POST", body: JSON.stringify(body) },
    token,
  );
  return parseApiResponse<T>(response);
}

export async function apiDelete<T>(path: string, body?: unknown, token?: string): Promise<T> {
  const response = await apiRequest(
    path,
    {
      method: "DELETE",
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    },
    token,
  );
  return parseApiResponse<T>(response);
}

export async function apiPatch<T>(path: string, body: unknown, token?: string): Promise<T> {
  const response = await apiRequest(
    path,
    { method: "PATCH", body: JSON.stringify(body) },
    token,
  );
  return parseApiResponse<T>(response);
}

export { API_BASE };
