import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { Domain, Fact } from "@memory-middleware/shared-types";
import { useAuth } from "../context/AuthContext.js";
import {
  archiveDomainFactApi,
  createDomainFactApi,
  fetchDomain,
  fetchDomainFacts,
  formatCommaList,
  parseCommaList,
  updateDomainFactApi,
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

export function DomainFactManagerPage() {
  const { id: domainId } = useParams<{ id: string }>();
  const { workspace } = useAuth();
  const workspaceId = workspace?.workspaceId ?? "";
  const [domain, setDomain] = useState<Domain | null>(null);
  const [facts, setFacts] = useState<Fact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Fact | null>(null);
  const [form, setForm] = useState<FactFormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!workspaceId || !domainId) return;
    setLoading(true);
    setError(null);
    try {
      const [domainRow, factRows] = await Promise.all([
        fetchDomain(workspaceId, domainId),
        fetchDomainFacts(workspaceId, domainId),
      ]);
      setDomain(domainRow);
      setFacts(factRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load domain facts");
    } finally {
      setLoading(false);
    }
  }, [workspaceId, domainId]);

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
    if (!workspaceId || !domainId) return;
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
        await updateDomainFactApi(workspaceId, editing.factId, body);
      } else {
        await createDomainFactApi(workspaceId, domainId, body);
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
    if (!workspaceId || !confirm("Archive this domain fact?")) return;
    setError(null);
    try {
      await archiveDomainFactApi(workspaceId, factId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Archive failed");
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-2 text-sm text-[var(--color-text-tertiary)]">
        <Link to="/domains" className="hover:text-[var(--color-text-primary)]">
          Domains
        </Link>
        <span>/</span>
        <span>{domain?.domainKey ?? domainId}</span>
        <span>/</span>
        <span className="text-[var(--color-text-secondary)]">Facts</span>
      </div>

      <PageHeader
        code="DOMAIN FACTS"
        title={domain ? `${domain.name} facts` : "Domain facts"}
        lede="Domain-scoped truths that override instructions and retrieved context, but never global facts."
        action={
          <Button onClick={openCreate} disabled={!workspaceId || !domainId}>
            Add domain fact
          </Button>
        }
      />

      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

      <Panel title="Active domain facts">
        {loading ? (
          <p className="text-sm text-[var(--color-text-tertiary)]">Loading…</p>
        ) : facts.length === 0 ? (
          <EmptyState
            title="No domain facts"
            description="Add facts that apply only within this domain, such as target keywords or escalation rules."
            action={<Button onClick={openCreate}>Add domain fact</Button>}
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
        title={editing ? "Edit domain fact" : "Add domain fact"}
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
          />
          <TextField
            label="Applies to metadata keys"
            value={form.appliesToMetadataKeys}
            onChange={(e) => setForm((f) => ({ ...f, appliesToMetadataKeys: e.target.value }))}
          />
        </div>
      </Modal>
    </div>
  );
}
