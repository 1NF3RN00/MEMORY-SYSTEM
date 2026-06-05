import type { ApifyClient } from "apify-client";
import type {
  CollectInput,
  CollectResult,
  Observation,
  ObservationProvider,
} from "@memory-middleware/shared-types";
import { listProviders } from "@memory-middleware/observation-registry";
import { runApifyActor } from "../apify/run-actor.js";

export interface ApifyProviderOptions {
  providerKey: string;
  actorId: string;
  buildActorInput: (params: Record<string, unknown>) => Record<string, unknown>;
  normalizeItems: (
    items: unknown[],
    input: CollectInput,
    collectedAt: string,
    params: Record<string, unknown>,
  ) => Observation[];
}

export function createApifyProvider(
  client: ApifyClient,
  options: ApifyProviderOptions,
): ObservationProvider {
  const definition = listProviders().find(
    (provider) => provider.providerKey === options.providerKey,
  );
  if (!definition) {
    throw new Error(`Provider definition missing: ${options.providerKey}`);
  }

  return {
    definition,
    async collect(input: CollectInput): Promise<CollectResult> {
      const actorInput = options.buildActorInput(input.params);
      const collectedAt = new Date().toISOString();
      const result = await runApifyActor(client, options.actorId, actorInput);
      const observations = options.normalizeItems(
        result.items,
        input,
        collectedAt,
        input.params,
      );

      return {
        providerKey: options.providerKey,
        observations,
        rawItemCount: result.items.length,
        collectedAt,
      };
    },
  };
}

function thirtyDaysAgoDate(): string {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return date.toISOString().slice(0, 10);
}

export function buildFacebookActorInput(params: Record<string, unknown>): Record<string, unknown> {
  const pageUrl = params.pageUrl;
  if (typeof pageUrl !== "string" || !pageUrl.trim()) {
    throw new Error("params.pageUrl is required");
  }
  return {
    startUrls: [{ url: pageUrl }],
    resultsLimit: typeof params.resultsLimit === "number" ? params.resultsLimit : 20,
    captionText: false,
    onlyPostsNewerThan:
      typeof params.onlyPostsNewerThan === "string"
        ? params.onlyPostsNewerThan
        : thirtyDaysAgoDate(),
  };
}

export function buildInstagramActorInput(params: Record<string, unknown>): Record<string, unknown> {
  const profileUrl = params.profileUrl;
  if (typeof profileUrl !== "string" || !profileUrl.trim()) {
    throw new Error("params.profileUrl is required");
  }
  return {
    resultsType: "posts",
    directUrls: [profileUrl],
    resultsLimit: typeof params.resultsLimit === "number" ? params.resultsLimit : 100,
    addParentData: true,
  };
}

export function buildTikTokActorInput(params: Record<string, unknown>): Record<string, unknown> {
  const profileUrl = params.profileUrl;
  const hashtags = params.hashtags;
  if (typeof profileUrl === "string" && profileUrl.trim()) {
    return {
      profiles: [profileUrl],
      resultsPerPage: typeof params.resultsPerPage === "number" ? params.resultsPerPage : 100,
      shouldDownloadVideos: false,
    };
  }
  if (Array.isArray(hashtags) && hashtags.length > 0) {
    return {
      hashtags,
      resultsPerPage: typeof params.resultsPerPage === "number" ? params.resultsPerPage : 100,
      shouldDownloadVideos: false,
    };
  }
  throw new Error("params.profileUrl or params.hashtags is required");
}

export function buildFacebookAdsActorInput(params: Record<string, unknown>): Record<string, unknown> {
  const urls = params.urls;
  if (!Array.isArray(urls) || urls.length === 0) {
    throw new Error("params.urls is required");
  }
  return {
    urls: urls.map((url) =>
      typeof url === "string" ? { url } : url,
    ),
    count: typeof params.count === "number" ? params.count : 100,
  };
}

export function buildGoogleMapsActorInput(params: Record<string, unknown>): Record<string, unknown> {
  const searchQueries = params.searchQueries;
  const locationName = params.locationName;
  if (!Array.isArray(searchQueries) || searchQueries.length === 0) {
    throw new Error("params.searchQueries is required");
  }
  if (typeof locationName !== "string" || !locationName.trim()) {
    throw new Error("params.locationName is required");
  }
  return {
    searchQueries,
    locationName,
    language: "en",
    maxResults: typeof params.maxResults === "number" ? params.maxResults : 100,
  };
}

export function buildGoogleSearchActorInput(params: Record<string, unknown>): Record<string, unknown> {
  const query = params.query;
  if (typeof query !== "string" || !query.trim()) {
    throw new Error("params.query is required");
  }
  return {
    query,
    maxItems: typeof params.maxItems === "number" ? params.maxItems : 10,
    country: typeof params.country === "string" ? params.country : "us",
    language: "en",
    domain: "google.com",
  };
}

export function buildGoogleBusinessActorInput(params: Record<string, unknown>): Record<string, unknown> {
  const placeId = params.placeId;
  const businessName = params.businessName;
  const locationName = params.locationName;

  if (typeof placeId === "string" && placeId.trim()) {
    return buildGoogleMapsActorInput({
      searchQueries: [placeId],
      locationName: typeof locationName === "string" ? locationName : "United States",
      maxResults: 5,
    });
  }

  if (typeof businessName === "string" && businessName.trim()) {
    if (typeof locationName !== "string" || !locationName.trim()) {
      throw new Error("params.locationName is required when using businessName");
    }
    return buildGoogleMapsActorInput({
      searchQueries: [businessName],
      locationName,
      maxResults: 10,
    });
  }

  throw new Error("params.placeId or params.businessName is required");
}
