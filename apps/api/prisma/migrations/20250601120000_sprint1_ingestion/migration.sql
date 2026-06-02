-- Sprint 1: ingestion pipeline schema extensions

-- AlterTable memories
ALTER TABLE "memories" ADD COLUMN "parent_memory_id" UUID;
ALTER TABLE "memories" ADD COLUMN "memory_type" TEXT NOT NULL DEFAULT 'semantic';
ALTER TABLE "memories" ADD COLUMN "persistence_mode" TEXT NOT NULL DEFAULT 'persistent';
ALTER TABLE "memories" ADD COLUMN "source_type" TEXT NOT NULL DEFAULT 'text';
ALTER TABLE "memories" ADD COLUMN "title" TEXT NOT NULL DEFAULT '';
ALTER TABLE "memories" ADD COLUMN "normalized_content" TEXT NOT NULL DEFAULT '';
ALTER TABLE "memories" ADD COLUMN "ingestion_status" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "memories" ADD COLUMN "ingestion_trace_id" TEXT NOT NULL DEFAULT '';
ALTER TABLE "memories" ADD COLUMN "normalization_trace_id" TEXT NOT NULL DEFAULT '';
ALTER TABLE "memories" ADD COLUMN "embedding_version" TEXT NOT NULL DEFAULT 'openai-text-embedding-3-small-v1';
ALTER TABLE "memories" ADD COLUMN "normalization_version" TEXT NOT NULL DEFAULT 'deterministic-v1';
ALTER TABLE "memories" ADD COLUMN "scoring" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "memories" ADD COLUMN "lineage" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "memories" ADD COLUMN "observability" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "memories" ADD COLUMN "retrieval_eligible" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "memories" ADD COLUMN "expires_at" TIMESTAMP(3);
ALTER TABLE "memories" ADD COLUMN "archived_at" TIMESTAMP(3);
ALTER TABLE "memories" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "memories" SET "normalized_content" = "content" WHERE "normalized_content" = '';

-- AlterTable memory_chunks
ALTER TABLE "memory_chunks" ADD COLUMN "token_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "memory_chunks" ADD COLUMN "embedding_status" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "memory_chunks" ADD COLUMN "observability" JSONB NOT NULL DEFAULT '{}';

-- CreateTable ingestion_jobs
CREATE TABLE "ingestion_jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "trace_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "source_type" TEXT NOT NULL,
    "persistence_mode" TEXT NOT NULL DEFAULT 'persistent',
    "memory_type" TEXT NOT NULL DEFAULT 'semantic',
    "input_payload" JSONB NOT NULL,
    "memory_id" UUID,
    "lineage_id" UUID,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "last_error" TEXT,
    "use_llm_structuring" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "ingestion_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable ingestion_traces
CREATE TABLE "ingestion_traces" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "trace_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "source_type" TEXT NOT NULL,
    "persistence_mode" TEXT NOT NULL,
    "memory_id" UUID,
    "stages" JSONB NOT NULL DEFAULT '[]',
    "normalization_trace" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ingestion_traces_pkey" PRIMARY KEY ("id")
);

-- CreateTable source_truths
CREATE TABLE "source_truths" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "trace_id" TEXT NOT NULL,
    "memory_id" UUID,
    "raw_source" TEXT NOT NULL,
    "crawler_output" JSONB,
    "normalization_transformations" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "source_truths_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "memories_ingestion_trace_id_idx" ON "memories"("ingestion_trace_id");
CREATE UNIQUE INDEX "ingestion_traces_trace_id_key" ON "ingestion_traces"("trace_id");
CREATE INDEX "ingestion_traces_workspace_id_idx" ON "ingestion_traces"("workspace_id");
CREATE INDEX "ingestion_traces_memory_id_idx" ON "ingestion_traces"("memory_id");
CREATE INDEX "ingestion_jobs_status_idx" ON "ingestion_jobs"("status");
CREATE INDEX "ingestion_jobs_trace_id_idx" ON "ingestion_jobs"("trace_id");
CREATE INDEX "ingestion_jobs_workspace_id_idx" ON "ingestion_jobs"("workspace_id");
CREATE INDEX "source_truths_trace_id_idx" ON "source_truths"("trace_id");
CREATE INDEX "source_truths_memory_id_idx" ON "source_truths"("memory_id");

-- AddForeignKey
ALTER TABLE "ingestion_jobs" ADD CONSTRAINT "ingestion_jobs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ingestion_traces" ADD CONSTRAINT "ingestion_traces_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "source_truths" ADD CONSTRAINT "source_truths_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
