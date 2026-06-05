import type {
  ObservationMetricDefinition,
  ObservationProviderDefinition,
} from "@memory-middleware/shared-types";

type MetricRow = Omit<ObservationMetricDefinition, "providerKey">;

function metrics(providerKey: string, rows: MetricRow[]): ObservationMetricDefinition[] {
  return rows.map((row) => ({ ...row, providerKey }));
}

/** Authoritative seed from docs/observation-system/METRIC_CATALOG.md */
export const METRIC_CATALOG: ObservationMetricDefinition[] = [
  ...metrics("website", [
    { metricKey: "page_count", categoryKey: "site_structure", valueType: "number", unit: "count", description: "Total crawlable pages discovered" },
    { metricKey: "service_page_count", categoryKey: "site_structure", valueType: "number", unit: "count", description: "Pages classified as service pages" },
    { metricKey: "pages_missing_title", categoryKey: "metadata", valueType: "number", unit: "count", description: "Pages without title tag" },
    { metricKey: "duplicate_titles", categoryKey: "metadata", valueType: "number", unit: "count", description: "Distinct pages sharing title text" },
    { metricKey: "pages_missing_h1", categoryKey: "heading_structure", valueType: "number", unit: "count", description: "Pages without H1" },
    { metricKey: "average_word_count", categoryKey: "content", valueType: "number", unit: "count", description: "Mean word count across pages" },
    { metricKey: "internal_link_count", categoryKey: "internal_seo", valueType: "number", unit: "count", description: "Total internal links" },
    { metricKey: "schema_present", categoryKey: "technical_seo", valueType: "boolean", description: "JSON-LD or microdata detected on homepage" },
    { metricKey: "robots_txt_present", categoryKey: "technical_seo", valueType: "boolean", description: "robots.txt reachable" },
    { metricKey: "sitemap_present", categoryKey: "technical_seo", valueType: "boolean", description: "sitemap.xml reachable" },
    { metricKey: "accessibility_score", categoryKey: "accessibility", valueType: "number", unit: "score_0_100", description: "Lighthouse accessibility score" },
  ]),
  ...metrics("pagespeed", [
    { metricKey: "mobile_score", categoryKey: "performance", valueType: "number", unit: "score_0_100", description: "PageSpeed mobile performance" },
    { metricKey: "desktop_score", categoryKey: "performance", valueType: "number", unit: "score_0_100", description: "PageSpeed desktop performance" },
    { metricKey: "speed_index", categoryKey: "performance", valueType: "number", unit: "ms", description: "Speed Index" },
    { metricKey: "largest_contentful_paint", categoryKey: "core_web_vitals", valueType: "number", unit: "ms", description: "LCP" },
    { metricKey: "cumulative_layout_shift", categoryKey: "core_web_vitals", valueType: "number", unit: "ratio", description: "CLS" },
    { metricKey: "total_blocking_time", categoryKey: "core_web_vitals", valueType: "number", unit: "ms", description: "TBT" },
    { metricKey: "first_contentful_paint", categoryKey: "core_web_vitals", valueType: "number", unit: "ms", description: "FCP" },
  ]),
  ...metrics("google_business", [
    { metricKey: "review_count", categoryKey: "profile_quality", valueType: "number", unit: "count", description: "Total Google reviews" },
    { metricKey: "average_rating", categoryKey: "profile_quality", valueType: "number", unit: "score_0_5", description: "Mean star rating" },
    { metricKey: "review_velocity", categoryKey: "reputation", valueType: "number", unit: "count_per_month", description: "New reviews per month" },
    { metricKey: "days_since_last_google_post", categoryKey: "engagement", valueType: "number", unit: "days", description: "Days since last GBP post" },
  ]),
  ...metrics("facebook", [
    { metricKey: "follower_count", categoryKey: "presence", valueType: "number", unit: "count", description: "Page followers" },
    { metricKey: "posts_per_month", categoryKey: "activity", valueType: "number", unit: "count_per_month", description: "Posts in last 30 days" },
    { metricKey: "average_post_reactions", categoryKey: "engagement", valueType: "number", unit: "count", description: "Mean reactions per post" },
    { metricKey: "average_post_comments", categoryKey: "engagement", valueType: "number", unit: "count", description: "Mean comments per post" },
  ]),
  ...metrics("instagram", [
    { metricKey: "follower_count", categoryKey: "presence", valueType: "number", unit: "count", description: "Profile followers" },
    { metricKey: "posts_per_month", categoryKey: "activity", valueType: "number", unit: "count_per_month", description: "Posts in last 30 days" },
    { metricKey: "engagement_rate", categoryKey: "engagement", valueType: "number", unit: "ratio", description: "(likes+comments)/followers per post avg" },
    { metricKey: "average_likes", categoryKey: "engagement", valueType: "number", unit: "count", description: "Mean likes per post" },
  ]),
  ...metrics("tiktok", [
    { metricKey: "follower_count", categoryKey: "presence", valueType: "number", unit: "count", description: "Profile followers" },
    { metricKey: "posts_per_month", categoryKey: "activity", valueType: "number", unit: "count_per_month", description: "Videos in last 30 days" },
    { metricKey: "average_views", categoryKey: "engagement", valueType: "number", unit: "count", description: "Mean views per video" },
    { metricKey: "average_likes", categoryKey: "engagement", valueType: "number", unit: "count", description: "Mean likes per video" },
    { metricKey: "engagement_rate", categoryKey: "engagement", valueType: "number", unit: "ratio", description: "(likes+comments+shares)/views" },
    { metricKey: "monthly_view_growth", categoryKey: "growth", valueType: "number", unit: "ratio", description: "Month-over-month view change" },
    { metricKey: "monthly_follower_growth", categoryKey: "growth", valueType: "number", unit: "ratio", description: "Month-over-month follower change" },
  ]),
  ...metrics("google_maps", [
    { metricKey: "local_pack_presence", categoryKey: "visibility", valueType: "boolean", description: "Business appears in local results" },
    { metricKey: "competitor_review_count", categoryKey: "reputation", valueType: "number", unit: "count", description: "Competitor review count" },
    { metricKey: "competitor_rating", categoryKey: "reputation", valueType: "number", unit: "score_0_5", description: "Competitor average rating" },
  ]),
  ...metrics("google_search", [
    { metricKey: "keyword_rank", categoryKey: "rankings", valueType: "number", unit: "rank", description: "Rank for single keyword" },
    { metricKey: "average_rank", categoryKey: "rankings", valueType: "number", unit: "rank", description: "Mean rank across tracked keywords" },
    { metricKey: "top3_keywords", categoryKey: "visibility", valueType: "number", unit: "count", description: "Keywords ranking 1–3" },
    { metricKey: "top10_keywords", categoryKey: "visibility", valueType: "number", unit: "count", description: "Keywords ranking 1–10" },
    { metricKey: "competitor_rankings", categoryKey: "visibility", valueType: "array", description: "Competitor SERP positions" },
  ]),
  ...metrics("facebook_ads", [
    { metricKey: "active_ad_count", categoryKey: "visibility", valueType: "number", unit: "count", description: "Active ads for page/keyword" },
    { metricKey: "top_ad_impressions", categoryKey: "engagement", valueType: "number", unit: "count", description: "Highest impression ad count" },
  ]),
  ...metrics("competitor", [
    { metricKey: "competitor_page_count", categoryKey: "website", valueType: "number", unit: "count", description: "Competitor site page count" },
    { metricKey: "competitor_speed_score", categoryKey: "website", valueType: "number", unit: "score_0_100", description: "Competitor mobile PageSpeed" },
    { metricKey: "competitor_review_count", categoryKey: "reputation", valueType: "number", unit: "count", description: "Competitor review count" },
    { metricKey: "competitor_rating", categoryKey: "reputation", valueType: "number", unit: "score_0_5", description: "Competitor rating" },
    { metricKey: "competitor_rankings", categoryKey: "visibility", valueType: "array", description: "Competitor SERP positions" },
    { metricKey: "competitor_engagement_rate", categoryKey: "social", valueType: "number", unit: "ratio", description: "Competitor social engagement" },
  ]),
];

