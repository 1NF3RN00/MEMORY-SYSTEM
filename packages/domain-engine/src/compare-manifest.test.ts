import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { PackageManifest } from "@memory-middleware/shared-types";
import { DEFAULT_RELATIONSHIP_NEIGHBORHOOD_CONSTRAINT } from "@memory-middleware/shared-types";
import { comparePackageManifests } from "./compare-manifest.js";

const base: PackageManifest = {
  packageKey: "ops-pack",
  name: "Operations Pack",
  version: "1.0.0",
  domains: [
    {
      domainKey: "seo",
      name: "SEO",
      metadataFilters: ["seo"],
      relationshipConstraints: DEFAULT_RELATIONSHIP_NEIGHBORHOOD_CONSTRAINT,
      retrievalRules: [],
      facts: [{ scope: "domain", key: "kw", title: "KW", content: "hvac", priority: 0, status: "active" }],
      instructions: [
        { actionKey: "audit", title: "Audit", content: "Run audit.", status: "active" },
      ],
    },
  ],
  globalFacts: [
    { scope: "global", key: "hours", title: "Hours", content: "9-5", priority: 0, status: "active" },
  ],
};

describe("comparePackageManifests", () => {
  it("detects added domain and changed global fact", () => {
    const candidate: PackageManifest = {
      ...base,
      version: "1.1.0",
      globalFacts: [
        {
          scope: "global",
          key: "hours",
          title: "Hours",
          content: "Mon-Fri 9-5",
          priority: 0,
          status: "active",
        },
      ],
      domains: [
        ...base.domains,
        {
          domainKey: "inbox",
          name: "Inbox",
          metadataFilters: [],
          relationshipConstraints: DEFAULT_RELATIONSHIP_NEIGHBORHOOD_CONSTRAINT,
          retrievalRules: [],
        },
      ],
    };

    const diff = comparePackageManifests(base, candidate);
    assert.equal(diff.versionChanged?.to, "1.1.0");
    assert.deepEqual(diff.globalFacts.changed, ["hours"]);
    assert.deepEqual(diff.domains.added, ["inbox"]);
    assert.equal(diff.domains.changed.length, 0);
    assert.deepEqual(diff.workflows.added, []);
    assert.deepEqual(diff.workflows.removed, []);
    assert.deepEqual(diff.workflows.changed, []);
  });

  it("detects added workflows", () => {
    const candidate: PackageManifest = {
      ...base,
      workflows: [
        {
          workflowKey: "seo-audit",
          name: "SEO Audit",
          domains: ["seo"],
          outputTypes: ["report"],
          analysisSpecKey: "seo_audit_v1",
        },
      ],
    };

    const diff = comparePackageManifests(base, candidate);
    assert.deepEqual(diff.workflows.added, ["seo-audit"]);
  });
});
