import type {
  DomainExecutionContext,
  Fact,
  FactOverrideRecord,
  FactScope,
  RetrievedMemory,
} from "@memory-middleware/shared-types";

export interface ChunkMetadataLookup {
  memoryMetadata?: Record<string, unknown>;
  chunkMetadata?: Record<string, unknown>;
}

export interface ApplyFactOverridesInput {
  memories: RetrievedMemory[];
  context: DomainExecutionContext;
  metadataByChunkId?: Map<string, ChunkMetadataLookup>;
}

export interface ApplyFactOverridesResult {
  memories: RetrievedMemory[];
  overrides: FactOverrideRecord[];
}

interface RankedFact {
  fact: Fact;
  precedenceRank: number;
}

function scopeRank(scope: FactScope): number {
  return scope === "global" ? 1 : 2;
}

function sortFactsForApplication(facts: Fact[]): RankedFact[] {
  return facts
    .filter((f) => f.status === "active")
    .map((fact) => ({ fact, precedenceRank: scopeRank(fact.scope) }))
    .sort((a, b) => {
      if (b.precedenceRank !== a.precedenceRank) {
        return b.precedenceRank - a.precedenceRank;
      }
      return a.fact.priority - b.fact.priority;
    });
}

function metadataKeysMatch(
  keys: string[] | undefined,
  memoryMeta: Record<string, unknown>,
  chunkMeta: Record<string, unknown>,
): boolean {
  if (!keys?.length) return false;
  const merged = { ...memoryMeta, ...chunkMeta };
  return keys.every((key) => key in merged && merged[key] != null && merged[key] !== "");
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 4);
}

function hasContentOverlap(chunkContent: string, factContent: string): boolean {
  const normalizedChunk = chunkContent.toLowerCase();
  const normalizedFact = factContent.toLowerCase().trim();
  if (!normalizedFact) return false;
  if (normalizedChunk.includes(normalizedFact)) return true;
  const factTokens = tokenize(factContent);
  if (factTokens.length === 0) return false;
  return factTokens.some((token) => normalizedChunk.includes(token));
}

function shouldReplaceChunk(
  fact: Fact,
  chunkContent: string,
  memoryMeta: Record<string, unknown>,
  chunkMeta: Record<string, unknown>,
): boolean {
  if (metadataKeysMatch(fact.appliesToMetadataKeys, memoryMeta, chunkMeta)) {
    return true;
  }
  return hasContentOverlap(chunkContent, fact.content);
}

export function applyFactOverridesToMemories(
  input: ApplyFactOverridesInput,
): ApplyFactOverridesResult {
  const ranked = sortFactsForApplication([
    ...input.context.globalFacts,
    ...input.context.domainFacts,
  ]);

  const overrides: FactOverrideRecord[] = [];
  const memories = input.memories.map((memory) => ({
    ...memory,
    chunks: memory.chunks.map((chunk) => ({ ...chunk })),
  }));

  for (const memory of memories) {
    for (const chunk of memory.chunks) {
      const lookup = input.metadataByChunkId?.get(chunk.chunkId);
      const memoryMeta = lookup?.memoryMetadata ?? {};
      const chunkMeta = lookup?.chunkMetadata ?? {};

      for (const { fact, precedenceRank } of ranked) {
        if (!shouldReplaceChunk(fact, chunk.content, memoryMeta, chunkMeta)) {
          continue;
        }

        const originalExcerpt = chunk.content;
        if (originalExcerpt === fact.content) continue;

        overrides.push({
          factId: fact.factId,
          factScope: fact.scope,
          factKey: fact.key,
          memoryId: memory.memoryId,
          chunkId: chunk.chunkId,
          originalExcerpt,
          replacementText: fact.content,
          precedenceRank,
          reason: buildOverrideReason(fact, precedenceRank, memoryMeta, chunkMeta),
        });

        chunk.content = fact.content;
      }
    }
  }

  return { memories, overrides };
}

function buildOverrideReason(
  fact: Fact,
  precedenceRank: number,
  memoryMeta: Record<string, unknown>,
  chunkMeta: Record<string, unknown>,
): string {
  const scopeLabel = fact.scope === "global" ? "global fact" : "domain fact";
  if (metadataKeysMatch(fact.appliesToMetadataKeys, memoryMeta, chunkMeta)) {
    return `${scopeLabel} "${fact.key}" replaced chunk text via metadata key match (precedence ${precedenceRank})`;
  }
  return `${scopeLabel} "${fact.key}" replaced conflicting chunk text (precedence ${precedenceRank})`;
}
