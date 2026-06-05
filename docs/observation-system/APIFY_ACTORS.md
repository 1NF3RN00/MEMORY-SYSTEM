# Apify Actors Reference

Sanitized reference for `packages/observation-providers/src/apify/`. **Never commit API tokens.** Use env `APIFY_API_TOKEN`.

Original scratch notes: [../APIFY_SYSTEM.md](../APIFY_SYSTEM.md) — remove any embedded token from that file.

---

## Client setup

```ts
import { ApifyClient } from "apify-client";

const client = new ApifyClient({ token: process.env.APIFY_API_TOKEN });
```

Dependency: add `apify-client` to `packages/observation-providers/package.json`.

---

## Actor map

| providerKey | actorId | Input params (API) | Normalization target |
|-------------|---------|-------------------|----------------------|
| facebook | `KoJrdxJCTtpon81KY` | `pageUrl`, `resultsLimit?`, `onlyPostsNewerThan?` | `follower_count`, `posts_per_month`, `average_post_reactions`, `average_post_comments` |
| instagram | `shu8hvrXbJbY3Eb9W` | `profileUrl`, `resultsLimit?`, `resultsType: "posts"` | `follower_count`, `posts_per_month`, `engagement_rate`, `average_likes` |
| tiktok | `GdWCkxBtKWOsKjdch` | `profileUrl` or `hashtags`, `resultsPerPage?` | `follower_count`, `average_views`, `engagement_rate`, `monthly_follower_growth` |
| facebook_ads | `XtaWFhbtfxyzqrFmd` | `urls[]`, `count?` | `active_ad_count`, `top_ad_impressions` |
| google_maps | `8PLCMTY0L77LJQaaZ` | `searchQueries[]`, `locationName`, `maxResults?` | `competitor_review_count`, `competitor_rating`, `local_pack_presence` |
| google_search | `YNcgn7yiLc72ayYeB` | `query`, `maxItems?`, `country?` | `keyword_rank`, `top10_keywords`, `competitor_rankings` |

---

## Run lifecycle

File: `packages/observation-providers/src/apify/run-actor.ts`

```ts
export async function runApifyActor(
  actorId: string,
  input: Record<string, unknown>,
): Promise<{ runId: string; datasetId: string; items: unknown[] }>
```

Steps:

1. `client.actor(actorId).call(input)` — await completion.
2. `client.dataset(run.defaultDatasetId).listItems()` — fetch all items.
3. Return items to provider-specific normalizer.
4. Emit `observation_collection_started` / `completed` / `failed` events.

For long runs: optional async mode stores `runId` on `IngestionJob`-style tracking row or returns `202` with poll URL.

---

## Facebook (`KoJrdxJCTtpon81KY`)

```json
{
  "startUrls": [{ "url": "<pageUrl>" }],
  "resultsLimit": 20,
  "captionText": false,
  "onlyPostsNewerThan": "<ISO date, default 30 days ago>"
}
```

Normalize from items:

- `follower_count` ← page follower field (actor-specific key — map in `normalize/facebook.ts`)
- `posts_per_month` ← count items in date window
- `average_post_reactions` ← mean of reaction fields
- `average_post_comments` ← mean of comment fields

---

## Instagram (`shu8hvrXbJbY3Eb9W`)

```json
{
  "resultsType": "posts",
  "directUrls": ["<profileUrl>"],
  "resultsLimit": 100,
  "addParentData": true
}
```

Normalize:

- `follower_count` ← parent profile data
- `posts_per_month` ← count posts in window
- `average_likes` ← mean likes
- `engagement_rate` ← `(avgLikes + avgComments) / follower_count`

---

## TikTok (`GdWCkxBtKWOsKjdch`)

```json
{
  "profiles": ["<profileUrl>"],
  "resultsPerPage": 100,
  "shouldDownloadVideos": false
}
```

Normalize:

- `follower_count`, `average_views`, `average_likes`, `engagement_rate`
- `monthly_follower_growth` ← compare current vs prior observation for same `businessId`+`metric` if prior exists; else omit

---

## Google Maps (`8PLCMTY0L77LJQaaZ`)

```json
{
  "searchQueries": ["<business type or name>"],
  "locationName": "<region>",
  "language": "en",
  "maxResults": 100
}
```

Normalize per result item:

- Set `competitorId` from place ID or generated slug.
- `competitor_review_count`, `competitor_rating`
- `local_pack_presence` for subject business match

---

## Google Search (`YNcgn7yiLc72ayYeB`)

```json
{
  "maxItems": 10,
  "query": "<keyword>",
  "country": "us",
  "language": "en"
}
```

Normalize:

- `keyword_rank` ← position of matching domain if present
- `top10_keywords` / `top3_keywords` ← aggregate across batch queries
- `competitor_rankings` ← array output

---

## Facebook Ads (`XtaWFhbtfxyzqrFmd`)

```json
{
  "urls": [{ "url": "<ads library url>" }],
  "count": 100
}
```

Normalize:

- `active_ad_count` ← item count
- `top_ad_impressions` ← max impressions field

---

## Error handling

| Apify status | Action |
|--------------|--------|
| Run failed | Emit `observation_collection_failed`; return 502 with `runId` |
| Empty dataset | Return success with `observations: []`; do not fabricate |
| Rate limit | Retry once with 30s backoff; then fail |

---

## Security

- `APIFY_API_TOKEN` in env only.
- Scrub token from `docs/APIFY_SYSTEM.md` line 2 if present.
- Collection routes require `workspace_admin` or API key with `ingest` permission.
