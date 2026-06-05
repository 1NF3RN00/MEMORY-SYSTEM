# Observation Metric Catalog

Authoritative registry content for `packages/observation-registry/src/metric-catalog.ts`.

Providers register these at bootstrap. `validateObservation()` rejects unknown metrics.

---

## website

| categoryKey | metricKey | valueType | unit | description |
|-------------|-----------|-----------|------|-------------|
| site_structure | page_count | number | count | Total crawlable pages discovered |
| site_structure | service_page_count | number | count | Pages classified as service pages |
| metadata | pages_missing_title | number | count | Pages without title tag |
| metadata | duplicate_titles | number | count | Distinct pages sharing title text |
| heading_structure | pages_missing_h1 | number | count | Pages without H1 |
| content | average_word_count | number | count | Mean word count across pages |
| internal_seo | internal_link_count | number | count | Total internal links |
| technical_seo | schema_present | boolean | — | JSON-LD or microdata detected on homepage |
| technical_seo | robots_txt_present | boolean | — | robots.txt reachable |
| technical_seo | sitemap_present | boolean | — | sitemap.xml reachable |
| accessibility | accessibility_score | number | score_0_100 | Lighthouse accessibility score |

**Collection:** `packages/ingestion/src/crawler.ts` + normalization in `observation-providers/providers/website.ts`.

---

## pagespeed

| categoryKey | metricKey | valueType | unit | description |
|-------------|-----------|-----------|------|-------------|
| performance | mobile_score | number | score_0_100 | PageSpeed mobile performance |
| performance | desktop_score | number | score_0_100 | PageSpeed desktop performance |
| performance | speed_index | number | ms | Speed Index |
| core_web_vitals | largest_contentful_paint | number | ms | LCP |
| core_web_vitals | cumulative_layout_shift | number | ratio | CLS |
| core_web_vitals | total_blocking_time | number | ms | TBT |
| core_web_vitals | first_contentful_paint | number | ms | FCP |

**Collection:** Google PageSpeed Insights API in `observation-providers/providers/pagespeed.ts`. Input: `url`.

---

## google_business

| categoryKey | metricKey | valueType | unit | description |
|-------------|-----------|-----------|------|-------------|
| profile_quality | review_count | number | count | Total Google reviews |
| profile_quality | average_rating | number | score_0_5 | Mean star rating |
| reputation | review_velocity | number | count_per_month | New reviews per month |
| engagement | days_since_last_google_post | number | days | Days since last GBP post |

**Collection:** Apify Google Maps actor or direct GBP API. Input: `placeId` or `businessName` + `locationName`.

---

## facebook

| categoryKey | metricKey | valueType | unit | description |
|-------------|-----------|-----------|------|-------------|
| presence | follower_count | number | count | Page followers |
| activity | posts_per_month | number | count_per_month | Posts in last 30 days |
| engagement | average_post_reactions | number | count | Mean reactions per post |
| engagement | average_post_comments | number | count | Mean comments per post |

**Collection:** Apify actor `KoJrdxJCTtpon81KY`. Input: `pageUrl`.

---

## instagram

| categoryKey | metricKey | valueType | unit | description |
|-------------|-----------|-----------|------|-------------|
| presence | follower_count | number | count | Profile followers |
| activity | posts_per_month | number | count_per_month | Posts in last 30 days |
| engagement | engagement_rate | number | ratio | (likes+comments)/followers per post avg |
| engagement | average_likes | number | count | Mean likes per post |

**Collection:** Apify actor `shu8hvrXbJbY3Eb9W`. Input: `profileUrl`.

---

## tiktok

| categoryKey | metricKey | valueType | unit | description |
|-------------|-----------|-----------|------|-------------|
| presence | follower_count | number | count | Profile followers |
| activity | posts_per_month | number | count_per_month | Videos in last 30 days |
| engagement | average_views | number | count | Mean views per video |
| engagement | average_likes | number | count | Mean likes per video |
| engagement | engagement_rate | number | ratio | (likes+comments+shares)/views |
| growth | monthly_view_growth | number | ratio | Month-over-month view change |
| growth | monthly_follower_growth | number | ratio | Month-over-month follower change |

**Collection:** Apify actor `GdWCkxBtKWOsKjdch`. Input: `profileUrl` or `hashtags`.

---

## google_maps (competitor discovery)

| categoryKey | metricKey | valueType | unit | description |
|-------------|-----------|-----------|------|-------------|
| visibility | local_pack_presence | boolean | — | Business appears in local results |
| reputation | competitor_review_count | number | count | Competitor review count |
| reputation | competitor_rating | number | score_0_5 | Competitor average rating |

**Collection:** Apify actor `8PLCMTY0L77LJQaaZ`. Input: `searchQueries`, `locationName`. Set `competitorId` on observations.

---

## google_search

| categoryKey | metricKey | valueType | unit | description |
|-------------|-----------|-----------|------|-------------|
| rankings | keyword_rank | number | rank | Rank for single keyword |
| rankings | average_rank | number | rank | Mean rank across tracked keywords |
| visibility | top3_keywords | number | count | Keywords ranking 1–3 |
| visibility | top10_keywords | number | count | Keywords ranking 1–10 |
| visibility | competitor_rankings | array | — | `{ keyword, rank, competitorId? }[]` |

**Collection:** Apify actor `YNcgn7yiLc72ayYeB`. Input: `query`, `maxItems`.

---

## facebook_ads

| categoryKey | metricKey | valueType | unit | description |
|-------------|-----------|-----------|------|-------------|
| visibility | active_ad_count | number | count | Active ads for page/keyword |
| engagement | top_ad_impressions | number | count | Highest impression ad count |

**Collection:** Apify actor `XtaWFhbtfxyzqrFmd`. Input: `urls`.

---

## competitor (cross-provider metrics)

These metrics may be produced by any provider but MUST set `competitorId` in metadata.

| categoryKey | metricKey | valueType | unit | description |
|-------------|-----------|-----------|------|-------------|
| website | competitor_page_count | number | count | Competitor site page count |
| website | competitor_speed_score | number | score_0_100 | Competitor mobile PageSpeed |
| reputation | competitor_review_count | number | count | Competitor review count |
| reputation | competitor_rating | number | score_0_5 | Competitor rating |
| visibility | competitor_rankings | array | — | Competitor SERP positions |
| social | competitor_engagement_rate | number | ratio | Competitor social engagement |

---

## Normalization rules

1. All timestamps → ISO-8601 UTC.
2. All ratios → float 0–1 unless otherwise specified (engagement_rate).
3. Counts → non-negative integers.
4. Scores → clamp to declared unit range.
5. `source` = canonical key (`google_business_profile`, `facebook_page`, `instagram_profile`, `tiktok_profile`, `website_crawl`, `pagespeed_insights`, `google_search`, `google_maps`).
6. `platform` = one of `facebook`, `instagram`, `tiktok`, `google`, `website` when applicable.
