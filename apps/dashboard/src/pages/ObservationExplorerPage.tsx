import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { NormalizedObservation } from "@memory-middleware/shared-types";
import { useAuth } from "../context/AuthContext.js";
import { EmptyState } from "../components/domain-engine/EmptyState.js";
import { Badge } from "../components/ui/Badge.js";
import { Button } from "../components/ui/Button.js";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
} from "../components/ui/DataTable.js";
import { PageHeader } from "../components/ui/PageHeader.js";
import { Panel } from "../components/ui/Panel.js";
import { TextAreaField, TextField } from "../components/ui/TextField.js";
import {
  collectObservation,
  fetchObservationMetrics,
  fetchObservationProviders,
  getObservation,
  listObservations,
  type ObservationDetailResult,
  type ObservationProviderSummary,
} from "../lib/domain-engine-api.js";

interface FilterState {
  provider: string;
  category: string;
  metric: string;
  businessId: string;
  collectedAfter: string;
  collectedBefore: string;
}

const emptyFilters: FilterState = {
  provider: "",
  category: "",
  metric: "",
  businessId: "",
  collectedAfter: "",
  collectedBefore: "",
};

function formatObservationValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

function toIsoOrUndefined(value: string): string | undefined {
  if (!value.trim()) return undefined;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return undefined;
  return new Date(parsed).toISOString();
}

