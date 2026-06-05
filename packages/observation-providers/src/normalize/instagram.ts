import type { CollectInput, Observation } from "@memory-middleware/shared-types";
import {
  countItemsInLastDays,
  isRecord,
  mean,
  readNumber,
  readString,
} from "../apify/field-utils.js";
import { buildProviderObservations } from "./build-observation.js";

const PROVIDER_KEY = "instagram";
const SOURCE = "apify_instagram";

function extractFollowerCount(items: unknown[]): number | null {
  for (const item of items) {
    const direct = readNumber(item, ["followersCount", "followers", "followerCount"]);
    if (direct !== null) return direct;

    if (isRecord(item) && isRecord(item.owner)) {
      const ownerFollowers = readNumber(item.owner, ["followersCount", "followers"]);
      if (ownerFollowers !== null) return ownerFollowers;
    }

    if (isRecord(item) && isRecord(item.parentData)) {
      const parentFollowers = readNumber(item.parentData, ["followersCount", "followers"]);
      if (parentFollowers !== null) return parentFollowers;
    }
  }
  return null;
}

function extractPostMetrics(items: unknown[], followerCount: number | null): {
  postsPerMonth: number;
  averageLikes: number;
  engagementRate: number;
} {
  const likes: number[] = [];
  const comments: number[] = [];

  for (const item of items) {
    if (!isRecord(item)) continue;
    const type = readString(item, ["type", "postType"]);
    if (type && !/post|image|video|carousel/i.test(type)) continue;

    const likeValue = readNumber(item, ["likesCount", "likes", "likeCount"]);
    if (likeValue !== null) likes.push(likeValue);

    const commentValue = readNumber(item, ["commentsCount", "comments", "commentCount"]);
    if (commentValue !== null) comments.push(commentValue);
  }

  const postsPerMonth = countItemsInLastDays(
    items,
    ["timestamp", "takenAt", "createdAt", "date", "time"],
    30,
  );
  const averageLikes = Math.round(mean(likes));
  const averageComments = Math.round(mean(comments));
  const engagementRate =
    followerCount && followerCount > 0
      ? Math.min(1, (averageLikes + averageComments) / followerCount)
      : 0;

  return { postsPerMonth, averageLikes, engagementRate };
}

export function normalizeInstagramObservations(
  items: unknown[],
  input: CollectInput,
  collectedAt: string,
  profileUrl: string,
): Observation[] {
  const followerCount = extractFollowerCount(items);
  const postMetrics = extractPostMetrics(items, followerCount);
  const drafts = [];

  if (followerCount !== null) {
    drafts.push({
      category: "presence",
      metric: "follower_count",
      value: followerCount,
      sourceLabel: profileUrl,
      platform: "instagram",
    });
  }

  drafts.push(
    {
      category: "activity",
      metric: "posts_per_month",
      value: postMetrics.postsPerMonth,
      sourceLabel: profileUrl,
      platform: "instagram",
    },
    {
      category: "engagement",
      metric: "average_likes",
      value: postMetrics.averageLikes,
      sourceLabel: profileUrl,
      platform: "instagram",
    },
    {
      category: "engagement",
      metric: "engagement_rate",
      value: postMetrics.engagementRate,
      sourceLabel: profileUrl,
      platform: "instagram",
    },
  );

  return buildProviderObservations(input, PROVIDER_KEY, SOURCE, drafts, collectedAt);
}
