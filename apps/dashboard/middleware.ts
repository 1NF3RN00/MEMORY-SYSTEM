/**
 * Proxies middleware API paths to the API deployment when the dashboard is on Vercel.
 * Set API_PROXY_TARGET on the dashboard Vercel project (your API origin, no trailing slash).
 * Optionally set VITE_API_URL to the same value so the client can call the API directly.
 */
const API_PREFIXES = [
  "/access",
  "/auth",
  "/platform",
  "/workspaces",
  "/health",
  "/ingest",
  "/ingestion",
  "/memory",
  "/retrieve",
  "/retrieval",
  "/compress",
  "/compression",
  "/context",
  "/relationships",
  "/history",
  "/replay",
  "/historian",
  "/diagnostics",
  "/calibration",
  "/augmentation",
  "/clusters",
  "/events",
  "/search",
];

function apiTarget(): string | null {
  const raw = process.env.API_PROXY_TARGET || process.env.VITE_API_URL || "";
  const trimmed = raw.replace(/\/$/, "");
  return trimmed || null;
}

export default async function middleware(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const target = apiTarget();
  if (!target) {
    return new Response(
      JSON.stringify({
        error:
          "API_PROXY_TARGET is not configured on this Vercel project. " +
          "Set it to your API origin (e.g. https://your-api.vercel.app) and redeploy.",
      }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }

  const dest = `${target}${url.pathname}${url.search}`;
  const headers = new Headers(request.headers);
  headers.delete("host");

  const init: RequestInit = {
    method: request.method,
    headers,
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
    // @ts-expect-error duplex required for streaming request bodies
    init.duplex = "half";
  }

  return fetch(dest, init);
}

export const config = {
  matcher: API_PREFIXES.flatMap((p) => [`${p}/:path*`, p]),
};