function categoriesForProvider(providerKey: string): string[] {
  const set = new Set<string>();
  for (const metric of METRIC_CATALOG) {
    if (metric.providerKey === providerKey) set.add(metric.categoryKey);
  }
  return [...set].sort();
}

function metricsForProvider(providerKey: string): string[] {
  return METRIC_CATALOG.filter((m) => m.providerKey === providerKey).map((m) => m.metricKey);
}

export const PROVIDER_CATALOG: ObservationProviderDefinition[] = [
  {
    providerKey: "website",
    name: "Website Crawl",
    description: "Technical SEO and site structure observations from website crawl",
    categories: categoriesForProvider("website"),
    metrics: metricsForProvider("website"),
    collectionInputSchema: {
      type: "object",
      required: ["url"],
      properties: { url: { type: "string", format: "uri" } },
    },
  },
  {
    providerKey: "pagespeed",
    name: "PageSpeed Insights",
    description: "Core Web Vitals and performance scores",
    categories: categoriesForProvider("pagespeed"),
    metrics: metricsForProvider("pagespeed"),
    collectionInputSchema: {
      type: "object",
      required: ["url"],
      properties: {
        url: { type: "string", format: "uri" },
        strategy: { type: "string", enum: ["mobile", "desktop"] },
      },
    },
  },
  {
    providerKey: "google_business",
    name: "Google Business Profile",
    description: "GBP reputation and engagement observations",
    categories: categoriesForProvider("google_business"),
    metrics: metricsForProvider("google_business"),
    collectionInputSchema: {
      type: "object",
      properties: {
        placeId: { type: "string" },
        businessName: { type: "string" },
        locationName: { type: "string" },
      },
    },
  },
  {
    providerKey: "facebook",
    name: "Facebook Page",
    description: "Facebook presence and engagement via Apify",
    categories: categoriesForProvider("facebook"),
    metrics: metricsForProvider("facebook"),
    collectionInputSchema: {
      type: "object",
      required: ["pageUrl"],
      properties: { pageUrl: { type: "string", format: "uri" } },
    },
  },
  {
    providerKey: "instagram",
    name: "Instagram Profile",
    description: "Instagram presence and engagement via Apify",
    categories: categoriesForProvider("instagram"),
    metrics: metricsForProvider("instagram"),
    collectionInputSchema: {
      type: "object",
      required: ["profileUrl"],
      properties: { profileUrl: { type: "string", format: "uri" } },
    },
  },
  {
    providerKey: "tiktok",
    name: "TikTok Profile",
    description: "TikTok presence, engagement, and growth via Apify",
    categories: categoriesForProvider("tiktok"),
    metrics: metricsForProvider("tiktok"),
    collectionInputSchema: {
      type: "object",
      properties: {
        profileUrl: { type: "string", format: "uri" },
        hashtags: { type: "array", items: { type: "string" } },
      },
    },
  },
  {
    providerKey: "google_maps",
    name: "Google Maps Search",
    description: "Local pack and competitor discovery via Apify",
    categories: categoriesForProvider("google_maps"),
    metrics: metricsForProvider("google_maps"),
    collectionInputSchema: {
      type: "object",
      required: ["searchQueries", "locationName"],
      properties: {
        searchQueries: { type: "array", items: { type: "string" } },
        locationName: { type: "string" },
      },
    },
  },
  {
    providerKey: "google_search",
    name: "Google Search",
    description: "SERP rankings and visibility via Apify",
    categories: categoriesForProvider("google_search"),
    metrics: metricsForProvider("google_search"),
    collectionInputSchema: {
      type: "object",
      required: ["query"],
      properties: {
        query: { type: "string" },
        maxItems: { type: "number" },
      },
    },
  },
  {
    providerKey: "facebook_ads",
    name: "Facebook Ads Library",
    description: "Active ad visibility via Apify",
    categories: categoriesForProvider("facebook_ads"),
    metrics: metricsForProvider("facebook_ads"),
    collectionInputSchema: {
      type: "object",
      required: ["urls"],
      properties: { urls: { type: "array", items: { type: "string", format: "uri" } } },
    },
  },
  {
    providerKey: "competitor",
    name: "Competitor Metrics",
    description: "Cross-provider competitor observations (requires competitorId)",
    categories: categoriesForProvider("competitor"),
    metrics: metricsForProvider("competitor"),
    collectionInputSchema: {
      type: "object",
      required: ["competitorId"],
      properties: { competitorId: { type: "string" } },
    },
  },
];
