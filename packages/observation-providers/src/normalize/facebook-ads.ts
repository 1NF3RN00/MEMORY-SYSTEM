import type { CollectInput, Observation } from "@memory-middleware/shared-types";
import { isRecord, readNumber } from "../apify/field-utils.js";
import { buildProviderObservations } from "./build-observation.js";

const PROVIDER_KEY = "facebook_ads";
const SOURCE = "apify_facebook_ads";

export function normalizeFacebookAdsObservations(
  items: unknown[],
  input: CollectInput,
  collectedAt: string,
  sourceLabel: string,
): Observation[] {
  let topImpressions = 0;

  for (const item of items) {
    if (!isRecord(item)) continue;
    const impressions = readNumber(item, [
      "impressions",
      "impressionCount",
      "impressionsUpperBound",
      "reach",
    ]);
    if (impressions !== null && impressions > topImpressions) {
      topImpressions = impressions;
    }
  }

  return buildProviderObservations(
    input,
    PROVIDER_KEY,
    SOURCE,
    [
      {
        category: "visibility",
        metric: "active_ad_count",
        value: items.length,
        sourceLabel,
        platform: "facebook",
      },
      {
        category: "engagement",
        metric: "top_ad_impressions",
        value: topImpressions,
        sourceLabel,
        platform: "facebook",
      },
    ],
    collectedAt,
  );
}
