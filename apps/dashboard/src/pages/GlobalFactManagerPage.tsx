import { useCallback, useEffect, useState } from "react";
import type { Fact } from "@memory-middleware/shared-types";
import { useAuth } from "../context/AuthContext.js";
import {
  archiveGlobalFactApi,
  createGlobalFactApi,
  fetchGlobalFacts,
  formatCommaList,
  parseCommaList,
  updateGlobalFactApi,
} from "../lib/domain-engine-api.js";
import { EmptyState } from "../components/domain-engine/EmptyState.js";
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

interface FactFormState {
  key: string;
  title: string;
  content: string;
  priority: string;
  appliesToMetadataKeys: string;
}

const emptyForm: FactFormState = {
  key: "",
  title: "",
  content: "",
  priority: "10",
  appliesToMetadataKeys: "",
};

function factToForm(fact: Fact): FactFormState {
  return {
    key: fact.key,
    title: fact.title,
    content: fact.content,
    priority: String(fact.priority),
    appliesToMetadataKeys: formatCommaList(fact.appliesToMetadataKeys),
  };
}

export function GlobalFactManagerPage() {
  const { workspace } = useAuth();
  const workspaceId = workspace?.workspaceId ?? "";
  const [facts, setFacts] = useState<Fact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Fact | null>(null);
  const [form, setForm] = useState<FactFormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      setFacts(await fetchGlobalFacts(workspaceId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load global facts");
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

  function openEdit(fact: Fact) {
    setEditing(fact);
    setForm(factToForm(fact));
    setModalOpen(true);
  }

  async function handleSave() {
    if (!workspaceId) return;
    setSaving(true);
    setError(null);
    const priority = Number(form.priority);
    const body = {
      key: form.key.trim(),
      title: form.title.trim(),
      content: form.content.trim(),
      priority: Number.isFinite(priority) ? priority : 10,
      appliesToMetadataKeys: parseCommaList(form.appliesToMetadataKeys),
    };
    try {
      if (editing) {
        await updateGlobalFactApi(workspaceId, editing.factId, body);
      } else {
        await createGlobalFactApi(workspaceId, body);
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive(factId: string) {
    if (!workspaceId || !confirm("Archive this global fact?")) return;
    setError(null);
    try {
      await archiveGlobalFactApi(workspaceId, factId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Archive failed");
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        code="GLOBAL FACTS"
        title="Global Fact Manager"
        lede="Workspace-wide truths with highest precedence. Global facts override domain facts, instructions, and retrieved context."
        action={
          <Button onClick={openCreate} disabled={!workspaceId}>
            Add global fact
          </Button>
        }
      />

      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

      <Panel title="Active global facts">
        {loading ? (
          <p className="text-sm text-[var(--color-text-tertiary)]">Loading…</p>
        ) : facts.length === 0 ? (
          <EmptyState
            title="No global facts"
            description="Global facts are optional. Add workspace truths such as service areas, policies, or promotions that apply across all domains."
            action={<Button onClick={openCreate}>Add global fact</Button>}
          />
        ) : (
          <DataTable>
            <DataTableHead>
              <DataTableHeaderCell>Key</DataTableHeaderCell>
              <DataTableHeaderCell>Title</DataTableHeaderCell>
              <DataTableHeaderCell>Priority</DataTableHeaderCell>
              <DataTableHeaderCell>Content</DataTableHeaderCell>
              <DataTableHeaderCell>Actions</DataTableHeaderCell>
            </DataTableHead>
            <DataTableBody>
              {facts.map((fact) => (
                <DataTableRow key={fact.factId}>
                  <DataTableCell mono>{fact.key}</DataTableCell>
                  <DataTableCell>{fact.title}</DataTableCell>
                  <DataTableCell mono>{fact.priority}</DataTableCell>
                  <DataTableCell className="max-w-xs truncate">{fact.content}</DataTableCell>
                  <DataTableCell>
                    <div className="flex gap-2">
                      <Button variant="secondary" onClick={() => openEdit(fact)}>
                        Edit
                      </Button>
                      <Button variant="danger" onClick={() => void handleArchive(fact.factId)}>
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
        title={editing ? "Edit global fact" : "Add global fact"}
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
            label="Key"
            value={form.key}
            onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
            disabled={!!editing}
            placeholder="service-area-primary"
          />
          <TextField
            label="Title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
          <TextAreaField
            label="Content"
            value={form.content}
            onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
          />
          <TextField
            label="Priority"
            type="number"
            value={form.priority}
            onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
            hint="Higher values win within the same scope."
          />
          <TextField
            label="Applies to metadata keys"
            value={form.appliesToMetadataKeys}
            onChange={(e) => setForm((f) => ({ ...f, appliesToMetadataKeys: e.target.value }))}
            placeholder="service-area"
            hint="Optional comma-separated keys for targeted overrides."
          />
        </div>
      </Modal>
    </div>
  );
}
