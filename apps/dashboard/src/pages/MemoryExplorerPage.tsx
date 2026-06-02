import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { apiDelete, apiGet, apiPost } from "../lib/api.js";
import { StatusPanel } from "../components/StatusPanel.js";
import { StructuralPanels } from "../components/StructuralPanels.js";
import { Button } from "../components/ui/Button.js";
import { CheckboxField } from "../components/ui/CheckboxField.js";
import { PageHeader } from "../components/ui/PageHeader.js";
import { Panel } from "../components/ui/Panel.js";
import { Badge } from "../components/ui/Badge.js";
import { MetricCell, MetricStrip } from "../components/ui/MetricCell.js";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
} from "../components/ui/DataTable.js";
import { MemoryLineageGraph } from "../components/observability/RetrievalHeatmap.js";
import { staggerContainer, staggerItem } from "../design-system/motion.js";

interface MemoryChunk {
  id: string;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  embeddingStatus: string;
  semanticDensityScore?: number;
  metadata: {
    chunkingStrategy: string;
    overlapPrevious?: boolean;
    overlapNext?: boolean;
    heading?: string;
    lineage?: {
      sectionPath: string[];
      headingHierarchy: string[];
    };
    densityDetail?: {
      combinedScore: number;
      rankingInfluence: number;
    };
  };
}

interface MemorySummary {
  id: string;
  title: string;
  memoryType: string;
  sourceType: string;
  persistenceMode: string;
  archived: boolean;
  retrievalEligible: boolean;
  ingestionStatus: string;
  chunkCount: number;
  createdAt: string;
  archivedAt?: string;
}

interface MemoryDetail {
  memory: {
    id: string;
    title: string;
    sourceType: string;
    persistenceMode: string;
    normalizedContent: string;
    metadata: Record<string, unknown>;
    archivedAt?: string;
    observability: {
      chunkCount: number;
      tokenCount: number;
      retrievalEligible: boolean;
      archived: boolean;
    };
    chunks: MemoryChunk[];
  };
}

