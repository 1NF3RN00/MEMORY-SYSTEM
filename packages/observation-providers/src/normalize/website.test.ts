import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bootstrapDefaultRegistry } from "@memory-middleware/observation-registry";
import type { SiteCrawlResult } from "../crawl-site.js";
import { normalizeWebsiteObservations } from "./website.js";

describe("normalizeWebsiteObservations", () => {
  it("maps crawl metrics to registry-backed observations", () => {
    bootstrapDefaultRegistry();

    const crawl: SiteCrawlResult = {
      baseUrl: "https://example.com",
      collectedAt: "2026-06-05T12:00:00.000Z",
      schemaPresent: true,
      robotsTxtPresent: true,
      sitemapPresent: false,
      pages: [
        {
          url: "https://example.com",
          title: "Home",
          h1: "Welcome",
          wordCount: 120,
          internalLinkCount: 3,
        },
        {
          url: "https://example.com/services",
          title: "Services",
          h1: "Our Services",
          wordCount: 240,
          internalLinkCount: 2,
        },
      ],
    };

    const observations = normalizeWebsiteObservations(crawl, {
      workspaceId: "01HXYZ00000000000000000000",
      traceId: "01HXYZ00000000000000000001",
      params: { url: "https://example.com" },
    });

    const metrics = new Set(observations.map((observation) => observation.metric));
    assert.ok(metrics.has("page_count"));
    assert.ok(metrics.has("service_page_count"));
    assert.ok(metrics.has("schema_present"));

    const pageCount = observations.find((observation) => observation.metric === "page_count");
    assert.equal(pageCount?.value, 2);
    assert.equal(pageCount?.metadata.provider, "website");
  });
});
