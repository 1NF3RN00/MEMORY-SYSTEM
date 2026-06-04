import { useCallback, useEffect, useState } from "react";
import type { OperationalObject } from "@memory-middleware/shared-types";
import { useAuth } from "../context/AuthContext.js";
import {
  archiveOperationalObjectApi,
  createOperationalObjectApi,
  fetchOperationalObjects,
  updateOperationalObjectApi,
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

interface ObjectFormState {
  objectType: string;
  name: string;
  status: string;
  metadataJson: string;
}

const emptyForm: ObjectFormState = {
  objectType: "",
  name: "",
  status: "",
  metadataJson: "{}",
};

function objectToForm(object: OperationalObject): ObjectFormState {
  return {
    objectType: object.objectType,
    name: object.name,
    status: object.status,
    metadataJson: JSON.stringify(object.metadata ?? {}, null, 2),
  };
}

export function ObjectManagerPage() {
  const { workspace } = useAuth();
  const workspaceId = workspace?.workspaceId ?? "";
  const [objects, setObjects] = useState<OperationalObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<OperationalObject | null>(null);
  const [form, setForm] = useState<ObjectFormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      setObjects(
        await fetchOperationalObjects(workspaceId, {
          ...(filterType.trim() ? { objectType: filterType.trim() } : {}),
          ...(filterStatus.trim() ? { status: filterStatus.trim() } : {}),
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load operational objects");
    } finally {
      setLoading(false);
    }
  }, [workspaceId, filterType, filterStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(object: OperationalObject) {
    setEditing(object);
    setForm(objectToForm(object));
    setModalOpen(true);
  }

  async function handleSave() {
    if (!workspaceId) return;
    let metadata: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(form.metadataJson) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Metadata must be a JSON object");
      }
      metadata = parsed as Record<string, unknown>;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid metadata JSON");
      return;
    }

    setSaving(true);
    setError(null);
    const body = {
      objectType: form.objectType.trim(),
      name: form.name.trim(),
      status: form.status.trim(),
      metadata,
    };
    try {
      if (editing) {
        await updateOperationalObjectApi(workspaceId, editing.objectId, body);
      } else {
        await createOperationalObjectApi(workspaceId, body);
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive(objectId: string) {
    if (!workspaceId || !confirm("Archive this operational object?")) return;
    setError(null);
    try {
      await archiveOperationalObjectApi(workspaceId, objectId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Archive failed");
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        code="OPERATIONAL OBJECTS"
        title="Object Manager"
        lede="Metadata-driven entities that organize real-world things. Objects augment retrieval — they are not memories."
        action={
          <Button onClick={openCreate} disabled={!workspaceId}>
            Add object
          </Button>
        }
      />

      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

      <Panel title="Filters">
        <div className="flex flex-wrap gap-4">
          <TextField
            label="Object type"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            placeholder="customer"
          />
          <TextField
            label="Status"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            placeholder="client"
          />
          <div className="flex items-end">
            <Button variant="secondary" onClick={() => void load()}>
              Apply filters
            </Button>
          </div>
        </div>
      </Panel>

      <Panel title="Active objects">
        {loading ? (
          <p className="text-sm text-[var(--color-text-tertiary)]">Loading…</p>
        ) : objects.length === 0 ? (
          <EmptyState
            title="No operational objects"
            description="Create customers, competitors, campaigns, and other entities with configurable type, status, and metadata."
            action={<Button onClick={openCreate}>Add object</Button>}
          />
        ) : (
          <DataTable>
            <DataTableHead>
              <DataTableHeaderCell>Type</DataTableHeaderCell>
              <DataTableHeaderCell>Name</DataTableHeaderCell>
              <DataTableHeaderCell>Status</DataTableHeaderCell>
              <DataTableHeaderCell>Updated</DataTableHeaderCell>
              <DataTableHeaderCell>Actions</DataTableHeaderCell>
            </DataTableHead>
            <DataTableBody>
              {objects.map((object) => (
                <DataTableRow key={object.objectId}>
                  <DataTableCell mono>{object.objectType}</DataTableCell>
                  <DataTableCell>{object.name}</DataTableCell>
                  <DataTableCell mono>{object.status}</DataTableCell>
                  <DataTableCell mono className="text-[var(--color-text-tertiary)]">
                    {new Date(object.updatedAt).toLocaleString()}
                  </DataTableCell>
                  <DataTableCell>
                    <div className="flex gap-2">
                      <Button variant="secondary" onClick={() => openEdit(object)}>
                        Edit
                      </Button>
                      <Button variant="danger" onClick={() => void handleArchive(object.objectId)}>
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
        title={editing ? "Edit operational object" : "Add operational object"}
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
            label="Object type"
            value={form.objectType}
            onChange={(e) => setForm((f) => ({ ...f, objectType: e.target.value }))}
            disabled={!!editing}
            placeholder="customer"
            hint="Lowercase slug, e.g. customer, competitor, campaign"
          />
          <TextField
            label="Name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <TextField
            label="Status"
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            placeholder="client"
            hint="Free-form business status — not enforced by middleware"
          />
          <TextAreaField
            label="Metadata (JSON)"
            value={form.metadataJson}
            onChange={(e) => setForm((f) => ({ ...f, metadataJson: e.target.value }))}
          />
          <p className="text-xs text-[var(--color-text-tertiary)]">
            Arbitrary key/value metadata for retrieval and filtering.
          </p>
        </div>
      </Modal>
    </div>
  );
}
