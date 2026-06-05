import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyObservationFilters,
  matchesObservationFilter,
} from "./observation-retrieval.js";

const sample = {
  observationId: "01HXYZ00000000000000000000",
  provider: "website",
  category: "site_structure",
  metric: "page_count",
  value: 12,
  source: "website_crawl",
  timestamp: "2026-06-05T12:00:00.000Z",
  collectedAt: "2026-06-05T12:00:00.000Z",
};

describe("observation retrieval filters", () => {
  it("matches provider filter", () => {
    assert.equal(
      matchesObservationFilter(sample, { providers: ["website"] }),
      true,
    );
    assert.equal(
      matchesObservationFilter(sample, { providers: ["facebook"] }),
      false,
    );
  });

  it("returns empty when filters are empty", () => {
    assert.deepEqual(applyObservationFilters([sample], []), []);
  });

  it("dedupes by observationId", () => {
    const result = applyObservationFilters(
      [sample, { ...sample }],
      [{ providers: ["website"] }],
    );
    assert.equal(result.length, 1);
  });
});
