import type { CollectInput, Observation, ObservationValue } from "@memory-middleware/shared-types";
import { isRecord, readNumber, readString } from "../apify/field-utils.js";
import { buildProviderObservations } from "./build-observation.js";

const PROVIDER_KEY = "google_search";
const SOURCE = "apify_google_search";

export function normalizeGoogleSearchObservations(
  items: unknown[],
  input: CollectInput,
  collectedAt: string,
  query: string,
  targetDomain?: string,
): Observation[] {
  const rankings: Array<Record<string, unknown>> = [];
  let keywordRank: number | null = null;
  let top3 = 0;
  let top10 = 0;

  for (const rawItem of items) {
    if (!isRecord(rawItem)) continue;
    const position = readNumber(rawItem, ["position", "rank", "organicRank", "pageRank"]);
    const url = readString(rawItem, ["url", "link", "pageUrl"]);
    const title = readString(rawItem, ["title", "name"]);

    if (position !== null) {
      if (position <= 3) top3 += 1;
      if (position <= 10) top10 += 1;
    }

    if (
      targetDomain &&
      url &&
      url.toLowerCase().includes(targetDomain.toLowerCase()) &&
      position !== null &&
      keywordRank === null
    ) {
      keywordRank = position;
    }

    rankings.push({
      position: position ?? null,
      url: url ?? null,
      title: title ?? null,
    });
  }

  if (keywordRank === null && items.length > 0) {
    const first = items.find(isRecord);
    if (first) {
      keywordRank = readNumber(first, ["position", "rank", "organicRank"]);
    }
  }

  const drafts = [
    {
      category: "rankings",
      metric: "keyword_rank",
      value: keywordRank ?? 0,
      sourceLabel: query,
      platform: "google",
    },
    {
      category: "visibility",
      metric: "top3_keywords",
      value: top3,
      sourceLabel: query,
      platform: "google",
    },
    {
      category: "visibility",
      metric: "top10_keywords",
      value: top10,
      sourceLabel: query,
      platform: "google",
    },
    {
      category: "visibility",
      metric: "competitor_rankings",
      value: rankings as ObservationValue,
      sourceLabel: query,
      platform: "google",
    },
  ];

  return buildProviderObservations(input, PROVIDER_KEY, SOURCE, drafts, collectedAt);
}
