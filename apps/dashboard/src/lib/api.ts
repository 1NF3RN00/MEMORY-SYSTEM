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

function parseApiError(status: number, text: string): string {
  if (
    status === 404 &&
    (text.includes("NOT_FOUND") || text.includes("could not be found"))
  ) {
    if (import.meta.env.PROD && !API_BASE) {
      return (
        "API not reachable from this deployment. Set VITE_API_URL on the dashboard " +
        "Vercel project to your API URL (e.g. https://your-api.vercel.app), then redeploy."
      );
    }
    return "API route not found. Confirm the API is deployed and VITE_API_URL points to it.";
  }
  try {
    const body = JSON.parse(text) as { error?: string; message?: string };
    if (body.error) return body.error;
    if (body.message) return body.message;
  } catch {
    // not JSON
  }
  return text.length > 200 ? `${status}: ${text.slice(0, 200)}…` : `${status}: ${text}`;
}

export async function apiGet<T>(path: string, token?: string): Promise<T> {
  const response = await fetch(apiUrl(path), { headers: authHeaders(token) });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(parseApiError(response.status, text));
  }
  return response.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body: unknown, token?: string): Promise<T> {
  const response = await fetch(apiUrl(path), {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(parseApiError(response.status, text));
  }
  return response.json() as Promise<T>;
}

export async function apiDelete<T>(path: string, body?: unknown, token?: string): Promise<T> {
  const response = await fetch(apiUrl(path), {
    method: "DELETE",
    headers: authHeaders(token),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(parseApiError(response.status, text));
  }
  return response.json() as Promise<T>;
}

export async function apiPatch<T>(path: string, body: unknown, token?: string): Promise<T> {
  const response = await fetch(apiUrl(path), {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(parseApiError(response.status, text));
  }
  return response.json() as Promise<T>;
}

export { API_BASE };
