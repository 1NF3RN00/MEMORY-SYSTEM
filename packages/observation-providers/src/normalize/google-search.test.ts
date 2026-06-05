import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bootstrapDefaultRegistry } from "@memory-middleware/observation-registry";
import { normalizeGoogleSearchObservations } from "./google-search.js";

describe("normalizeGoogleSearchObservations", () => {
  it("maps SERP items to search visibility metrics", () => {
    bootstrapDefaultRegistry();

    const items = [
      { position: 1, url: "https://example.com", title: "Example" },
      { position: 4, url: "https://competitor.com", title: "Competitor" },
      { position: 9, url: "https://other.com", title: "Other" },
    ];

    const observations = normalizeGoogleSearchObservations(
      items,
      {
        workspaceId: "01HXYZ00000000000000000000",
        traceId: "01HXYZ00000000000000000001",
        params: { query: "plumber austin" },
      },
      "2026-06-05T12:00:00.000Z",
      "plumber austin",
      "example.com",
    );

    const keywordRank = observations.find((observation) => observation.metric === "keyword_rank");
    assert.equal(keywordRank?.value, 1);

    const top10 = observations.find((observation) => observation.metric === "top10_keywords");
    assert.equal(top10?.value, 3);
  });
});
