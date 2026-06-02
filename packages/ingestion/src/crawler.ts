import * as cheerio from "cheerio";
import TurndownService from "turndown";

export interface CrawlResult {
  url: string;
  rawHtml: string;
  extractedTitle: string;
  cleanedHtml: string;
  markdown: string;
  fetchedAt: string;
}

const NOISE_SELECTORS = [
  "script",
  "style",
  "noscript",
  "nav",
  "footer",
  "header",
  ".nav",
  ".navigation",
  ".footer",
  ".sidebar",
  "#sidebar",
  "[role='navigation']",
  "[role='banner']",
  "[role='contentinfo']",
];

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
});

turndown.remove(["script", "style", "noscript"]);

export async function crawlWebsite(url: string, fetchFn: typeof fetch = fetch): Promise<CrawlResult> {
  const response = await fetchFn(url, {
    headers: {
      "User-Agent": "MemoryMiddleware-Crawler/1.0",
      Accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(`Crawl failed: HTTP ${response.status} for ${url}`);
  }

  const rawHtml = await response.text();
  const $ = cheerio.load(rawHtml);

  for (const selector of NOISE_SELECTORS) {
    $(selector).remove();
  }

  const title =
    $("title").first().text().trim() ||
    $("h1").first().text().trim() ||
    url;

  const main =
    $("main").html() ||
    $("article").html() ||
    $("[role='main']").html() ||
    $("body").html() ||
    rawHtml;

  const cleanedHtml = main ?? rawHtml;
  const markdown = turndown.turndown(cleanedHtml).trim();

  return {
    url,
    rawHtml,
    extractedTitle: title,
    cleanedHtml,
    markdown,
    fetchedAt: new Date().toISOString(),
  };
}
