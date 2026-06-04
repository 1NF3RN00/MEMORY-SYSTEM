import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { Domain, Instruction } from "@memory-middleware/shared-types";
import { useAuth } from "../context/AuthContext.js";
import {
  archiveInstructionApi,
  createInstructionApi,
  fetchDomain,
  fetchInstructionVersions,
  fetchInstructions,
  versionInstructionApi,
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

interface InstructionFormState {
  actionKey: string;
  title: string;
  content: string;
}

const emptyForm: InstructionFormState = {
  actionKey: "",
  title: "",
  content: "",
};

export function InstructionManagerPage() {
  const { id: domainId } = useParams<{ id: string }>();
  const { workspace } = useAuth();
  const workspaceId = workspace?.workspaceId ?? "";
  const [domain, setDomain] = useState<Domain | null>(null);
  const [instructions, setInstructions] = useState<Instruction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [versionModalOpen, setVersionModalOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState<string | null>(null);
  const [versions, setVersions] = useState<Instruction[]>([]);
  const [form, setForm] = useState<InstructionFormState>(emptyForm);
  const [versionTarget, setVersionTarget] = useState<Instruction | null>(null);
  const [saving, setSaving] = useState(false);

  const activeByAction = useMemo(() => {
    const map = new Map<string, Instruction>();
    for (const instruction of instructions) {
      if (instruction.isActive && instruction.status === "active") {
        map.set(instruction.actionKey, instruction);
      }
    }
    return map;
  }, [instructions]);

  const load = useCallback(async () => {
    if (!workspaceId || !domainId) return;
    setLoading(true);
    setError(null);
    try {
      const [domainRow, instructionRows] = await Promise.all([
        fetchDomain(workspaceId, domainId),
        fetchInstructions(workspaceId, domainId),
      ]);
      setDomain(domainRow);
      setInstructions(instructionRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load instructions");
    } finally {
      setLoading(false);
    }
  }, [workspaceId, domainId]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openVersion(instruction: Instruction) {
    setVersionTarget(instruction);
    setForm({
      actionKey: instruction.actionKey,
      title: instruction.title,
      content: instruction.content,
    });
    setVersionModalOpen(true);
  }

  async function loadHistory(actionKey: string) {
    if (!workspaceId || !domainId) return;
    if (historyOpen === actionKey) {
      setHistoryOpen(null);
      return;
    }
    setError(null);
    try {
      const rows = await fetchInstructionVersions(workspaceId, domainId, actionKey);
      setVersions(rows);
      setHistoryOpen(actionKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load version history");
    }
  }

  async function handleCreate() {
    if (!workspaceId || !domainId) return;
    setSaving(true);
    setError(null);
    try {
      await createInstructionApi(workspaceId, domainId, {
        actionKey: form.actionKey.trim(),
        title: form.title.trim(),
        content: form.content.trim(),
      });
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleVersion() {
    if (!workspaceId || !domainId || !versionTarget) return;
    setSaving(true);
    setError(null);
    try {
      await versionInstructionApi(workspaceId, domainId, versionTarget.actionKey, {
        title: form.title.trim(),
        content: form.content.trim(),
      });
      setVersionModalOpen(false);
      setHistoryOpen(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Version failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive(instructionId: string) {
    if (!workspaceId || !confirm("Archive this instruction action?")) return;
    setError(null);
    try {
      await archiveInstructionApi(workspaceId, instructionId);
      setHistoryOpen(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Archive failed");
    }
  }

  const activeList = [...activeByAction.values()].sort((a, b) =>
    a.actionKey.localeCompare(b.actionKey),
  );

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-2 text-sm text-[var(--color-text-tertiary)]">
        <Link to="/domains" className="hover:text-[var(--color-text-primary)]">
          Domains
        </Link>
        <span>/</span>
        <span>{domain?.domainKey ?? domainId}</span>
        <span>/</span>
        <span className="text-[var(--color-text-secondary)]">Instructions</span>
      </div>

      <PageHeader
        code="INSTRUCTIONS"
        title={domain ? `${domain.name} instructions` : "Instructions"}
        lede="Versioned behavioral instructions keyed by actionKey. Task identity is domainKey + domainAction on retrieve."
        action={
          <Button onClick={openCreate} disabled={!workspaceId || !domainId}>
            Add instruction
          </Button>
        }
      />

      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

      <Panel title="Active instructions">
        {loading ? (
          <p className="text-sm text-[var(--color-text-tertiary)]">Loading…</p>
        ) : activeList.length === 0 ? (
          <EmptyState
            title="No instructions"
            description="Define action-scoped instructions such as audit or report. Each actionKey can be versioned independently."
            action={<Button onClick={openCreate}>Add instruction</Button>}
          />
        ) : (
          <DataTable>
            <DataTableHead>
              <DataTableHeaderCell>Action</DataTableHeaderCell>
              <DataTableHeaderCell>Title</DataTableHeaderCell>
              <DataTableHeaderCell>Version</DataTableHeaderCell>
              <DataTableHeaderCell>Content</DataTableHeaderCell>
              <DataTableHeaderCell>Actions</DataTableHeaderCell>
            </DataTableHead>
            <DataTableBody>
              {activeList.map((instruction) => (
                <DataTableRow key={instruction.instructionId}>
                  <DataTableCell mono>{instruction.actionKey}</DataTableCell>
                  <DataTableCell>{instruction.title}</DataTableCell>
                  <DataTableCell>
                    <Badge variant={statusToBadge("active")}>v{instruction.version}</Badge>
                  </DataTableCell>
                  <DataTableCell className="max-w-sm truncate">{instruction.content}</DataTableCell>
                  <DataTableCell>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="secondary" onClick={() => openVersion(instruction)}>
                        New version
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => void loadHistory(instruction.actionKey)}
                      >
                        {historyOpen === instruction.actionKey ? "Hide history" : "History"}
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => void handleArchive(instruction.instructionId)}
                      >
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

      {historyOpen && versions.length > 0 && (
        <Panel title={`Version history — ${historyOpen}`}>
          <DataTable dense>
            <DataTableHead>
              <DataTableHeaderCell>Version</DataTableHeaderCell>
              <DataTableHeaderCell>Active</DataTableHeaderCell>
              <DataTableHeaderCell>Title</DataTableHeaderCell>
              <DataTableHeaderCell>Updated</DataTableHeaderCell>
            </DataTableHead>
            <DataTableBody>
              {versions
                .sort((a, b) => b.version - a.version)
                .map((row) => (
                  <DataTableRow key={row.instructionId}>
                    <DataTableCell mono>v{row.version}</DataTableCell>
                    <DataTableCell>
                      {row.isActive ? <Badge variant="success">active</Badge> : "—"}
                    </DataTableCell>
                    <DataTableCell>{row.title}</DataTableCell>
                    <DataTableCell mono>
                      {new Date(row.updatedAt).toLocaleString()}
                    </DataTableCell>
                  </DataTableRow>
                ))}
            </DataTableBody>
          </DataTable>
        </Panel>
      )}

      <Modal
        open={modalOpen}
        title="Add instruction"
        onClose={() => setModalOpen(false)}
        footer={
          <ModalActions
            onCancel={() => setModalOpen(false)}
            primaryLabel="Create"
            onPrimary={() => void handleCreate()}
            primaryLoading={saving}
          />
        }
      >
        <div className="flex flex-col gap-4">
          <TextField
            label="Action key"
            value={form.actionKey}
            onChange={(e) => setForm((f) => ({ ...f, actionKey: e.target.value }))}
            placeholder="audit"
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
        </div>
      </Modal>

      <Modal
        open={versionModalOpen}
        title={`New version — ${versionTarget?.actionKey ?? ""}`}
        onClose={() => setVersionModalOpen(false)}
        footer={
          <ModalActions
            onCancel={() => setVersionModalOpen(false)}
            primaryLabel="Publish version"
            onPrimary={() => void handleVersion()}
            primaryLoading={saving}
          />
        }
      >
        <div className="flex flex-col gap-4">
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
        </div>
      </Modal>
    </div>
  );
}
