-- Phase 8: Operational Objects

CREATE TABLE "operational_objects" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "object_type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "row_status" TEXT NOT NULL DEFAULT 'active',
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operational_objects_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "operational_objects_workspace_id_object_type_idx" ON "operational_objects"("workspace_id", "object_type");
CREATE INDEX "operational_objects_workspace_id_status_idx" ON "operational_objects"("workspace_id", "status");

ALTER TABLE "operational_objects" ADD CONSTRAINT "operational_objects_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
