import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { Workflow, WorkflowOutput } from "@memory-middleware/shared-types";
import { WORKFLOW_CONTEXT_LAYER_ORDER } from "@memory-middleware/shared-types";
import { useAuth } from "../context/AuthContext.js";
import {
  fetchWorkflowRunDetail,
  fetchWorkflowRunReplay,
  type WorkflowRunReplayResponse,
} from "../lib/domain-engine-api.js";
import { Badge } from "../components/ui/Badge.js";
import { Button } from "../components/ui/Button.js";
import { PageHeader } from "../components/ui/PageHeader.js";
import { Panel } from "../components/ui/Panel.js";
import { MetricCell, MetricStrip } from "../components/ui/MetricCell.js";

function layerCount(
  replay: WorkflowRunReplayResponse["workflowReplay"],
  layer: (typeof WORKFLOW_CONTEXT_LAYER_ORDER)[number],
): number {
  if (!replay) return 0;
  const ctx = replay.executionContext;
  switch (layer) {
    case "globalFacts":
      return ctx.globalFacts.length;
    case "domainFacts":
      return ctx.domainFacts.length;
    case "instructions":
      return ctx.instructions.length;
    case "objects":
      return ctx.objects.length;
    case "retrievedContext":
      return ctx.retrievedContext.length;
    case "previousWorkflowRuns":
      return ctx.previousWorkflowRuns.length;
    default:
      return 0;
  }
}

export function WorkflowReplayPage() {
  const { runId } = useParams();
  const { workspace } = useAuth();
  const workspaceId = workspace?.workspaceId ?? "";
  const [replay, setReplay] = useState<WorkflowRunReplayResponse | null>(null);
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!workspaceId || !runId) return;
    setLoading(true);
    setError(null);
    try {
      const [snapshot, detail] = await Promise.all([
        fetchWorkflowRunReplay(workspaceId, runId),
        fetchWorkflowRunDetail(workspaceId, runId),
      ]);
      setReplay(snapshot);
      setWorkflowId(detail.workflowId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load workflow replay");
    } finally {
      setLoading(false);
    }
  }, [workspaceId, runId]);

  useEffect(() => {
    void load();
  }, [load]);

  const workflowReplay = replay?.workflowReplay;
  const retrievedMemoryCount = useMemo(() => {
    if (!workflowReplay) return 0;
    return workflowReplay.executionContext.retrievedContext.reduce(
      (sum, pkg) => sum + pkg.memories.length,
      0,
    );
  }, [workflowReplay]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        code="WORKFLOW REPLAY"
        title="Workflow run replay"
        lede="Reconstruct a workflow execution from Historian snapshot — execution context, outputs, and generated entity IDs."
        action={
          workflowId ? (
            <Link to={`/workflows/${workflowId}/runs`}>
              <Button variant="secondary">Back to runs</Button>
            </Link>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--color-text-tertiary)]">
        <Link to="/workflows" className="hover:text-[var(--color-text-secondary)]">
          Workflows
        </Link>
        {workflowId && (
          <>
            <span>/</span>
            <Link
              to={`/workflows/${workflowId}/runs`}
              className="hover:text-[var(--color-text-secondary)]"
            >
              Runs
            </Link>
          </>
        )}
        <span>/</span>
        <span className="font-mono text-[var(--color-text-secondary)]">{runId}</span>
        {replay && (
          <Link to={`/historian/${replay.retrievalTraceId}`} className="ml-auto">
            <Button variant="secondary">Open in Historian</Button>
          </Link>
        )}
      </div>

      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

      {loading ? (
        <p className="text-sm text-[var(--color-text-tertiary)]">Loading replay…</p>
      ) : !replay ? (
        <p className="text-sm text-[var(--color-text-tertiary)]">Replay snapshot not found.</p>
      ) : (
        <>
          <MetricStrip>
            <MetricCell label="Replay ID" value={replay.replayId.slice(0, 12)} />
            <MetricCell label="Query" value={replay.originalQuery || "—"} />
            <MetricCell label="Integrity" value={replay.integrityHash.slice(0, 12)} />
            <MetricCell
              label="Outputs"
              value={String(workflowReplay?.outputs.length ?? 0)}
            />
          </MetricStrip>

          {!workflowReplay ? (
            <Panel title="Workflow payload">
              <p className="text-sm text-[var(--color-text-tertiary)]">
                Snapshot exists but has no workflowReplay payload. This run may predate Phase 10
                replay enrichment.
              </p>
            </Panel>
          ) : (
            <>
              <Panel title="Execution context layers">
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {WORKFLOW_CONTEXT_LAYER_ORDER.map((layer) => (
                    <div
                      key={layer}
                      className="rounded border border-[var(--color-border-default)] bg-[var(--color-surface-2)] px-3 py-2"
                    >
                      <span className="font-metric text-xs uppercase text-[var(--color-text-tertiary)]">
                        {layer}
                      </span>
                      <p className="text-lg font-medium">{layerCount(workflowReplay, layer)}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-sm text-[var(--color-text-tertiary)]">
                  Retrieved memories across packages: {retrievedMemoryCount}
                </p>
              </Panel>

              <Panel title="Generated entities">
                <div className="flex flex-wrap gap-4 text-sm">
                  <span>
                    Facts:{" "}
                    <strong>{workflowReplay.generatedFactIds.length}</strong>
                  </span>
                  <span>
                    Memories:{" "}
                    <strong>{workflowReplay.generatedMemoryIds.length}</strong>
                  </span>
                  <span>
                    Objects:{" "}
                    <strong>{workflowReplay.generatedObjectIds.length}</strong>
                  </span>
                </div>
              </Panel>

              <Panel title="Outputs">
                {workflowReplay.outputs.length === 0 ? (
                  <p className="text-sm text-[var(--color-text-tertiary)]">No outputs recorded.</p>
                ) : (
                  <div className="flex flex-col gap-4">
                    {workflowReplay.outputs.map((output: WorkflowOutput) => (
                      <div
                        key={output.outputId}
                        className="rounded border border-[var(--color-border-default)] bg-[var(--color-surface-2)] p-4"
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="font-medium">{output.title}</span>
                          <Badge>{output.outputType}</Badge>
                        </div>
                        <pre className="max-h-96 overflow-auto whitespace-pre-wrap text-xs text-[var(--color-text-secondary)]">
                          {output.content}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>

              <Panel title="Raw replay snapshot">
                <pre className="max-h-96 overflow-auto text-xs text-[var(--color-text-tertiary)]">
                  {JSON.stringify(replay, null, 2)}
                </pre>
              </Panel>
            </>
          )}
        </>
      )}
    </div>
  );
}
