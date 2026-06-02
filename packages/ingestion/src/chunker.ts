import {
  DEFAULT_CHUNK_CONFIG,
  type CanonicalMemoryChunk,
} from "@memory-middleware/shared-types";
import { estimateTokens } from "./token-estimator.js";

export interface ChunkerConfig {
  maxTokens: number;
  overlapTokens: number;
  chunkingStrategy: string;
}

export interface ChunkInput {
  memoryId: string;
  normalizedContent: string;
  config?: Partial<ChunkerConfig>;
}

const DEFAULT_CONFIG: ChunkerConfig = {
  maxTokens: DEFAULT_CHUNK_CONFIG.maxTokens,
  overlapTokens: DEFAULT_CHUNK_CONFIG.overlapTokens,
  chunkingStrategy: DEFAULT_CHUNK_CONFIG.chunkingStrategy,
};

/** Map token budget to character budget (inverse of estimateTokens). */
function tokensToChars(tokens: number): number {
  return tokens * 4;
}

/**
 * Deterministic fixed-size chunking with configurable overlap.
 * Splits on character boundaries derived from token targets for reproducibility.
 */
export function deterministicChunk(input: ChunkInput): CanonicalMemoryChunk[] {
  const config = { ...DEFAULT_CONFIG, ...input.config };
  const text = input.normalizedContent.trim();
  if (text.length === 0) {
    return [];
  }

  const maxChars = tokensToChars(config.maxTokens);
  const overlapChars = tokensToChars(config.overlapTokens);
  const step = Math.max(1, maxChars - overlapChars);

  const chunks: CanonicalMemoryChunk[] = [];
  let offset = 0;
  let index = 0;
  const now = new Date().toISOString();

  while (offset < text.length) {
    const end = Math.min(offset + maxChars, text.length);
    const content = text.slice(offset, end);
    const hasNext = end < text.length;

    chunks.push({
      id: "",
      memoryId: input.memoryId,
      chunkIndex: index,
      content,
      tokenCount: estimateTokens(content),
      embeddingStatus: "pending",
      metadata: {
        chunkingStrategy: config.chunkingStrategy,
        ...(index > 0 ? { overlapPrevious: true } : {}),
        ...(hasNext ? { overlapNext: true } : {}),
      },
      observability: { retrievalCount: 0 },
      createdAt: now,
    });

    if (!hasNext) break;
    offset += step;
    index += 1;
  }

  return chunks;
}
