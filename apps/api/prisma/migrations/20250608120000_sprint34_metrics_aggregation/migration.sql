-- Sprint-34: pre-aggregated workspace metrics for O(1) dashboard reads.

CREATE TABLE "workspace_metrics_summaries" (
    "workspace_id" TEXT NOT NULL,
    "active_memories" INTEGER NOT NULL DEFAULT 0,
    "retrieval_total" INTEGER NOT NULL DEFAULT 0,
    "retrieval_completed" INTEGER NOT NULL DEFAULT 0,
    "retrieval_failed" INTEGER NOT NULL DEFAULT 0,
    "retrieval_24h" INTEGER NOT NULL DEFAULT 0,
    "retrieval_failed_24h" INTEGER NOT NULL DEFAULT 0,
    "retrieval_latency_sum_ms" BIGINT NOT NULL DEFAULT 0,
    "retrieval_latency_count" INTEGER NOT NULL DEFAULT 0,
    "ingestion_total" INTEGER NOT NULL DEFAULT 0,
    "ingestion_completed" INTEGER NOT NULL DEFAULT 0,
    "ingestion_failed" INTEGER NOT NULL DEFAULT 0,
    "ingestion_24h" INTEGER NOT NULL DEFAULT 0,
    "compression_total" INTEGER NOT NULL DEFAULT 0,
    "compression_completed" INTEGER NOT NULL DEFAULT 0,
    "compression_failed" INTEGER NOT NULL DEFAULT 0,
    "context_render_total" INTEGER NOT NULL DEFAULT 0,
    "context_render_completed" INTEGER NOT NULL DEFAULT 0,
    "context_render_failed" INTEGER NOT NULL DEFAULT 0,
    "rolling_window_start_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_metrics_summaries_pkey" PRIMARY KEY ("workspace_id")
);

ALTER TABLE "workspace_metrics_summaries"
  ADD CONSTRAINT "workspace_metrics_summaries_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
