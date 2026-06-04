import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { DomainExecutionContext, RetrievedMemory } from "@memory-middleware/shared-types";
import { DEFAULT_RELATIONSHIP_NEIGHBORHOOD_CONSTRAINT } from "@memory-middleware/shared-types";
import { applyFactOverridesToMemories } from "./fact-precedence.js";

const baseContext: DomainExecutionContext = {
  workspaceId: "01WORKSPACE",
  globalFacts: [],
  domainFacts: [],
  instructions: [],
  retrievalRules: [],
  metadataFilters: [],
  relationshipConstraints: DEFAULT_RELATIONSHIP_NEIGHBORHOOD_CONSTRAINT,
  resolvedAt: new Date().toISOString(),
};

function memory(content: string, chunkId = "01CHUNK"): RetrievedMemory {
  return {
    memoryId: "01MEMORY",
    title: "Test",
    memoryType: "semantic",
    version: 1,
    lineage: { ingestionTraceId: "t1", normalizationTraceId: "t2" },
    memoryScore: 1,
    chunks: [
      {
        chunkId,
        chunkIndex: 0,
        content,
        tokenCount: 10,
        finalScore: 0.9,
        rankingRank: 1,
      },
    ],
  };
}

describe("applyFactOverridesToMemories", () => {
  it("replaces chunk when global fact metadata keys match", () => {
    const context: DomainExecutionContext = {
      ...baseContext,
      globalFacts: [
        {
          factId: "01FACT",
          workspaceId: "01WORKSPACE",
          scope: "global",
          key: "hours",
          title: "Hours",
          content: "Open Mon-Fri 9-5 only.",
          priority: 0,
          status: "active",
          appliesToMetadataKeys: ["business-hours"],
          version: 1,
          createdAt: "",
          updatedAt: "",
        },
      ],
    };

    const { memories, overrides } = applyFactOverridesToMemories({
      memories: [memory("Old hours: 24/7 support.")],
      context,
      metadataByChunkId: new Map([
        [
          "01CHUNK",
          {
            memoryMetadata: { "business-hours": "legacy" },
          },
        ],
      ]),
    });

    assert.equal(memories[0]?.chunks[0]?.content, "Open Mon-Fri 9-5 only.");
    assert.equal(overrides.length, 1);
    assert.equal(overrides[0]?.precedenceRank, 1);
    assert.match(overrides[0]?.reason ?? "", /metadata key match/);
  });

  it("domain fact applies before global fact overrides", () => {
    const context: DomainExecutionContext = {
      ...baseContext,
      domainFacts: [
        {
          factId: "02FACT",
          workspaceId: "01WORKSPACE",
          scope: "domain",
          domainId: "01DOMAIN",
          key: "area",
          title: "Area",
          content: "Domain: North Haven.",
          priority: 0,
          status: "active",
          appliesToMetadataKeys: ["service-area"],
          version: 1,
          createdAt: "",
          updatedAt: "",
        },
      ],
      globalFacts: [
        {
          factId: "01FACT",
          workspaceId: "01WORKSPACE",
          scope: "global",
          key: "area-global",
          title: "Area Global",
          content: "Global: All Connecticut.",
          priority: 0,
          status: "active",
          appliesToMetadataKeys: ["service-area"],
          version: 1,
          createdAt: "",
          updatedAt: "",
        },
      ],
    };

    const { memories, overrides } = applyFactOverridesToMemories({
      memories: [memory("Service area details here.")],
      context,
      metadataByChunkId: new Map([
        ["01CHUNK", { memoryMetadata: { "service-area": "x" } }],
      ]),
    });

    assert.equal(memories[0]?.chunks[0]?.content, "Global: All Connecticut.");
    assert.equal(overrides.length, 2);
    assert.equal(overrides[overrides.length - 1]?.replacementText, "Global: All Connecticut.");
  });
});
