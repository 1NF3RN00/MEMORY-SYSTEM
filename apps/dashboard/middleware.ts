/**
 * Proxies middleware API paths to the API deployment when the dashboard is on Vercel.
 * Set API_PROXY_TARGET on the dashboard Vercel project (your API origin, no trailing slash).
 * Optionally set VITE_API_URL to the same value so the client can call the API directly.
 */
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

/** Matcher must be an inline literal — Vercel static analysis rejects variables and .flatMap(). */
export const config = {
  matcher: [
    "/access/:path*",
    "/access",
    "/auth/:path*",
    "/auth",
    "/platform/:path*",
    "/platform",
    "/workspaces/:path*",
    "/workspaces",
    "/health/:path*",
    "/health",
    "/ingest/:path*",
    "/ingest",
    "/ingestion/:path*",
    "/ingestion",
    "/memory/:path*",
    "/memory",
    "/retrieve/:path*",
    "/retrieve",
    "/retrieval/:path*",
    "/retrieval",
    "/compress/:path*",
    "/compress",
    "/compression/:path*",
    "/compression",
    "/context/:path*",
    "/context",
    "/relationships/:path*",
    "/relationships",
    "/history/:path*",
    "/history",
    "/replay/:path*",
    "/replay",
    "/historian/:path*",
    "/historian",
    "/diagnostics/:path*",
    "/diagnostics",
    "/calibration/:path*",
    "/calibration",
    "/augmentation/:path*",
    "/augmentation",
    "/clusters/:path*",
    "/clusters",
    "/events/:path*",
    "/events",
    "/search/:path*",
    "/search",
  ],
};
