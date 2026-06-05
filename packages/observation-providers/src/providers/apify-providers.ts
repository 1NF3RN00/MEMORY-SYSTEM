import type { ApifyClient } from "apify-client";
import type { ObservationProvider } from "@memory-middleware/shared-types";
import { APIFY_ACTORS } from "../apify/actors.js";
import { normalizeFacebookAdsObservations } from "../normalize/facebook-ads.js";
import { normalizeFacebookObservations } from "../normalize/facebook.js";
import {
  normalizeGoogleBusinessObservations,
  normalizeGoogleMapsObservations,
} from "../normalize/google-maps.js";
import { normalizeGoogleSearchObservations } from "../normalize/google-search.js";
import { normalizeInstagramObservations } from "../normalize/instagram.js";
import { normalizeTikTokObservations } from "../normalize/tiktok.js";
import {
  buildFacebookActorInput,
  buildFacebookAdsActorInput,
  buildGoogleBusinessActorInput,
  buildGoogleMapsActorInput,
  buildGoogleSearchActorInput,
  buildInstagramActorInput,
  buildTikTokActorInput,
  createApifyProvider,
} from "./apify-provider.js";

export function createApifyProviders(client: ApifyClient): ObservationProvider[] {
  return [
    createApifyProvider(client, {
      providerKey: "facebook",
      actorId: APIFY_ACTORS.facebook,
      buildActorInput: buildFacebookActorInput,
      normalizeItems: (items, input, collectedAt, params) =>
        normalizeFacebookObservations(
          items,
          input,
          collectedAt,
          typeof params.pageUrl === "string" ? params.pageUrl : "",
        ),
    }),
    createApifyProvider(client, {
      providerKey: "instagram",
      actorId: APIFY_ACTORS.instagram,
      buildActorInput: buildInstagramActorInput,
      normalizeItems: (items, input, collectedAt, params) =>
        normalizeInstagramObservations(
          items,
          input,
          collectedAt,
          typeof params.profileUrl === "string" ? params.profileUrl : "",
        ),
    }),
    createApifyProvider(client, {
      providerKey: "tiktok",
      actorId: APIFY_ACTORS.tiktok,
      buildActorInput: buildTikTokActorInput,
      normalizeItems: (items, input, collectedAt, params) => {
        const sourceLabel =
          typeof params.profileUrl === "string"
            ? params.profileUrl
            : Array.isArray(params.hashtags)
              ? params.hashtags.join(",")
              : "tiktok";
        return normalizeTikTokObservations(items, input, collectedAt, sourceLabel);
      },
    }),
    createApifyProvider(client, {
      providerKey: "facebook_ads",
      actorId: APIFY_ACTORS.facebook_ads,
      buildActorInput: buildFacebookAdsActorInput,
      normalizeItems: (items, input, collectedAt, params) => {
        const firstUrl = Array.isArray(params.urls) ? String(params.urls[0] ?? "") : "";
        return normalizeFacebookAdsObservations(items, input, collectedAt, firstUrl);
      },
    }),
    createApifyProvider(client, {
      providerKey: "google_maps",
      actorId: APIFY_ACTORS.google_maps,
      buildActorInput: buildGoogleMapsActorInput,
      normalizeItems: (items, input, collectedAt, params) => {
        const sourceLabel = `${String(params.searchQueries)} @ ${String(params.locationName)}`;
        const mapOptions: {
          subjectPlaceId?: string;
          subjectBusinessName?: string;
        } = {};
        if (typeof params.subjectPlaceId === "string") {
          mapOptions.subjectPlaceId = params.subjectPlaceId;
        }
        if (typeof params.subjectBusinessName === "string") {
          mapOptions.subjectBusinessName = params.subjectBusinessName;
        }
        return normalizeGoogleMapsObservations(
          items,
          input,
          collectedAt,
          sourceLabel,
          mapOptions,
        );
      },
    }),
    createApifyProvider(client, {
      providerKey: "google_search",
      actorId: APIFY_ACTORS.google_search,
      buildActorInput: buildGoogleSearchActorInput,
      normalizeItems: (items, input, collectedAt, params) =>
        normalizeGoogleSearchObservations(
          items,
          input,
          collectedAt,
          typeof params.query === "string" ? params.query : "",
          typeof params.targetDomain === "string" ? params.targetDomain : undefined,
        ),
    }),
    createApifyProvider(client, {
      providerKey: "google_business",
      actorId: APIFY_ACTORS.google_maps,
      buildActorInput: buildGoogleBusinessActorInput,
      normalizeItems: (items, input, collectedAt, params) => {
        const sourceLabel =
          typeof params.placeId === "string"
            ? params.placeId
            : typeof params.businessName === "string"
              ? params.businessName
              : "google_business";
        const businessOptions: {
          sourceLabel: string;
          subjectPlaceId?: string;
          subjectBusinessName?: string;
        } = { sourceLabel };
        if (typeof params.placeId === "string") {
          businessOptions.subjectPlaceId = params.placeId;
        }
        if (typeof params.businessName === "string") {
          businessOptions.subjectBusinessName = params.businessName;
        }
        return normalizeGoogleBusinessObservations(
          items,
          input,
          collectedAt,
          businessOptions,
        );
      },
    }),
  ];
}
