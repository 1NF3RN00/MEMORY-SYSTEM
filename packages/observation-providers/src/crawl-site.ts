import * as cheerio from "cheerio";
import { crawlWebsite } from "@memory-middleware/ingestion";

export interface CrawledPage {
  url: string;
  title: string | null;
  h1: string | null;
  wordCount: number;
  internalLinkCount: number;
}

export interface SiteCrawlResult {
  baseUrl: string;
  pages: CrawledPage[];
  schemaPresent: boolean;
  robotsTxtPresent: boolean;
  sitemapPresent: boolean;
  collectedAt: string;
}

const DEFAULT_MAX_PAGES = 50;
const SERVICE_PAGE_PATTERN = /\/(services?|offerings|what-we-do|solutions|our-work)(\/|$)/i;

function normalizeUrl(raw: string, base: URL): string | null {
  try {
    const resolved = new URL(raw, base);
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") return null;
    if (resolved.hostname !== base.hostname) return null;
    resolved.hash = "";
    return resolved.toString().replace(/\/$/, "") || resolved.toString();
  } catch {
    return null;
  }
}

function countWords(text: string): number {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed) return 0;
  return trimmed.split(" ").length;
}

function analyzeHtml(url: string, html: string): Omit<CrawledPage, "url"> {
  const $ = cheerio.load(html);
  const title = $("title").first().text().trim() || null;
  const h1 = $("h1").first().text().trim() || null;
  const bodyText = $("body").text();
  const internalLinks = new Set<string>();
  const base = new URL(url);

  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");
    if (!href) return;
    const normalized = normalizeUrl(href, base);
    if (normalized) internalLinks.add(normalized);
  });

  return {
    title,
    h1,
    wordCount: countWords(bodyText),
    internalLinkCount: internalLinks.size,
  };
}

function hasStructuredData(html: string): boolean {
  return (
    /application\/ld\+json/i.test(html) ||
    /itemtype\s*=\s*["']https?:\/\/schema\.org/i.test(html) ||
    /typeof\s*=\s*["'][^"']+["']/i.test(html)
  );
}

async function fetchExists(
  url: string,
  fetchFn: typeof fetch,
): Promise<boolean> {
  try {
    const response = await fetchFn(url, {
      method: "GET",
      headers: { "User-Agent": "MemoryMiddleware-Crawler/1.0" },
      signal: AbortSignal.timeout(10_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function discoverUrls(
  baseUrl: string,
  homepageHtml: string,
  fetchFn: typeof fetch,
  maxPages: number,
): Promise<string[]> {
  const base = new URL(baseUrl);
  const discovered = new Set<string>([baseUrl.replace(/\/$/, "") || baseUrl]);
  const queue: string[] = [baseUrl];
  const visited = new Set<string>();

  const sitemapUrl = new URL("/sitemap.xml", base).toString();
  try {
    const sitemapResponse = await fetchFn(sitemapUrl, {
      headers: { "User-Agent": "MemoryMiddleware-Crawler/1.0" },
      signal: AbortSignal.timeout(10_000),
    });
    if (sitemapResponse.ok) {
      const sitemapText = await sitemapResponse.text();
      const locMatches = sitemapText.matchAll(/<loc>([^<]+)<\/loc>/gi);
      for (const match of locMatches) {
        const loc = match[1]?.trim();
        if (!loc) continue;
        const normalized = normalizeUrl(loc, base);
        if (normalized) discovered.add(normalized);
      }
    }
  } catch {
    // sitemap optional
  }

  const $ = cheerio.load(homepageHtml);
  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");
    if (!href) return;
    const normalized = normalizeUrl(href, base);
    if (normalized) discovered.add(normalized);
  });

  while (queue.length > 0 && discovered.size < maxPages) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);

    try {
      const response = await fetchFn(current, {
        headers: {
          "User-Agent": "MemoryMiddleware-Crawler/1.0",
          Accept: "text/html,application/xhtml+xml",
        },
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) continue;
      const html = await response.text();
      const pageBase = new URL(current);
      const page$ = cheerio.load(html);
      page$("a[href]").each((_, element) => {
        const href = page$(element).attr("href");
        if (!href) return;
        const normalized = normalizeUrl(href, pageBase);
        if (!normalized || discovered.has(normalized)) return;
        discovered.add(normalized);
        if (discovered.size < maxPages) queue.push(normalized);
      });
    } catch {
      continue;
    }
  }

  return [...discovered].slice(0, maxPages);
}

export function isServicePage(url: string): boolean {
  try {
    const pathname = new URL(url).pathname;
    if (SERVICE_PAGE_PATTERN.test(pathname)) return true;
    return pathname.split("/").some((segment) => /service/i.test(segment));
  } catch {
    return false;
  }
}

export async function crawlSite(
  url: string,
  options: { maxPages?: number; fetchFn?: typeof fetch } = {},
): Promise<SiteCrawlResult> {
  const fetchFn = options.fetchFn ?? fetch;
  const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;
  const base = new URL(url);
  const collectedAt = new Date().toISOString();

  const homepage = await crawlWebsite(url, fetchFn);
  const candidateUrls = await discoverUrls(url, homepage.rawHtml, fetchFn, maxPages);

  const pages: CrawledPage[] = [];
  for (const pageUrl of candidateUrls) {
    try {
      const response = await fetchFn(pageUrl, {
        headers: {
          "User-Agent": "MemoryMiddleware-Crawler/1.0",
          Accept: "text/html,application/xhtml+xml",
        },
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) continue;
      const html = await response.text();
      const analysis = analyzeHtml(pageUrl, html);
      pages.push({ url: pageUrl, ...analysis });
    } catch {
      continue;
    }
  }

  if (pages.length === 0) {
    const analysis = analyzeHtml(url, homepage.rawHtml);
    pages.push({ url, ...analysis });
  }

  const robotsTxtPresent = await fetchExists(new URL("/robots.txt", base).toString(), fetchFn);
  const sitemapPresent = await fetchExists(new URL("/sitemap.xml", base).toString(), fetchFn);

  return {
    baseUrl: url,
    pages,
    schemaPresent: hasStructuredData(homepage.rawHtml),
    robotsTxtPresent,
    sitemapPresent,
    collectedAt,
  };
}
