import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { scoreBm25Documents, tokenizeForBm25 } from "./bm25-score.js";

describe("bm25-score", () => {
  it("tokenizes deterministically", () => {
    assert.deepEqual(tokenizeForBm25("Enterprise Pricing Policy!"), [
      "enterprise",
      "pricing",
      "policy",
    ]);
  });

  it("ranks documents with higher term overlap above others", () => {
    const scored = scoreBm25Documents(
      ["pricing", "enterprise"],
      [
        { id: "a", text: "unrelated infrastructure runbook" },
        { id: "b", text: "enterprise pricing policy for customers" },
        { id: "c", text: "enterprise onboarding checklist" },
      ],
    );

    assert.equal(scored[0]?.id, "b");
    assert.ok(scored[0]!.score > (scored[1]?.score ?? 0));
  });

  it("sorts ties by document id", () => {
    const scored = scoreBm25Documents(["alpha"], [
      { id: "chunk-z", text: "alpha" },
      { id: "chunk-a", text: "alpha" },
    ]);

    assert.deepEqual(
      scored.map((entry) => entry.id),
      ["chunk-a", "chunk-z"],
    );
  });
});
