import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { Workflow, WorkflowRun, WorkflowRunDetail } from "@memory-middleware/shared-types";
import { useAuth } from "../context/AuthContext.js";
import {
  archiveWorkflowRunApi,
  executeWorkflowApi,
  fetchWorkflow,
  fetchWorkflowRunDetail,
  fetchWorkflowRuns,
} from "../lib/domain-engine-api.js";
import { WorkflowSubNav } from "../components/domain-engine/WorkflowSubNav.js";
import { Badge, statusToBadge } from "../components/ui/Badge.js";
import { Button } from "../components/ui/Button.js";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
} from "../components/ui/DataTable.js";
import { Modal, ModalActions } from "../components/ui/Modal.js";
import { PageHeader } from "../components/ui/PageHeader.js";
import { Panel } from "../components/ui/Panel.js";
import { TextAreaField, TextField } from "../components/ui/TextField.js";
import { MetricCell, MetricStrip } from "../components/ui/MetricCell.js";

export function WorkflowRunsPage() {
  const { workflowId } = useParams();
  const { workspace } = useAuth();
  const workspaceId = workspace?.workspaceId ?? "";
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<WorkflowRunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [executeOpen, setExecuteOpen] = useState(false);
  const [executeQuery, setExecuteQuery] = useState("");
  const [tokenBudget, setTokenBudget] = useState("4000");
  const [executing, setExecuting] = useState(false);

  const load = useCallback(async () => {
    if (!workspaceId || !workflowId) return;
    setLoading(true);
    setError(null);
    try {
      const [wf, runList] = await Promise.all([
        fetchWorkflow(workspaceId, workflowId),
        fetchWorkflowRuns(workspaceId, workflowId),
      ]);
      setWorkflow(wf);
      setRuns(runList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load workflow runs");
    } finally {
      setLoading(false);
    }
  }, [workspaceId, workflowId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function inspectRun(workflowRunId: string) {
    if (!workspaceId) return;
    setDetailLoading(true);
    setError(null);
    try {
      setSelectedRun(await fetchWorkflowRunDetail(workspaceId, workflowRunId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load run detail");
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleExecute() {
    if (!workspaceId || !workflowId || !executeQuery.trim()) return;
    setExecuting(true);
    setError(null);
    const budget = Number(tokenBudget);
    try {
      const result = await executeWorkflowApi(workspaceId, workflowId, {
        query: executeQuery.trim(),
        ...(Number.isFinite(budget) && budget > 0 ? { tokenBudget: budget } : {}),
      });
      setExecuteOpen(false);
      setExecuteQuery("");
      await load();
      await inspectRun(result.workflowRunId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Execution failed");
    } finally {
      setExecuting(false);
    }
  }

  async function handleArchiveRun(workflowRunId: string) {
    if (!workspaceId || !confirm("Archive this workflow run?")) return;
    setError(null);
    try {
      await archiveWorkflowRunApi(workspaceId, workflowRunId);
      if (selectedRun?.workflowRunId === workflowRunId) setSelectedRun(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Archive failed");
    }
  }

  function runDuration(run: WorkflowRun): string {
    if (!run.completedAt) return "—";
    const ms = new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime();
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        code="WORKFLOW RUNS"
        title={workflow?.name ?? "Workflow runs"}
        lede="Execute workflows and inspect run history. Each run chains prior completed runs into execution context."
        action={
          <Button onClick={() => setExecuteOpen(true)} disabled={!workspaceId || !workflow?.active}>
            Execute workflow
          </Button>
        }
      />

      <WorkflowSubNav workflowName={workflow?.name} active="runs" />

      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

      <Panel title="Run history">
        {loading ? (
          <p className="text-sm text-[var(--color-text-tertiary)]">Loading…</p>
        ) : runs.length === 0 ? (
          <p className="text-sm text-[var(--color-text-tertiary)]">
            No runs yet. Execute the workflow to create the first run.
          </p>
        ) : (
          <DataTable>
            <DataTableHead>
              <DataTableHeaderCell>Run ID</DataTableHeaderCell>
              <DataTableHeaderCell>Status</DataTableHeaderCell>
              <DataTableHeaderCell>Started</DataTableHeaderCell>
              <DataTableHeaderCell>Duration</DataTableHeaderCell>
              <DataTableHeaderCell>Outputs</DataTableHeaderCell>
              <DataTableHeaderCell>Actions</DataTableHeaderCell>
            </DataTableHead>
            <DataTableBody>
              {runs.map((run) => (
                <DataTableRow key={run.workflowRunId}>
                  <DataTableCell mono className="text-xs">
                    {run.workflowRunId}
                  </DataTableCell>
                  <DataTableCell>
                    <Badge variant={statusToBadge(run.status)}>{run.status}</Badge>
                  </DataTableCell>
                  <DataTableCell mono className="text-[var(--color-text-tertiary)]">
                    {new Date(run.startedAt).toLocaleString()}
                  </DataTableCell>
                  <DataTableCell mono>{runDuration(run)}</DataTableCell>
                  <DataTableCell mono>{run.outputCount}</DataTableCell>
                  <DataTableCell>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="secondary" onClick={() => void inspectRun(run.workflowRunId)}>
                        Inspect
                      </Button>
                      <Link to={`/workflows/runs/${run.workflowRunId}/replay`}>
                        <Button variant="secondary">Replay</Button>
                      </Link>
                      {run.status !== "archived" && (
                        <Button
                          variant="danger"
                          onClick={() => void handleArchiveRun(run.workflowRunId)}
                        >
                          Archive
                        </Button>
                      )}
                    </div>
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        )}
      </Panel>

      {selectedRun && (
        <Panel title={`Run ${selectedRun.workflowRunId}`}>
          {detailLoading ? (
            <p className="text-sm text-[var(--color-text-tertiary)]">Loading detail…</p>
          ) : (
            <div className="flex flex-col gap-4">
              <MetricStrip>
                <MetricCell label="Status" value={selectedRun.status} />
                <MetricCell label="Outputs" value={String(selectedRun.outputCount)} />
                <MetricCell
                  label="Prior runs in context"
                  value={String(selectedRun.executionContext.previousWorkflowRuns.length)}
                />
                <MetricCell
                  label="Retrieved packages"
                  value={String(selectedRun.executionContext.retrievedContext.length)}
                />
              </MetricStrip>

              {selectedRun.errorMessage && (
                <p className="text-sm text-[var(--color-danger)]">{selectedRun.errorMessage}</p>
              )}

              {selectedRun.outputs.map((output) => (
                <div
                  key={output.outputId}
                  className="rounded border border-[var(--color-border-default)] bg-[var(--color-surface-2)] p-4"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="font-medium">{output.title}</span>
                    <Badge>{output.outputType}</Badge>
                  </div>
                  <pre className="max-h-64 overflow-auto whitespace-pre-wrap text-xs text-[var(--color-text-secondary)]">
                    {output.content}
                  </pre>
                </div>
              ))}

              <Link to={`/workflows/runs/${selectedRun.workflowRunId}/replay`}>
                <Button variant="secondary">Open Historian replay</Button>
              </Link>
            </div>
          )}
        </Panel>
      )}

      <Modal
        open={executeOpen}
        title="Execute workflow"
        onClose={() => setExecuteOpen(false)}
        footer={
          <ModalActions
            onCancel={() => setExecuteOpen(false)}
            primaryLabel="Execute"
            onPrimary={() => void handleExecute()}
            primaryLoading={executing}
          />
        }
      >
        <div className="flex flex-col gap-4">
          <TextAreaField
            label="Query"
            value={executeQuery}
            onChange={(e) => setExecuteQuery(e.target.value)}
            placeholder="What should this workflow analyze?"
          />
          <TextField
            label="Token budget"
            value={tokenBudget}
            onChange={(e) => setTokenBudget(e.target.value)}
            hint="Per-domain retrieval budget (default 4000)"
          />
        </div>
      </Modal>
    </div>
  );
}
