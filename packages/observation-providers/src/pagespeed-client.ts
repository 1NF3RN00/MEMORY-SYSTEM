export interface PageSpeedAudit {
  numericValue?: number;
  displayValue?: string;
}

export interface PageSpeedCategory {
  score?: number | null;
}

export interface PageSpeedRunResult {
  strategy: "mobile" | "desktop";
  performanceScore: number | null;
  accessibilityScore: number | null;
  speedIndex: number | null;
  largestContentfulPaint: number | null;
  cumulativeLayoutShift: number | null;
  totalBlockingTime: number | null;
  firstContentfulPaint: number | null;
}

function readAudit(
  audits: Record<string, PageSpeedAudit> | undefined,
  key: string,
): number | null {
  const audit = audits?.[key];
  if (!audit || typeof audit.numericValue !== "number" || !Number.isFinite(audit.numericValue)) {
    return null;
  }
  return audit.numericValue;
}

function readCategoryScore(
  categories: Record<string, PageSpeedCategory> | undefined,
  key: string,
): number | null {
  const score = categories?.[key]?.score;
  if (typeof score !== "number" || !Number.isFinite(score)) return null;
  return Math.round(score * 100);
}

export async function runPageSpeed(
  url: string,
  strategy: "mobile" | "desktop",
  apiKey: string,
  fetchFn: typeof fetch = fetch,
): Promise<PageSpeedRunResult> {
  const endpoint = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
  endpoint.searchParams.set("url", url);
  endpoint.searchParams.set("strategy", strategy);
  endpoint.searchParams.set("key", apiKey);
  endpoint.searchParams.set("category", "performance");
  endpoint.searchParams.append("category", "accessibility");

  const response = await fetchFn(endpoint.toString(), {
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`PageSpeed API failed: HTTP ${response.status}${body ? ` — ${body.slice(0, 200)}` : ""}`);
  }

  const payload = (await response.json()) as {
    lighthouseResult?: {
      categories?: Record<string, PageSpeedCategory>;
      audits?: Record<string, PageSpeedAudit>;
    };
  };

  const lighthouse = payload.lighthouseResult;
  const audits = lighthouse?.audits;
  const categories = lighthouse?.categories;

  return {
    strategy,
    performanceScore: readCategoryScore(categories, "performance"),
    accessibilityScore: readCategoryScore(categories, "accessibility"),
    speedIndex: readAudit(audits, "speed-index"),
    largestContentfulPaint: readAudit(audits, "largest-contentful-paint"),
    cumulativeLayoutShift: readAudit(audits, "cumulative-layout-shift"),
    totalBlockingTime: readAudit(audits, "total-blocking-time"),
    firstContentfulPaint: readAudit(audits, "first-contentful-paint"),
  };
}
