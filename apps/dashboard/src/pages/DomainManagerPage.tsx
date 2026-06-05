import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Domain } from "@memory-middleware/shared-types";
import { DEFAULT_RELATIONSHIP_NEIGHBORHOOD_CONSTRAINT } from "@memory-middleware/shared-types";
import { useAuth } from "../context/AuthContext.js";
import {
  archiveDomainApi,
  createDomainApi,
  fetchDomains,
  fetchObservationProviders,
  formatCommaList,
  parseCommaList,
  updateDomainApi,
  type ObservationProviderSummary,
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

interface DomainFormState {
  domainKey: string;
  name: string;
  description: string;
  metadataFilters: string;
  observationProviderKeys: string[];
  retrievalRulesJson: string;
  relationshipConstraintsJson: string;
}

const emptyForm: DomainFormState = {
  domainKey: "",
  name: "",
  description: "",
  metadataFilters: "",
  observationProviderKeys: [],
  retrievalRulesJson: "[]",
  relationshipConstraintsJson: JSON.stringify(
    DEFAULT_RELATIONSHIP_NEIGHBORHOOD_CONSTRAINT,
    null,
    2,
  ),
};

function providerKeysFromDomain(domain: Domain): string[] {
  const keys = new Set<string>();
  for (const filter of domain.observationFilters) {
    for (const provider of filter.providers ?? []) {
      keys.add(provider);
    }
  }
  return [...keys];
}

function domainToForm(domain: Domain): DomainFormState {
  return {
    domainKey: domain.domainKey,
    name: domain.name,
    description: domain.description ?? "",
    metadataFilters: formatCommaList(domain.metadataFilters),
    observationProviderKeys: providerKeysFromDomain(domain),
    retrievalRulesJson: JSON.stringify(domain.retrievalRules, null, 2),
    relationshipConstraintsJson: JSON.stringify(domain.relationshipConstraints, null, 2),
  };
}

function buildObservationFilters(providerKeys: string[]) {
  if (providerKeys.length === 0) return [];
  return [{ providers: providerKeys }];
}

function parseDomainForm(form: DomainFormState, isCreate: boolean): Record<string, unknown> {
  let retrievalRules: unknown[] = [];
  let relationshipConstraints = DEFAULT_RELATIONSHIP_NEIGHBORHOOD_CONSTRAINT;
  try {
    retrievalRules = JSON.parse(form.retrievalRulesJson) as unknown[];
    if (!Array.isArray(retrievalRules)) throw new Error("Retrieval rules must be an array");
  } catch {
    throw new Error("Invalid retrieval rules JSON");
  }
  try {
    relationshipConstraints = JSON.parse(form.relationshipConstraintsJson);
  } catch {
    throw new Error("Invalid relationship constraints JSON");
  }
  const body: Record<string, unknown> = {
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    metadataFilters: parseCommaList(form.metadataFilters),
    observationFilters: buildObservationFilters(form.observationProviderKeys),
    retrievalRules,
    relationshipConstraints,
  };
  if (isCreate) body.domainKey = form.domainKey.trim();
  return body;
}

export function DomainManagerPage() {
  const { workspace } = useAuth();
  const workspaceId = workspace?.workspaceId ?? "";
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Domain | null>(null);
  const [form, setForm] = useState<DomainFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [providers, setProviders] = useState<ObservationProviderSummary[]>([]);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      setDomains(await fetchDomains(workspaceId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load domains");
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void fetchObservationProviders()
      .then(setProviders)
      .catch(() => setProviders([]));
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(domain: Domain) {
    setEditing(domain);
    setForm(domainToForm(domain));
    setModalOpen(true);
  }

  async function handleSave() {
    if (!workspaceId) return;
    setSaving(true);
    setError(null);
    try {
      const body = parseDomainForm(form, !editing);
      if (editing) {
        await updateDomainApi(workspaceId, editing.domainId, body);
      } else {
        await createDomainApi(workspaceId, body);
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive(domainId: string) {
    if (!workspaceId || !confirm("Archive this domain? It will no longer be used in retrieval.")) {
      return;
    }
    setError(null);
    try {
      await archiveDomainApi(workspaceId, domainId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Archive failed");
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        code="DOMAINS"
        title="Domain Manager"
        lede="Task-scoped retrieval boundaries. Domains shape metadata filters, retrieval rules, and execution context when domainKey is set on retrieve."
        action={
          <Button onClick={openCreate} disabled={!workspaceId}>
            Create domain
          </Button>
        }
      />

      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

      <Panel title="Active domains">
        {loading ? (
          <p className="text-sm text-[var(--color-text-tertiary)]">Loading…</p>
        ) : domains.length === 0 ? (
          <EmptyState
            title="No domains configured"
            description="Create a domain manually or install a package to define task-scoped intelligence. Workspace retrieval without domainKey continues to work unchanged."
            action={<Button onClick={openCreate}>Create domain</Button>}
          />
        ) : (
          <DataTable>
            <DataTableHead>
              <DataTableHeaderCell>Key</DataTableHeaderCell>
              <DataTableHeaderCell>Name</DataTableHeaderCell>
              <DataTableHeaderCell>Metadata filters</DataTableHeaderCell>
              <DataTableHeaderCell>Observation providers</DataTableHeaderCell>
              <DataTableHeaderCell>Status</DataTableHeaderCell>
              <DataTableHeaderCell>Actions</DataTableHeaderCell>
            </DataTableHead>
            <DataTableBody>
              {domains.map((domain) => (
                <DataTableRow key={domain.domainId}>
                  <DataTableCell mono>{domain.domainKey}</DataTableCell>
                  <DataTableCell>{domain.name}</DataTableCell>
                  <DataTableCell>
                    {domain.metadataFilters.length > 0
                      ? domain.metadataFilters.join(", ")
                      : "—"}
                  </DataTableCell>
                  <DataTableCell>
                    {providerKeysFromDomain(domain).length > 0
                      ? providerKeysFromDomain(domain).join(", ")
                      : "—"}
                  </DataTableCell>
                  <DataTableCell>
                    <Badge variant={statusToBadge(domain.status)}>{domain.status}</Badge>
                  </DataTableCell>
                  <DataTableCell>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="secondary" onClick={() => openEdit(domain)}>
                        Edit
                      </Button>
                      <Link
                        to={`/domains/${domain.domainId}/facts`}
                        className="inline-flex items-center rounded-md border border-[var(--color-border-default)] px-3 py-1.5 font-metric text-xs uppercase tracking-wider text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)]"
                      >
                        Facts
                      </Link>
                      <Link
                        to={`/domains/${domain.domainId}/instructions`}
                        className="inline-flex items-center rounded-md border border-[var(--color-border-default)] px-3 py-1.5 font-metric text-xs uppercase tracking-wider text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)]"
                      >
                        Instructions
                      </Link>
                      {domain.status === "active" && (
                        <Button variant="danger" onClick={() => void handleArchive(domain.domainId)}>
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

      <Modal
        open={modalOpen}
        title={editing ? "Edit domain" : "Create domain"}
        onClose={() => setModalOpen(false)}
        className="max-w-2xl"
        footer={
          <ModalActions
            onCancel={() => setModalOpen(false)}
            primaryLabel={editing ? "Save changes" : "Create"}
            onPrimary={() => void handleSave()}
            primaryLoading={saving}
          />
        }
      >
        <div className="flex flex-col gap-4">
          <TextField
            label="Domain key"
            value={form.domainKey}
            onChange={(e) => setForm((f) => ({ ...f, domainKey: e.target.value }))}
            disabled={!!editing}
            placeholder="seo"
            hint="Lowercase slug (e.g. seo, inbox). Immutable after creation."
          />
          <TextField
            label="Name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="SEO"
          />
          <TextField
            label="Description"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
          <TextField
            label="Metadata filters"
            value={form.metadataFilters}
            onChange={(e) => setForm((f) => ({ ...f, metadataFilters: e.target.value }))}
            placeholder="seo, website"
            hint="Comma-separated tags applied during domain-scoped retrieval."
          />
          <div className="flex flex-col gap-2">
            <label className="font-metric text-xs uppercase tracking-wider text-[var(--color-text-secondary)]">
              Observation providers
            </label>
            <p className="text-xs text-[var(--color-text-tertiary)]">
              Select providers whose observations are included when this domain scopes retrieval.
            </p>
            <div className="flex flex-wrap gap-2">
              {providers.map((provider) => {
                const selected = form.observationProviderKeys.includes(provider.providerKey);
                return (
                  <button
                    key={provider.providerKey}
                    type="button"
                    disabled={!provider.runnable}
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        observationProviderKeys: selected
                          ? current.observationProviderKeys.filter(
                              (key) => key !== provider.providerKey,
                            )
                          : [...current.observationProviderKeys, provider.providerKey],
                      }))
                    }
                    className={`rounded-md border px-3 py-1.5 text-xs ${
                      selected
                        ? "border-[var(--color-accent)] bg-[var(--color-accent-muted)] text-[var(--color-text-primary)]"
                        : "border-[var(--color-border-default)] text-[var(--color-text-secondary)]"
                    } ${!provider.runnable ? "opacity-50" : "hover:bg-[var(--color-surface-2)]"}`}
                  >
                    {provider.name}
                  </button>
                );
              })}
            </div>
          </div>
          <TextAreaField
            label="Retrieval rules (JSON array)"
            value={form.retrievalRulesJson}
            onChange={(e) => setForm((f) => ({ ...f, retrievalRulesJson: e.target.value }))}
            className="font-mono text-xs"
          />
          <TextAreaField
            label="Relationship constraints (JSON)"
            value={form.relationshipConstraintsJson}
            onChange={(e) =>
              setForm((f) => ({ ...f, relationshipConstraintsJson: e.target.value }))
            }
            className="font-mono text-xs"
          />
        </div>
      </Modal>
    </div>
  );
}
