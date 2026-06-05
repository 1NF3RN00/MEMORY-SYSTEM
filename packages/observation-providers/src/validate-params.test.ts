import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bootstrapDefaultRegistry, listProviders } from "@memory-middleware/observation-registry";
import { validateCollectionParams } from "./validate-params.js";

describe("validateCollectionParams", () => {
  it("requires url for website provider", () => {
    bootstrapDefaultRegistry();
    const website = listProviders().find((provider) => provider.providerKey === "website");
    assert.ok(website);

    const errors = validateCollectionParams(website, {});
    assert.ok(errors.some((error) => error.includes("params.url")));
  });
});
