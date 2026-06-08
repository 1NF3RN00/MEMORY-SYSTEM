import type { EmbeddingClient } from "@memory-middleware/ingestion";
import { EMBEDDING_MODEL_V1 } from "@memory-middleware/ingestion";

/**
 * Query embedding cache — invalidation policy:
 *
 * 1. **TTL expiry** (default 1 hour): entries are dropped on read after `ttlMs`.
 * 2. **LRU eviction**: when `maxEntries` is exceeded, the least-recently-used key is removed.
 * 3. **Model version in key**: a change to `EMBEDDING_MODEL_V1` produces new keys (automatic miss).
 * 4. **Workspace isolation**: every key is scoped to `workspaceId`.
 * 5. **Enrichment isolation**: keys include the full deterministic embedding input text so
 *    retrieval-plan expansion/decomposition cannot collide with the default path.
 *
 * Corpus or memory updates do **not** invalidate query embeddings — cached vectors are for the
 * query text only, not stored chunk embeddings.
 */

export interface QueryEmbeddingCacheOptions {
  /** Maximum entries before LRU eviction. Default 500. */
  maxEntries?: number;
  /** Entry lifetime in milliseconds. Default 3_600_000 (1 hour). */
  ttlMs?: number;
}

export interface QueryEmbeddingCacheResult {
  embedding: number[];
  cacheHit: boolean;
}

interface CacheEntry {
  embedding: number[];
  expiresAt: number;
}

export class QueryEmbeddingCache {
  private readonly maxEntries: number;
  private readonly ttlMs: number;
  private readonly store = new Map<string, CacheEntry>();

  constructor(options?: QueryEmbeddingCacheOptions) {
    this.maxEntries = options?.maxEntries ?? 500;
    this.ttlMs = options?.ttlMs ?? 60 * 60 * 1000;
  }

  get(key: string): number[] | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.embedding;
  }

  set(key: string, embedding: number[]): void {
    if (this.store.has(key)) {
      this.store.delete(key);
    } else if (this.store.size >= this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) {
        this.store.delete(oldest);
      }
    }
    this.store.set(key, {
      embedding,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  clear(): void {
    this.store.clear();
  }

  size(): number {
    return this.store.size;
  }
}

let defaultCache: QueryEmbeddingCache | undefined;

export function getDefaultQueryEmbeddingCache(): QueryEmbeddingCache {
  if (!defaultCache) {
    defaultCache = new QueryEmbeddingCache();
  }
  return defaultCache;
}

/** Reset the process-wide default cache (tests only). */
export function resetDefaultQueryEmbeddingCache(): void {
  defaultCache = undefined;
}

/**
 * Cache key: workspaceId + normalized query + embedding model + enrichment text.
 * `embeddingInput` is the exact string passed to the embed API (enriched normalized query).
 */
export function buildQueryEmbeddingCacheKey(
  workspaceId: string,
  normalizedQuery: string,
  embeddingInput: string,
): string {
  return `${workspaceId}\0${EMBEDDING_MODEL_V1}\0${normalizedQuery}\0${embeddingInput}`;
}

export async function resolveQueryEmbedding(input: {
  workspaceId: string;
  normalizedQuery: string;
  embeddingInput: string;
  client: EmbeddingClient;
  cache?: QueryEmbeddingCache;
}): Promise<QueryEmbeddingCacheResult> {
  const cache = input.cache ?? getDefaultQueryEmbeddingCache();
  const cacheKey = buildQueryEmbeddingCacheKey(
    input.workspaceId,
    input.normalizedQuery,
    input.embeddingInput,
  );

  const cached = cache.get(cacheKey);
  if (cached) {
    return { embedding: cached, cacheHit: true };
  }

  const vectors = await input.client.embed([input.embeddingInput]);
  const embedding = vectors[0] ?? [];
  if (embedding.length === 0) {
    throw new Error("Empty query embedding returned");
  }

  cache.set(cacheKey, embedding);
  return { embedding, cacheHit: false };
}
