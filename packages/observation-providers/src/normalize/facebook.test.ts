import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bootstrapDefaultRegistry } from "@memory-middleware/observation-registry";
import { normalizeFacebookObservations } from "./facebook.js";

describe("normalizeFacebookObservations", () => {
  it("maps Apify items to facebook metrics", () => {
    bootstrapDefaultRegistry();

    const items = [
      { followers: 1200, type: "page" },
      {
        type: "post",
        time: new Date().toISOString(),
        reactions: 10,
        comments: 2,
      },
      {
        type: "post",
        time: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        reactions: 20,
        comments: 4,
      },
    ];

    const observations = normalizeFacebookObservations(
      items,
      {
        workspaceId: "01HXYZ00000000000000000000",
        traceId: "01HXYZ00000000000000000001",
        params: { pageUrl: "https://facebook.com/example" },
      },
      "2026-06-05T12:00:00.000Z",
      "https://facebook.com/example",
    );

    const follower = observations.find((observation) => observation.metric === "follower_count");
    assert.equal(follower?.value, 1200);

    const reactions = observations.find(
      (observation) => observation.metric === "average_post_reactions",
    );
    assert.equal(reactions?.value, 15);
  });
});
