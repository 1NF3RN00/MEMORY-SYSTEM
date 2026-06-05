import type { CollectInput, Observation, ObservationValue } from "@memory-middleware/shared-types";
import { isRecord, readNumber, readString, slugify } from "../apify/field-utils.js";
import { buildProviderObservations, type ObservationDraft } from "./build-observation.js";

const PROVIDER_KEY = "google_maps";
const SOURCE = "apify_google_maps";

export interface GoogleMapsNormalizeOptions {
  subjectPlaceId?: string;
  subjectBusinessName?: string;
}

function competitorIdForItem(item: Record<string, unknown>): string {
  const placeId = readString(item, ["placeId", "place_id", "cid"]);
  if (placeId) return slugify(placeId);
  const title = readString(item, ["title", "name", "businessName"]);
  if (title) return slugify(title);
  return "unknown_competitor";
}

function matchesSubject(
  item: Record<string, unknown>,
  options: GoogleMapsNormalizeOptions,
): boolean {
  if (options.subjectPlaceId) {
    const placeId = readString(item, ["placeId", "place_id", "cid"]);
    if (placeId && placeId === options.subjectPlaceId) return true;
  }
  if (options.subjectBusinessName) {
    const title = readString(item, ["title", "name", "businessName"]);
    if (title && title.toLowerCase().includes(options.subjectBusinessName.toLowerCase())) {
      return true;
    }
  }
  return false;
}

export function normalizeGoogleMapsObservations(
  items: unknown[],
  input: CollectInput,
  collectedAt: string,
  sourceLabel: string,
  options: GoogleMapsNormalizeOptions = {},
): Observation[] {
  const drafts: ObservationDraft[] = [];
  let subjectFound = false;

  for (const rawItem of items) {
    if (!isRecord(rawItem)) continue;
    const competitorId = competitorIdForItem(rawItem);
    const reviewCount = readNumber(rawItem, [
      "reviewsCount",
      "reviewCount",
      "totalReviews",
      "userRatingsTotal",
    ]);
    const rating = readNumber(rawItem, ["totalScore", "rating", "stars", "averageRating"]);

    if (matchesSubject(rawItem, options)) {
      subjectFound = true;
    }

    if (reviewCount !== null) {
      drafts.push({
        category: "reputation",
        metric: "competitor_review_count",
        value: reviewCount,
        sourceLabel,
        competitorId,
        platform: "google",
      });
    }

    if (rating !== null) {
      drafts.push({
        category: "reputation",
        metric: "competitor_rating",
        value: rating,
        sourceLabel,
        competitorId,
        platform: "google",
      });
    }
  }

  const hasSubjectFilter =
    options.subjectPlaceId !== undefined || options.subjectBusinessName !== undefined;
  drafts.push({
    category: "visibility",
    metric: "local_pack_presence",
    value: hasSubjectFilter ? subjectFound : items.length > 0,
    sourceLabel,
    platform: "google",
  });

  return buildProviderObservations(input, PROVIDER_KEY, SOURCE, drafts, collectedAt);
}

export function normalizeGoogleBusinessObservations(
  items: unknown[],
  input: CollectInput,
  collectedAt: string,
  options: GoogleMapsNormalizeOptions & { sourceLabel: string },
): Observation[] {
  const drafts: ObservationDraft[] = [];
  let matched: Record<string, unknown> | null = null;

  for (const rawItem of items) {
    if (!isRecord(rawItem)) continue;
    if (matchesSubject(rawItem, options)) {
      matched = rawItem;
      break;
    }
  }

  if (!matched && items.length > 0 && isRecord(items[0])) {
    matched = items[0];
  }

  if (!matched) {
    return [];
  }

  const reviewCount = readNumber(matched, [
    "reviewsCount",
    "reviewCount",
    "totalReviews",
    "userRatingsTotal",
  ]);
  const rating = readNumber(matched, ["totalScore", "rating", "stars", "averageRating"]);

  if (reviewCount !== null) {
    drafts.push({
      category: "profile_quality",
      metric: "review_count",
      value: reviewCount,
      sourceLabel: options.sourceLabel,
      platform: "google",
    });
  }

  if (rating !== null) {
    drafts.push({
      category: "profile_quality",
      metric: "average_rating",
      value: rating,
      sourceLabel: options.sourceLabel,
      platform: "google",
    });
  }

  return buildProviderObservations(input, "google_business", "apify_google_business", drafts, collectedAt);
}

export function competitorRankingsFromItems(items: unknown[]): ObservationValue[] {
  const rankings: ObservationValue[] = [];
  for (const rawItem of items) {
    if (!isRecord(rawItem)) continue;
    const title = readString(rawItem, ["title", "name", "businessName"]);
    const rank = readNumber(rawItem, ["rank", "position", "searchRank"]);
    const rating = readNumber(rawItem, ["totalScore", "rating", "stars"]);
    rankings.push({
      name: title ?? "unknown",
      rank: rank ?? null,
      rating: rating ?? null,
    });
  }
  return rankings;
}