export function MemoryExplorerPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const deletedMessage = (location.state as { message?: string } | null)?.message;

  const [data, setData] = useState<MemoryDetail | null>(null);
  const [memories, setMemories] = useState<MemorySummary[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [selectedChunk, setSelectedChunk] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [lifecycleMessage, setLifecycleMessage] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [archiving, setArchiving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadMemory = useCallback(async (memoryId: string) => {
    const result = await apiGet<MemoryDetail>(`/memory/${memoryId}`);
    setData(result);
    return result;
  }, []);

  useEffect(() => {
    apiGet<{ id: string }>("/workspaces/default")
      .then((ws) => setWorkspaceId(ws.id))
      .catch(() => setWorkspaceId(null));
  }, []);

  useEffect(() => {
    if (id) {
      setLoading(true);
      setError(null);
      loadMemory(id)
        .catch((e: Error) => setError(e.message))
        .finally(() => setLoading(false));
      return;
    }

    if (!workspaceId) return;

    setLoading(true);
    setError(null);
    apiGet<{ memories: MemorySummary[] }>(
      `/memory?workspaceId=${workspaceId}&limit=50&includeArchived=${includeArchived}`,
    )
      .then((result) => setMemories(result.memories))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id, workspaceId, includeArchived, loadMemory]);

  async function handleArchive() {
    if (!id || !data) return;

    const confirmed = window.confirm(
      "Archive this memory?\n\nIt will be removed from retrieval but kept for replay and observability.",
    );
    if (!confirmed) return;

    setArchiving(true);
    setLifecycleMessage(null);
    setError(null);
    try {
      const result = await apiPost<{ message: string }>(`/memory/${id}/archive`, {
        reason: "dashboard_manual_archive",
      });
      setLifecycleMessage(result.message);
      await loadMemory(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setArchiving(false);
    }
  }

  async function handleFullDelete() {
    if (!id) return;

    setDeleting(true);
    setLifecycleMessage(null);
    setError(null);
    try {
      const result = await apiDelete<{ message: string }>(`/memory/${id}`, {
        confirm: true,
        reason: "dashboard_manual_delete",
      });
      navigate("/memory", {
        replace: true,
        state: { message: result.message },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
      setDeleteConfirmText("");
    }
  }

  if (!id) {
    if (loading) {
      return <StatusPanel title="Loading memories…" loading />;
    }

    return (
      <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="max-w-[1200px]">
        <motion.div variants={staggerItem}>
          <PageHeader
            code="MEM.03"
            title="Memory Explorer"
            lede="Browse workspace-scoped memory objects — inspect chunks, metadata, lineage, and lifecycle controls."
          />
        </motion.div>

        {deletedMessage && (
          <motion.p variants={staggerItem} className="mb-4 rounded-md border border-[rgba(74,222,128,0.2)] bg-[var(--color-success-soft)] px-3 py-2 font-metric text-xs text-[var(--color-success)]">
            {deletedMessage}
          </motion.p>
        )}
        {error && (
          <motion.p variants={staggerItem} className="mb-4 font-metric text-xs text-[var(--color-danger)]">{error}</motion.p>
        )}

        <motion.div variants={staggerItem} className="mb-6">
          <MetricStrip columns={3}>
            <MetricCell label="Total Objects" value={memories.length} accent />
            <MetricCell label="Active" value={memories.filter((m) => m.retrievalEligible && !m.archived).length} />
            <MetricCell label="Archived" value={memories.filter((m) => m.archived).length} />
          </MetricStrip>
        </motion.div>

        <motion.div variants={staggerItem}>
          <Panel
            code="MEM.LIST"
            title="Workspace Memories"
            description="Operational assets indexed for contextual retrieval."
            headerAction={
              <CheckboxField label="Show archived" checked={includeArchived} onChange={setIncludeArchived} />
            }
          >
            {memories.length === 0 ? (
              <p className="text-sm text-[var(--color-text-tertiary)]">No memories found. Ingest content to populate the store.</p>
            ) : (
              <DataTable>
                <DataTableHead>
                  <DataTableHeaderCell>Title</DataTableHeaderCell>
                  <DataTableHeaderCell>Type</DataTableHeaderCell>
                  <DataTableHeaderCell>Source</DataTableHeaderCell>
                  <DataTableHeaderCell>Chunks</DataTableHeaderCell>
                  <DataTableHeaderCell>Status</DataTableHeaderCell>
                  <DataTableHeaderCell>Created</DataTableHeaderCell>
                </DataTableHead>
                <DataTableBody>
                  {memories.map((m) => (
                    <DataTableRow key={m.id}>
                      <DataTableCell>
                        <Link to={`/memory/${m.id}`} className="font-medium text-[var(--color-text-primary)] no-underline hover:text-[var(--color-accent)]">
                          {m.title || m.id.slice(0, 12)}
                        </Link>
                      </DataTableCell>
                      <DataTableCell mono>{m.memoryType}</DataTableCell>
                      <DataTableCell mono>{m.sourceType}</DataTableCell>
                      <DataTableCell mono>{m.chunkCount}</DataTableCell>
                      <DataTableCell>
                        {m.archived ? (
                          <Badge variant="danger">archived</Badge>
                        ) : m.retrievalEligible ? (
                          <Badge variant="success">active</Badge>
                        ) : (
                          <Badge>inactive</Badge>
                        )}
                      </DataTableCell>
                      <DataTableCell mono>{new Date(m.createdAt).toLocaleString()}</DataTableCell>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
            )}
          </Panel>
        </motion.div>
      </motion.div>
    );
  }

  if (loading) {
    return <StatusPanel title="Loading memory…" loading />;
  }

  if (error && !data) {
    return (
      <div className="max-w-[1200px]">
        <Link to="/memory" className="mb-4 inline-flex font-metric text-[0.625rem] uppercase tracking-[0.06em] text-[var(--color-text-tertiary)] no-underline hover:text-[var(--color-accent)]">
          ← Memory Explorer
        </Link>
        <StatusPanel title="Memory not found" description={error} />
      </div>
    );
  }

  if (!data) {
    return <StatusPanel title="Loading memory…" />;
  }

  const { memory } = data;
  const chunk = memory.chunks[selectedChunk];
  const isArchived = memory.observability.archived;

  const lineageRoot = {
    id: memory.id,
    label: memory.title || memory.id.slice(0, 12),
    type: "memory" as const,
    children: memory.chunks.slice(0, 5).map((c) => ({
      id: c.id,
      label: `#${c.chunkIndex} · ${c.tokenCount} tokens`,
      type: "chunk" as const,
      ...(c.metadata.lineage?.sectionPath.length
        ? {
            children: c.metadata.lineage.sectionPath.map((section, i) => ({
              id: `${c.id}-section-${i}`,
              label: section,
              type: "source" as const,
            })),
          }
        : {}),
    })),
  };

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="max-w-[1200px]">
      <motion.div variants={staggerItem}>
        <Link to="/memory" className="mb-4 inline-flex font-metric text-[0.625rem] uppercase tracking-[0.06em] text-[var(--color-text-tertiary)] no-underline hover:text-[var(--color-accent)]">
          ← Memory Explorer
        </Link>
        <PageHeader
          code="MEM.DETAIL"
          title={memory.title}
          lede={`${memory.sourceType} · ${memory.persistenceMode}${isArchived ? " · archived" : ""}`}
          action={
            <Badge variant={isArchived ? "danger" : memory.observability.retrievalEligible ? "success" : "default"}>
              {isArchived ? "archived" : memory.observability.retrievalEligible ? "retrieval eligible" : "inactive"}
            </Badge>
          }
        />
      </motion.div>

      <motion.div variants={staggerItem} className="mb-6">
        <MetricStrip columns={4}>
          <MetricCell label="Chunks" value={memory.observability.chunkCount} />
          <MetricCell label="Tokens" value={memory.observability.tokenCount.toLocaleString()} accent />
          <MetricCell label="Source" value={memory.sourceType} />
          <MetricCell label="Persistence" value={memory.persistenceMode} />
        </MetricStrip>
      </motion.div>

      <motion.div variants={staggerItem} className="mb-4">
        <Panel code="MEM.LINEAGE" title="Memory Lineage" description="Structural hierarchy from source to indexed chunks.">
          <MemoryLineageGraph root={lineageRoot} />
        </Panel>
      </motion.div>

      <motion.div variants={staggerItem} className="mb-4">
        <Panel code="MEM.LIFE" title="Lifecycle Controls" description="Archive preserves lineage and replay history. Full delete is irreversible.">
          {lifecycleMessage && (
            <p className="mb-3 rounded-md border border-[rgba(74,222,128,0.2)] bg-[var(--color-success-soft)] px-3 py-2 font-metric text-xs text-[var(--color-success)]">
              {lifecycleMessage}
            </p>
          )}
          {error && <p className="mb-3 font-metric text-xs text-[var(--color-danger)]">{error}</p>}

          <div className="flex flex-wrap items-start gap-3">
            <Button onClick={() => void handleArchive()} disabled={archiving || deleting || isArchived} loading={archiving}>
              {isArchived ? "Already archived" : "Archive"}
            </Button>

            {!showDeleteConfirm ? (
              <Button variant="danger" onClick={() => setShowDeleteConfirm(true)} disabled={archiving || deleting}>
                Full delete
              </Button>
            ) : (
              <div className="rounded-md border border-[rgba(248,113,113,0.2)] bg-[var(--color-danger-soft)] p-4">
                <p className="mb-2 text-xs text-[var(--color-danger)]">
                  Permanent deletion cannot be undone. Type <strong>DELETE</strong> to confirm.
                </p>
                <input
                  type="text"
                  className="mb-2 w-full rounded-md border border-[rgba(248,113,113,0.3)] bg-[var(--color-surface-2)] px-3 py-2 font-metric text-sm text-[var(--color-text-primary)] focus:outline-none"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="DELETE"
                />
                <div className="flex gap-2">
                  <Button variant="danger" onClick={() => void handleFullDelete()} disabled={deleting || deleteConfirmText !== "DELETE"} loading={deleting}>
                    Confirm delete
                  </Button>
                  <Button variant="secondary" onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(""); }} disabled={deleting}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Panel>
      </motion.div>

      <motion.div variants={staggerItem} className="mb-4">
        <Panel code="MEM.CHUNKS" title={`Chunk Inspector (${memory.chunks.length})`} description="Select a chunk to inspect content, strategy, and density scores.">
          <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-[220px_1fr]">
            <div className="flex max-h-[480px] flex-col gap-1 overflow-y-auto">
              {memory.chunks.map((c, index) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedChunk(index)}
                  className={`rounded-md border px-3 py-2 text-left font-metric text-[0.6875rem] transition-colors ${
                    index === selectedChunk
                      ? "border-[rgba(56,189,248,0.3)] bg-[var(--color-accent-muted)] text-[var(--color-accent)]"
                      : "border-[var(--color-border-subtle)] text-[var(--color-text-tertiary)] hover:border-[var(--color-border-default)] hover:text-[var(--color-text-secondary)]"
                  }`}
                >
                  #{c.chunkIndex} · {c.tokenCount} tok · {c.embeddingStatus}
                </button>
              ))}
            </div>
            {chunk && (
              <div>
                <p className="mb-2 text-xs text-[var(--color-text-secondary)]">
                  Strategy: {chunk.metadata.chunkingStrategy}
                  {chunk.metadata.heading && ` · ${chunk.metadata.heading}`}
                  {chunk.semanticDensityScore !== undefined && ` · density ${chunk.semanticDensityScore.toFixed(2)}`}
                </p>
                <pre className="max-h-[420px] overflow-auto rounded-md border border-[var(--color-border-default)] bg-[var(--color-surface-0)] p-4 font-metric text-xs leading-relaxed text-[var(--color-text-secondary)]">
                  {chunk.content}
                </pre>
              </div>
            )}
          </div>
        </Panel>
      </motion.div>

      <motion.div variants={staggerItem} className="mb-4">
        <Panel code="MEM.META" title="Metadata">
          <pre className="max-h-[300px] overflow-auto rounded-md border border-[var(--color-border-default)] bg-[var(--color-surface-0)] p-4 font-metric text-xs text-[var(--color-text-secondary)]">
            {JSON.stringify(memory.metadata, null, 2)}
          </pre>
        </Panel>
      </motion.div>

      <motion.div variants={staggerItem}>
        <StructuralPanels memoryId={memory.id} />
      </motion.div>
    </motion.div>
  );
}
