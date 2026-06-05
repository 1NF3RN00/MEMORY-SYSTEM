import type { CollectInput, Observation } from "@memory-middleware/shared-types";
import {
  countItemsInLastDays,
  isRecord,
  mean,
  readNumber,
  readString,
} from "../apify/field-utils.js";
import { buildProviderObservations } from "./build-observation.js";

const PROVIDER_KEY = "facebook";
const SOURCE = "apify_facebook";

function extractFollowerCount(items: unknown[]): number | null {
  for (const item of items) {
    const value = readNumber(item, [
      "followers",
      "followersCount",
      "fanCount",
      "likes",
      "pageFollowers",
    ]);
    if (value !== null) return value;
  }
  return null;
}

function extractPostMetrics(items: unknown[]): {
  postsPerMonth: number;
  averageReactions: number;
  averageComments: number;
} {
  const reactions: number[] = [];
  const comments: number[] = [];

  for (const item of items) {
    if (!isRecord(item)) continue;
    const type = readString(item, ["type", "postType"]);
    if (type && !/post/i.test(type)) continue;

    const reactionValue = readNumber(item, [
      "reactions",
      "reactionsCount",
      "likes",
      "likesCount",
      "reactionCount",
    ]);
    if (reactionValue !== null) reactions.push(reactionValue);

    const commentValue = readNumber(item, ["comments", "commentsCount", "commentCount"]);
    if (commentValue !== null) comments.push(commentValue);
  }

  const postsPerMonth = countItemsInLastDays(
    items,
    ["time", "timestamp", "createdAt", "date", "publishedAt"],
    30,
  );

  return {
    postsPerMonth,
    averageReactions: Math.round(mean(reactions)),
    averageComments: Math.round(mean(comments)),
  };
}

export function normalizeFacebookObservations(
  items: unknown[],
  input: CollectInput,
  collectedAt: string,
  pageUrl: string,
): Observation[] {
  const followerCount = extractFollowerCount(items);
  const postMetrics = extractPostMetrics(items);
  const drafts = [];

  if (followerCount !== null) {
    drafts.push({
      category: "presence",
      metric: "follower_count",
      value: followerCount,
      sourceLabel: pageUrl,
      platform: "facebook",
    });
  }

  drafts.push(
    {
      category: "activity",
      metric: "posts_per_month",
      value: postMetrics.postsPerMonth,
      sourceLabel: pageUrl,
      platform: "facebook",
    },
    {
      category: "engagement",
      metric: "average_post_reactions",
      value: postMetrics.averageReactions,
      sourceLabel: pageUrl,
      platform: "facebook",
    },
    {
      category: "engagement",
      metric: "average_post_comments",
      value: postMetrics.averageComments,
      sourceLabel: pageUrl,
      platform: "facebook",
    },
  );

  return buildProviderObservations(input, PROVIDER_KEY, SOURCE, drafts, collectedAt);
}