export function ObservationExplorerPage() {
  const { workspace } = useAuth();
  const workspaceId = workspace?.workspaceId ?? "";

  const [providers, setProviders] = useState<ObservationProviderSummary[]>([]);
  const [metrics, setMetrics] = useState<
    Awaited<ReturnType<typeof fetchObservationMetrics>>
  >([]);
  const [observations, setObservations] = useState<NormalizedObservation[]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [filters, setFilters] = useState<FilterState>(emptyFilters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ObservationDetailResult | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [collectProvider, setCollectProvider] = useState("website");
  const [collectParamsJson, setCollectParamsJson] = useState(
    JSON.stringify({ url: "https://example.com" }, null, 2),
  );
  const [collecting, setCollecting] = useState(false);
  const [collectMessage, setCollectMessage] = useState<string | null>(null);

  const categoryOptions = useMemo(() => {
    const values = new Set<string>();
    for (const metric of metrics) {
      if (filters.provider && metric.providerKey !== filters.provider) continue;
      values.add(metric.categoryKey);
    }
    return [...values].sort();
  }, [metrics, filters.provider]);

  const metricOptions = useMemo(() => {
    return metrics
      .filter((metric) => {
        if (filters.provider && metric.providerKey !== filters.provider) return false;
        if (filters.category && metric.categoryKey !== filters.category) return false;
        return true;
      })
      .map((metric) => metric.metricKey)
      .sort();
  }, [metrics, filters.provider, filters.category]);

  const loadProviders = useCallback(async () => {
    try {
      const rows = await fetchObservationProviders();
      setProviders(rows);
      if (!collectProvider && rows[0]) {
        setCollectProvider(rows[0].providerKey);
      }
    } catch {
      // Registry may be empty in dev — page still works for listed observations.
    }
  }, [collectProvider]);

  const loadMetrics = useCallback(async () => {
    try {
      setMetrics(await fetchObservationMetrics(filters.provider || undefined));
    } catch {
      setMetrics([]);
    }
  }, [filters.provider]);

  const loadObservations = useCallback(
    async (cursor?: string) => {
      if (!workspaceId) return;
      setLoading(true);
      setError(null);
      try {
        const listFilters: Parameters<typeof listObservations>[1] = { limit: 50 };
        if (filters.provider) listFilters.provider = filters.provider;
        if (filters.category) listFilters.category = filters.category;
        if (filters.metric) listFilters.metric = filters.metric;
        if (filters.businessId.trim()) listFilters.businessId = filters.businessId.trim();
        const collectedAfter = toIsoOrUndefined(filters.collectedAfter);
        if (collectedAfter) listFilters.collectedAfter = collectedAfter;
        const collectedBefore = toIsoOrUndefined(filters.collectedBefore);
        if (collectedBefore) listFilters.collectedBefore = collectedBefore;
        if (cursor) listFilters.cursor = cursor;

        const result = await listObservations(workspaceId, listFilters);
        setObservations((prev) => (cursor ? [...prev, ...result.observations] : result.observations));
        setNextCursor(result.nextCursor);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load observations");
        if (!cursor) setObservations([]);
      } finally {
        setLoading(false);
      }
    },
    [workspaceId, filters],
  );

  useEffect(() => {
    void loadProviders();
  }, [loadProviders]);

  useEffect(() => {
    void loadMetrics();
  }, [loadMetrics]);

  useEffect(() => {
    void loadObservations();
  }, [loadObservations]);

  useEffect(() => {
    if (!workspaceId || !selectedId) {
      setDetail(null);
      return;
    }

    let cancelled = false;
    setDetailLoading(true);
    void getObservation(workspaceId, selectedId)
      .then((result) => {
        if (!cancelled) setDetail(result);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load observation detail");
        }
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceId, selectedId]);

  async function handleCollect() {
    if (!workspaceId) return;
    let params: Record<string, unknown>;
    try {
      const parsed = JSON.parse(collectParamsJson) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Params must be a JSON object");
      }
      params = parsed as Record<string, unknown>;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid params JSON");
      return;
    }

    setCollecting(true);
    setCollectMessage(null);
    setError(null);
    try {
      const result = await collectObservation(collectProvider, { workspaceId, params });
      setCollectMessage(
        `Collected ${result.observationCount} observation(s) from ${result.providerKey}.`,
      );
      setSelectedId(result.observationIds[0] ?? null);
      await loadObservations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Collection failed");
    } finally {
      setCollecting(false);
    }
  }

  const runnableProviders = providers.filter((provider) => provider.runnable);

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        code="OBSERVATIONS"
        title="Observation Explorer"
        lede="Browse normalized provider observations stored as memories. Filter by provider, category, and metric, or trigger collection from registered providers."
      />

      {error && (
        <Panel code="ERROR" title="Request failed">
          <p className="text-sm text-[var(--color-status-error)]">{error}</p>
        </Panel>
      )}

      {collectMessage && (
        <Panel code="COLLECT" title="Collection complete">
          <p className="text-sm text-[var(--color-text-secondary)]">{collectMessage}</p>
        </Panel>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-6">
          <Panel code="FILTERS" title="Filters">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-[var(--color-text-tertiary)]">Provider</span>
                <select
                  className="rounded-md border border-[var(--color-border-default)] bg-[var(--color-surface-2)] px-3 py-2"
                  value={filters.provider}
                  onChange={(event) =>
                    setFilters((prev) => ({
                      ...prev,
                      provider: event.target.value,
                      category: "",
                      metric: "",
                    }))
                  }
                >
                  <option value="">All providers</option>
                  {providers.map((provider) => (
                    <option key={provider.providerKey} value={provider.providerKey}>
                      {provider.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span className="text-[var(--color-text-tertiary)]">Category</span>
                <select
                  className="rounded-md border border-[var(--color-border-default)] bg-[var(--color-surface-2)] px-3 py-2"
                  value={filters.category}
                  onChange={(event) =>
                    setFilters((prev) => ({ ...prev, category: event.target.value, metric: "" }))
                  }
                >
                  <option value="">All categories</option>
                  {categoryOptions.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span className="text-[var(--color-text-tertiary)]">Metric</span>
                <select
                  className="rounded-md border border-[var(--color-border-default)] bg-[var(--color-surface-2)] px-3 py-2"
                  value={filters.metric}
                  onChange={(event) =>
                    setFilters((prev) => ({ ...prev, metric: event.target.value }))
                  }
                >
                  <option value="">All metrics</option>
                  {metricOptions.map((metric) => (
                    <option key={metric} value={metric}>
                      {metric}
                    </option>
                  ))}
                </select>
              </label>

              <TextField
                label="Business ID"
                value={filters.businessId}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, businessId: event.target.value }))
                }
              />

              <TextField
                label="Collected after"
                type="datetime-local"
                value={filters.collectedAfter}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, collectedAfter: event.target.value }))
                }
              />

              <TextField
                label="Collected before"
                type="datetime-local"
                value={filters.collectedBefore}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, collectedBefore: event.target.value }))
                }
              />
            </div>

            <div className="mt-4 flex gap-2">
              <Button variant="secondary" onClick={() => setFilters(emptyFilters)}>
                Clear filters
              </Button>
              <Button onClick={() => void loadObservations()} disabled={loading || !workspaceId}>
                Refresh
              </Button>
            </div>
          </Panel>

          <Panel code="TABLE" title="Observations" noPadding>
            {loading && observations.length === 0 ? (
              <p className="px-6 py-8 text-sm text-[var(--color-text-tertiary)]">Loading…</p>
            ) : observations.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  title="No observations yet"
                  description="This workspace has no matching observations. Use the collection form to run the website provider, or ingest observations via the API."
                />
              </div>
            ) : (
              <DataTable>
                <DataTableHead>
                  <DataTableRow>
                    <DataTableHeaderCell>Provider</DataTableHeaderCell>
                    <DataTableHeaderCell>Category</DataTableHeaderCell>
                    <DataTableHeaderCell>Metric</DataTableHeaderCell>
                    <DataTableHeaderCell>Value</DataTableHeaderCell>
                    <DataTableHeaderCell>Source</DataTableHeaderCell>
                    <DataTableHeaderCell>Collected</DataTableHeaderCell>
                    <DataTableHeaderCell>Business</DataTableHeaderCell>
                  </DataTableRow>
                </DataTableHead>
                <DataTableBody>
                  {observations.map((observation) => (
                    <DataTableRow
                      key={observation.observationId}
                      onClick={() => setSelectedId(observation.observationId)}
                      {...(selectedId === observation.observationId
                        ? { className: "bg-[var(--color-surface-3)]" }
                        : {})}
                    >
                      <DataTableCell>
                        <Badge>{observation.provider}</Badge>
                      </DataTableCell>
                      <DataTableCell>{observation.category}</DataTableCell>
                      <DataTableCell>{observation.metric}</DataTableCell>
                      <DataTableCell className="max-w-[12rem] truncate font-mono text-xs">
                        {formatObservationValue(observation.value)}
                        {observation.unit ? ` ${observation.unit}` : ""}
                      </DataTableCell>
                      <DataTableCell className="max-w-[10rem] truncate">
                        {observation.sourceLabel ?? observation.source}
                      </DataTableCell>
                      <DataTableCell>
                        {new Date(observation.collectedAt).toLocaleString()}
                      </DataTableCell>
                      <DataTableCell>{observation.businessId ?? "—"}</DataTableCell>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
            )}

            {nextCursor && (
              <div className="border-t border-[var(--color-border-default)] px-6 py-4">
                <Button variant="secondary" onClick={() => void loadObservations(nextCursor)}>
                  Load more
                </Button>
              </div>
            )}
          </Panel>
        </div>

        <div className="flex flex-col gap-6">
          <Panel code="DETAIL" title="Observation detail">
            {!selectedId ? (
              <p className="text-sm text-[var(--color-text-tertiary)]">
                Select a row to view the normalized observation and memory lineage.
              </p>
            ) : detailLoading ? (
              <p className="text-sm text-[var(--color-text-tertiary)]">Loading detail…</p>
            ) : detail ? (
              <div className="flex flex-col gap-4">
                <pre className="max-h-72 overflow-auto rounded-md bg-[var(--color-surface-1)] p-3 text-xs text-[var(--color-text-secondary)]">
                  {JSON.stringify(detail.observation, null, 2)}
                </pre>
                <div className="flex flex-col gap-2 text-sm">
                  <p>
                    <span className="text-[var(--color-text-tertiary)]">Memory: </span>
                    <Link
                      to={`/memory/${detail.lineage.memoryId}`}
                      className="text-[var(--color-accent-primary)] hover:underline"
                    >
                      {detail.lineage.memoryTitle}
                    </Link>
                  </p>
                  <p>
                    <span className="text-[var(--color-text-tertiary)]">Stored: </span>
                    {new Date(detail.lineage.createdAt).toLocaleString()}
                  </p>
                  {detail.lineage.ingestionTraceId && (
                    <p>
                      <span className="text-[var(--color-text-tertiary)]">Ingestion trace: </span>
                      <Link
                        to={`/ingestion/${detail.lineage.ingestionTraceId}`}
                        className="text-[var(--color-accent-primary)] hover:underline"
                      >
                        {detail.lineage.ingestionTraceId}
                      </Link>
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-[var(--color-text-tertiary)]">Detail unavailable.</p>
            )}
          </Panel>

          <Panel code="COLLECT" title="Trigger collection">
            <div className="flex flex-col gap-4">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-[var(--color-text-tertiary)]">Provider</span>
                <select
                  className="rounded-md border border-[var(--color-border-default)] bg-[var(--color-surface-2)] px-3 py-2"
                  value={collectProvider}
                  onChange={(event) => setCollectProvider(event.target.value)}
                >
                  {(runnableProviders.length > 0 ? runnableProviders : providers).map(
                    (provider) => (
                      <option key={provider.providerKey} value={provider.providerKey}>
                        {provider.name}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <TextAreaField
                label="Params (JSON)"
                value={collectParamsJson}
                onChange={(event) => setCollectParamsJson(event.target.value)}
                rows={6}
              />
              <p className="text-xs text-[var(--color-text-muted)]">
                Website provider expects {"{"}"url":"https://..."{"}"}.
              </p>

              <Button onClick={() => void handleCollect()} disabled={collecting || !workspaceId}>
                {collecting ? "Collecting…" : "Run collection"}
              </Button>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
