-- Sprint 2: pgvector index for chunk similarity search (HNSW works on empty tables)

CREATE INDEX IF NOT EXISTS "memory_chunks_embedding_hnsw_idx"
  ON "memory_chunks"
  USING hnsw ("embedding" vector_cosine_ops);
