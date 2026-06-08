import { recordLlmCall } from "@memory-middleware/observability";
import {
  EMBEDDING_MODEL_V1,
  EMBEDDING_VERSION_V1,
  type CanonicalMemoryChunk,
  type ChunkRetrievalSurface,
} from "@memory-middleware/shared-types";
import { buildEnrichedEmbeddingText } from "@memory-middleware/structural";

export interface EmbeddingClient {
  embed(texts: string[]): Promise<number[][]>;
}

export interface EmbeddingResult {
  chunks: CanonicalMemoryChunk[];
  embeddingLatencyMs: number;
  failed: boolean;
  error?: string;
}

export function createOpenAiEmbeddingClient(apiKey: string): EmbeddingClient {
  return {
    async embed(texts: string[]): Promise<number[][]> {
      const started = Date.now();
      const response = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: EMBEDDING_MODEL_V1,
          input: texts,
        }),
        signal: AbortSignal.timeout(60_000),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`OpenAI embeddings failed: ${response.status} ${body}`);
      }

      const data = (await response.json()) as {
        data: Array<{ embedding: number[]; index: number }>;
        usage?: { prompt_tokens?: number; total_tokens?: number };
      };

      recordLlmCall({
        operation: "embedding",
        model: EMBEDDING_MODEL_V1,
        promptTokens: data.usage?.prompt_tokens ?? data.usage?.total_tokens ?? 0,
        completionTokens: 0,
        latencyMs: Date.now() - started,
      });

      const sorted = [...data.data].sort((a, b) => a.index - b.index);
      return sorted.map((item) => item.embedding);
    },
  };
}

export async function embedChunks(
  chunks: CanonicalMemoryChunk[],
  client: EmbeddingClient | null,
): Promise<EmbeddingResult> {
  const started = Date.now();

  if (!client || chunks.length === 0) {
    const result: EmbeddingResult = {
      chunks: chunks.map((c) => ({ ...c, embeddingStatus: "failed" as const })),
      embeddingLatencyMs: Date.now() - started,
      failed: true,
    };
    if (!client) {
      result.error = "Embedding client not configured";
    }
    return result;
  }

  try {
    const texts = chunks.map((chunk) => {
      const surface = chunk.metadata.retrievalSurface as ChunkRetrievalSurface | undefined;
      return surface ? buildEnrichedEmbeddingText(chunk.content, surface) : chunk.content;
    });
    const vectors = await client.embed(texts);
    const updated: CanonicalMemoryChunk[] = chunks.map((chunk, i) => {
      const vector = vectors[i];
      return {
        ...chunk,
        ...(vector ? { embedding: vector } : {}),
        embeddingStatus: "completed" as const,
        observability: {
          ...chunk.observability,
          embeddingLatencyMs: Date.now() - started,
        },
      };
    });

    return {
      chunks: updated,
      embeddingLatencyMs: Date.now() - started,
      failed: false,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      chunks: chunks.map((c) => ({ ...c, embeddingStatus: "failed" as const })),
      embeddingLatencyMs: Date.now() - started,
      failed: true,
      error: message,
    };
  }
}

export { EMBEDDING_MODEL_V1, EMBEDDING_VERSION_V1 };
