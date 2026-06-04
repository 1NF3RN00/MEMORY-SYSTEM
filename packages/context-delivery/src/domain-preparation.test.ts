import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type {
  ContextPackage,
  DomainExecutionContext,
  RetrievedMemory,
} from "@memory-middleware/shared-types";
import { DEFAULT_RELATIONSHIP_NEIGHBORHOOD_CONSTRAINT } from "@memory-middleware/shared-types";
import { prepareContextPackageForDelivery } from "./domain-preparation.js";

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

function memory(content: string): RetrievedMemory {
  return {
    memoryId: "01MEMORY",
    title: "Policy",
    memoryType: "semantic",
    version: 1,
    lineage: { ingestionTraceId: "t1", normalizationTraceId: "t2" },
    memoryScore: 1,
    chunks: [
      {
        chunkId: "01CHUNK",
        chunkIndex: 0,
        content,
        tokenCount: 10,
        finalScore: 0.9,
        rankingRank: 1,
      },
    ],
  };
}

function basePackage(memories: RetrievedMemory[]): ContextPackage {
  return {
    query: "hours",
    workspaceId: "01WORKSPACE",
    retrievalTraceId: "01TRACE",
    tokenBudget: { maxTokens: 4096, usedTokens: 10, trimmedTokens: 0 },
    retrievalMetadata: {
      retrievalLatencyMs: 1,
      retrievedChunkCount: 1,
      deduplicatedChunkCount: 1,
      finalChunkCount: 1,
    },
    memories,
    rejectedCandidates: [],
    rankingBreakdown: [],
    chunkTraces: [],
    generatedAt: new Date().toISOString(),
  };
}

describe("prepareContextPackageForDelivery", () => {
  it("replaces chunk text and records FactOverrideRecord on context package", () => {
    const executionContext: DomainExecutionContext = {
      ...baseContext,
      domainKey: "ops",
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
      instructions: [
        {
          instructionId: "01INST",
          workspaceId: "01WORKSPACE",
          domainId: "01DOMAIN",
          actionKey: "audit",
          title: "Audit mode",
          content: "Prioritize factual overrides over crawl text.",
          status: "active",
          version: 1,
          isActive: true,
          createdAt: "",
          updatedAt: "",
        },
      ],
    };

    const { contextPackage, domainMetadata, instructionSections } =
      prepareContextPackageForDelivery({
        contextPackage: basePackage([memory("Old hours: 24/7 support.")]),
        executionContext,
        metadataByChunkId: new Map([
          ["01CHUNK", { memoryMetadata: { "business-hours": "legacy" } }],
        ]),
      });

    assert.equal(contextPackage.memories[0]?.chunks[0]?.content, "Open Mon-Fri 9-5 only.");
    assert.equal(domainMetadata.factOverrides.length, 1);
    assert.equal(domainMetadata.factOverrides[0]?.factKey, "hours");
    assert.equal(contextPackage.domainMetadata?.factOverrides.length, 1);
    assert.equal(instructionSections.length, 1);
    assert.match(instructionSections[0]?.content ?? "", /factual overrides/);
  });
});
