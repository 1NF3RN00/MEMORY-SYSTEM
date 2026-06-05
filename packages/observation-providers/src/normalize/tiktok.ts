import type { CollectInput, Observation } from "@memory-middleware/shared-types";
import {
  countItemsInLastDays,
  isRecord,
  mean,
  readNumber,
  readString,
} from "../apify/field-utils.js";
import { buildProviderObservations } from "./build-observation.js";

const PROVIDER_KEY = "tiktok";
const SOURCE = "apify_tiktok";

function extractFollowerCount(items: unknown[]): number | null {
  for (const item of items) {
    const direct = readNumber(item, ["followerCount", "followers", "fans"]);
    if (direct !== null) return direct;

    if (isRecord(item) && isRecord(item.authorMeta)) {
      const authorFollowers = readNumber(item.authorMeta, ["fans", "followerCount", "followers"]);
      if (authorFollowers !== null) return authorFollowers;
    }
  }
  return null;
}

function extractVideoMetrics(items: unknown[]): {
  postsPerMonth: number;
  averageViews: number;
  averageLikes: number;
  engagementRate: number;
} {
  const views: number[] = [];
  const likes: number[] = [];
  const comments: number[] = [];
  const shares: number[] = [];

  for (const item of items) {
    if (!isRecord(item)) continue;
    const type = readString(item, ["type"]);
    if (type && !/video/i.test(type) && readNumber(item, ["playCount", "views"]) === null) {
      continue;
    }

    const viewValue = readNumber(item, ["playCount", "views", "viewCount"]);
    if (viewValue !== null) views.push(viewValue);

    const likeValue = readNumber(item, ["diggCount", "likes", "likeCount"]);
    if (likeValue !== null) likes.push(likeValue);

    const commentValue = readNumber(item, ["commentCount", "comments"]);
    if (commentValue !== null) comments.push(commentValue);

    const shareValue = readNumber(item, ["shareCount", "shares"]);
    if (shareValue !== null) shares.push(shareValue);
  }

  const postsPerMonth = countItemsInLastDays(
    items,
    ["createTime", "createTimeISO", "timestamp", "createdAt"],
    30,
  );
  const averageViews = Math.round(mean(views));
  const averageLikes = Math.round(mean(likes));
  const averageComments = Math.round(mean(comments));
  const averageShares = Math.round(mean(shares));
  const engagementRate =
    averageViews > 0
      ? Math.min(1, (averageLikes + averageComments + averageShares) / averageViews)
      : 0;

  return { postsPerMonth, averageViews, averageLikes, engagementRate };
}

export function normalizeTikTokObservations(
  items: unknown[],
  input: CollectInput,
  collectedAt: string,
  sourceLabel: string,
): Observation[] {
  const followerCount = extractFollowerCount(items);
  const videoMetrics = extractVideoMetrics(items);
  const drafts = [];

  if (followerCount !== null) {
    drafts.push({
      category: "presence",
      metric: "follower_count",
      value: followerCount,
      sourceLabel,
      platform: "tiktok",
    });
  }

  drafts.push(
    {
      category: "activity",
      metric: "posts_per_month",
      value: videoMetrics.postsPerMonth,
      sourceLabel,
      platform: "tiktok",
    },
    {
      category: "engagement",
      metric: "average_views",
      value: videoMetrics.averageViews,
      sourceLabel,
      platform: "tiktok",
    },
    {
      category: "engagement",
      metric: "average_likes",
      value: videoMetrics.averageLikes,
      sourceLabel,
      platform: "tiktok",
    },
    {
      category: "engagement",
      metric: "engagement_rate",
      value: videoMetrics.engagementRate,
      sourceLabel,
      platform: "tiktok",
    },
  );

  return buildProviderObservations(input, PROVIDER_KEY, SOURCE, drafts, collectedAt);
}
