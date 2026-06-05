import type { CollectInput, Observation } from "@memory-middleware/shared-types";
import { normalizeObservationFromRegistry } from "@memory-middleware/observation-registry";
import { isServicePage, type SiteCrawlResult } from "../crawl-site.js";

const PROVIDER_KEY = "website";
const SOURCE = "website_crawl";

interface MetricDraft {
  category: string;
  metric: string;
  value: number | boolean;
}

function buildDrafts(crawl: SiteCrawlResult, accessibilityScore?: number): MetricDraft[] {
  const titles = crawl.pages.map((page) => page.title?.trim() || "").filter(Boolean);
  const titleCounts = new Map<string, number>();
  for (const title of titles) {
    titleCounts.set(title, (titleCounts.get(title) ?? 0) + 1);
  }
  const duplicateTitles = [...titleCounts.values()].filter((count) => count > 1).length;

  const pagesMissingTitle = crawl.pages.filter((page) => !page.title?.trim()).length;
  const pagesMissingH1 = crawl.pages.filter((page) => !page.h1?.trim()).length;
  const servicePageCount = crawl.pages.filter((page) => isServicePage(page.url)).length;
  const totalWordCount = crawl.pages.reduce((sum, page) => sum + page.wordCount, 0);
  const averageWordCount =
    crawl.pages.length > 0 ? Math.round(totalWordCount / crawl.pages.length) : 0;
  const internalLinkCount = crawl.pages.reduce((sum, page) => sum + page.internalLinkCount, 0);

  const drafts: MetricDraft[] = [
    { category: "site_structure", metric: "page_count", value: crawl.pages.length },
    { category: "site_structure", metric: "service_page_count", value: servicePageCount },
    { category: "metadata", metric: "pages_missing_title", value: pagesMissingTitle },
    { category: "metadata", metric: "duplicate_titles", value: duplicateTitles },
    { category: "heading_structure", metric: "pages_missing_h1", value: pagesMissingH1 },
    { category: "content", metric: "average_word_count", value: averageWordCount },
    { category: "internal_seo", metric: "internal_link_count", value: internalLinkCount },
    { category: "technical_seo", metric: "schema_present", value: crawl.schemaPresent },
    { category: "technical_seo", metric: "robots_txt_present", value: crawl.robotsTxtPresent },
    { category: "technical_seo", metric: "sitemap_present", value: crawl.sitemapPresent },
  ];

  if (accessibilityScore !== undefined) {
    drafts.push({
      category: "accessibility",
      metric: "accessibility_score",
      value: accessibilityScore,
    });
  }

  return drafts;
}

export function normalizeWebsiteObservations(
  crawl: SiteCrawlResult,
  input: CollectInput,
  accessibilityScore?: number,
): Observation[] {
  const drafts = buildDrafts(crawl, accessibilityScore);
  const sourceLabel = crawl.baseUrl;

  return drafts.map((draft) => {
    const observation = normalizeObservationFromRegistry(
      {
        workspaceId: input.workspaceId,
        metric: draft.metric,
        value: draft.value,
        source: SOURCE,
        timestamp: crawl.collectedAt,
        metadata: {
          provider: PROVIDER_KEY,
          category: draft.category,
          metric: draft.metric,
          collectedAt: crawl.collectedAt,
          sourceLabel,
          ...(input.businessId ? { businessId: input.businessId } : {}),
          ...(input.competitorId ? { competitorId: input.competitorId } : {}),
        },
      },
      PROVIDER_KEY,
      {
        categoryKey: draft.category,
        metricKey: draft.metric,
        defaultWorkspaceId: input.workspaceId,
        defaultSource: SOURCE,
      },
    );
    return observation;
  });
}
