import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Workflow } from "@memory-middleware/shared-types";
import { useAuth } from "../context/AuthContext.js";
import {
  archiveWorkflowApi,
  createWorkflowApi,
  fetchWorkflows,
  formatCommaList,
  formatInstructionRefs,
  parseCommaList,
  parseInstructionRefsJson,
  updateWorkflowApi,
} from "../lib/domain-engine-api.js";
import { EmptyState } from "../components/domain-engine/EmptyState.js";
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

interface WorkflowFormState {
  name: string;
  description: string;
  domains: string;
  packages: string;
  instructionRefsJson: string;
  outputTypes: string;
  objectTypeFilters: string;
  active: boolean;
}

const emptyForm: WorkflowFormState = {
  name: "",
  description: "",
  domains: "",
  packages: "",
  instructionRefsJson: "[]",
  outputTypes: "report",
  objectTypeFilters: "",
  active: true,
};

function workflowToForm(workflow: Workflow): WorkflowFormState {
  return {
    name: workflow.name,
    description: workflow.description ?? "",
    domains: formatCommaList(workflow.domains),
    packages: formatCommaList(workflow.packages),
    instructionRefsJson: formatInstructionRefs(workflow.instructionRefs),
    outputTypes: formatCommaList(workflow.outputTypes),
    objectTypeFilters: formatCommaList(workflow.objectTypeFilters),
    active: workflow.active,
  };
}

function parseWorkflowForm(form: WorkflowFormState, isCreate: boolean): Record<string, unknown> {
  const instructionRefs = parseInstructionRefsJson(form.instructionRefsJson);
  const body: Record<string, unknown> = {
    name: form.name.trim(),
    description: form.description.trim(),
    domains: parseCommaList(form.domains),
    packages: parseCommaList(form.packages),
    instructionRefs,
    outputTypes: parseCommaList(form.outputTypes),
    objectTypeFilters: parseCommaList(form.objectTypeFilters),
  };
  if (!isCreate) body.active = form.active;
  return body;
}

export function WorkflowManagerPage() {
  const { workspace } = useAuth();
  const workspaceId = workspace?.workspaceId ?? "";
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Workflow | null>(null);
  const [form, setForm] = useState<WorkflowFormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      setWorkflows(await fetchWorkflows(workspaceId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load workflows");
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(workflow: Workflow) {
    setEditing(workflow);
    setForm(workflowToForm(workflow));
    setModalOpen(true);
  }

  async function handleSave() {
    if (!workspaceId) return;
    let body: Record<string, unknown>;
    try {
      body = parseWorkflowForm(form, !editing);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid form");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (editing) {
        await updateWorkflowApi(workspaceId, editing.workflowId, body);
      } else {
        await createWorkflowApi(workspaceId, body);
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive(workflowId: string) {
    if (!workspaceId || !confirm("Archive this workflow?")) return;
    setError(null);
    try {
      await archiveWorkflowApi(workspaceId, workflowId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Archive failed");
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        code="WORKFLOW REGISTRY"
        title="Workflow Manager"
        lede="Operational intelligence workflows — link domains, instructions, and packages, then execute to produce reports and insights."
        action={
          <Button onClick={openCreate} disabled={!workspaceId}>
            Add workflow
          </Button>
        }
      />

      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

      <Panel title="Registered workflows">
        {loading ? (
          <p className="text-sm text-[var(--color-text-tertiary)]">Loading…</p>
        ) : workflows.length === 0 ? (
          <EmptyState
            title="No workflows"
            description="Create a workflow to orchestrate domain retrieval, facts, objects, and prior runs into deterministic outputs."
            action={<Button onClick={openCreate}>Add workflow</Button>}
          />
        ) : (
          <DataTable>
            <DataTableHead>
              <DataTableHeaderCell>Name</DataTableHeaderCell>
              <DataTableHeaderCell>Domains</DataTableHeaderCell>
              <DataTableHeaderCell>Outputs</DataTableHeaderCell>
              <DataTableHeaderCell>Status</DataTableHeaderCell>
              <DataTableHeaderCell>Actions</DataTableHeaderCell>
            </DataTableHead>
            <DataTableBody>
              {workflows.map((workflow) => (
                <DataTableRow key={workflow.workflowId}>
                  <DataTableCell>
                    <div className="flex flex-col gap-0.5">
                      <span>{workflow.name}</span>
                      {workflow.description && (
                        <span className="text-xs text-[var(--color-text-tertiary)]">
                          {workflow.description}
                        </span>
                      )}
                    </div>
                  </DataTableCell>
                  <DataTableCell mono className="text-[var(--color-text-tertiary)]">
                    {workflow.domains.join(", ") || "—"}
                  </DataTableCell>
                  <DataTableCell mono className="text-[var(--color-text-tertiary)]">
                    {workflow.outputTypes.join(", ") || "report"}
                  </DataTableCell>
                  <DataTableCell>
                    <Badge variant={statusToBadge(workflow.active ? "active" : "archived")}>
                      {workflow.active ? "Active" : "Inactive"}
                    </Badge>
                  </DataTableCell>
                  <DataTableCell>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="secondary" onClick={() => openEdit(workflow)}>
                        Edit
                      </Button>
                      <Link to={`/workflows/${workflow.workflowId}/runs`}>
                        <Button variant="secondary">Runs</Button>
                      </Link>
                      <Link to={`/workflows/${workflow.workflowId}/outputs`}>
                        <Button variant="secondary">Outputs</Button>
                      </Link>
                      <Button variant="danger" onClick={() => void handleArchive(workflow.workflowId)}>
                        Archive
                      </Button>
                    </div>
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        )}
      </Panel>

      <Modal
        open={modalOpen}
        title={editing ? "Edit workflow" : "Add workflow"}
        onClose={() => setModalOpen(false)}
        footer={
          <ModalActions
            onCancel={() => setModalOpen(false)}
            primaryLabel={editing ? "Save" : "Create"}
            onPrimary={() => void handleSave()}
            primaryLoading={saving}
          />
        }
      >
        <div className="flex flex-col gap-4">
          <TextField
            label="Name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <TextAreaField
            label="Description"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
          <TextField
            label="Domains"
            value={form.domains}
            onChange={(e) => setForm((f) => ({ ...f, domains: e.target.value }))}
            placeholder="competitor, seo"
            hint="Comma-separated domain keys"
          />
          <TextField
            label="Packages"
            value={form.packages}
            onChange={(e) => setForm((f) => ({ ...f, packages: e.target.value }))}
            placeholder="installed-package-id"
            hint="Comma-separated installed package IDs"
          />
          <TextAreaField
            label="Instruction refs (JSON)"
            value={form.instructionRefsJson}
            onChange={(e) => setForm((f) => ({ ...f, instructionRefsJson: e.target.value }))}
          />
          <p className="text-xs text-[var(--color-text-tertiary)]">
            Example: [&#123;&quot;domainKey&quot;:&quot;competitor&quot;,&quot;actionKey&quot;:&quot;analyze&quot;&#125;]
          </p>
          <TextField
            label="Output types"
            value={form.outputTypes}
            onChange={(e) => setForm((f) => ({ ...f, outputTypes: e.target.value }))}
            placeholder="report, insight"
          />
          <TextField
            label="Object type filters"
            value={form.objectTypeFilters}
            onChange={(e) => setForm((f) => ({ ...f, objectTypeFilters: e.target.value }))}
            placeholder="customer, competitor"
          />
          {editing && (
            <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
              />
              Active
            </label>
          )}
        </div>
      </Modal>
    </div>
  );
}
