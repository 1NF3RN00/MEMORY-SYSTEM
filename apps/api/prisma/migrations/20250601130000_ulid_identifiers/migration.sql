-- Sprint 1: migrate memory/ingestion identifiers from UUID to ULID (TEXT)

-- Drop FKs referencing memory UUID columns
ALTER TABLE "memory_chunks" DROP CONSTRAINT "memory_chunks_memory_id_fkey";

ALTER TABLE "memories" DROP CONSTRAINT "memories_workspace_id_fkey";

-- memories
ALTER TABLE "memories" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "memories" ALTER COLUMN "id" SET DATA TYPE TEXT USING "id"::text;
ALTER TABLE "memories" ALTER COLUMN "lineage_id" SET DATA TYPE TEXT USING "lineage_id"::text;
ALTER TABLE "memories" ALTER COLUMN "parent_memory_id" SET DATA TYPE TEXT USING "parent_memory_id"::text;

-- memory_chunks
ALTER TABLE "memory_chunks" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "memory_chunks" ALTER COLUMN "id" SET DATA TYPE TEXT USING "id"::text;
ALTER TABLE "memory_chunks" ALTER COLUMN "memory_id" SET DATA TYPE TEXT USING "memory_id"::text;

-- ingestion_jobs
ALTER TABLE "ingestion_jobs" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "ingestion_jobs" ALTER COLUMN "id" SET DATA TYPE TEXT USING "id"::text;
ALTER TABLE "ingestion_jobs" ALTER COLUMN "memory_id" SET DATA TYPE TEXT USING "memory_id"::text;
ALTER TABLE "ingestion_jobs" ALTER COLUMN "lineage_id" SET DATA TYPE TEXT USING "lineage_id"::text;

-- ingestion_traces
ALTER TABLE "ingestion_traces" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "ingestion_traces" ALTER COLUMN "id" SET DATA TYPE TEXT USING "id"::text;
ALTER TABLE "ingestion_traces" ALTER COLUMN "memory_id" SET DATA TYPE TEXT USING "memory_id"::text;

-- source_truths
ALTER TABLE "source_truths" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "source_truths" ALTER COLUMN "id" SET DATA TYPE TEXT USING "id"::text;
ALTER TABLE "source_truths" ALTER COLUMN "memory_id" SET DATA TYPE TEXT USING "memory_id"::text;

-- Restore FKs (workspace remains UUID)
ALTER TABLE "memories" ADD CONSTRAINT "memories_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "memory_chunks" ADD CONSTRAINT "memory_chunks_memory_id_fkey"
  FOREIGN KEY ("memory_id") REFERENCES "memories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
