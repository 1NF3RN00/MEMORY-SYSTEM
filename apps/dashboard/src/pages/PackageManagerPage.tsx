import { useCallback, useEffect, useRef, useState } from "react";
import type {
  InstalledPackage,
  PackageDefinitionRecord,
  PackageManifest,
  PackageManifestDiff,
} from "@memory-middleware/shared-types";
import { useAuth } from "../context/AuthContext.js";
import {
  archiveInstalledPackageApi,
  comparePackageApi,
  downloadJson,
  exportPackageApi,
  fetchCatalogPackages,
  fetchInstalledPackages,
  installPackageApi,
  installPackageByKeyApi,
} from "../lib/domain-engine-api.js";
import { EmptyState } from "../components/domain-engine/EmptyState.js";
import { PackageDiffView } from "../components/domain-engine/PackageDiffView.js";
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
import { PageHeader } from "../components/ui/PageHeader.js";
import { Panel } from "../components/ui/Panel.js";

export function PackageManagerPage() {
  const { workspace } = useAuth();
  const workspaceId = workspace?.workspaceId ?? "";
  const fileInputRef = useRef<HTMLInputElement>(null);
  const compareInputRef = useRef<HTMLInputElement>(null);
  const [packages, setPackages] = useState<InstalledPackage[]>([]);
  const [catalog, setCatalog] = useState<PackageDefinitionRecord[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [diff, setDiff] = useState<PackageManifestDiff | null>(null);
  const [compareTargetId, setCompareTargetId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [skipConflicts, setSkipConflicts] = useState(false);

  const fetchWithRetry = useCallback(async <T,>(fn: () => Promise<T>, attempts = 3): Promise<T> => {
    let lastError: unknown;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;
        const message = err instanceof Error ? err.message : String(err);
        const transient =
          message === "Failed to fetch" || /^(502|503|504):/.test(message);
        if (!transient || attempt === attempts - 1) break;
        await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
      }
    }
    throw lastError;
  }, []);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      setPackages(await fetchWithRetry(() => fetchInstalledPackages(workspaceId)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load packages");
    } finally {
      setLoading(false);
    }
  }, [workspaceId, fetchWithRetry]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    setCatalogLoading(true);
    setCatalogError(null);
    void fetchWithRetry(() => fetchCatalogPackages())
      .then((rows) => {
        if (!cancelled) setCatalog(rows);
      })
      .catch((err) => {
        if (!cancelled) {
          setCatalogError(
            err instanceof Error ? err.message : "Failed to load package catalog",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setCatalogLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchWithRetry]);

  const activePackageKeys = new Set(
    packages.filter((pkg) => pkg.status === "active").map((pkg) => pkg.packageKey),
  );

  async function handleExport(installedPackageId: string, packageKey: string) {
    if (!workspaceId) return;
    setBusy(true);
    setError(null);
    try {
      const manifest = await exportPackageApi(workspaceId, installedPackageId);
      downloadJson(`${packageKey}-export.json`, manifest);
      setMessage(`Exported ${packageKey}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleInstallFromFile(file: File) {
    if (!workspaceId) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const text = await file.text();
      const manifest = JSON.parse(text) as PackageManifest;
      const installed = await installPackageApi(workspaceId, manifest, !skipConflicts);
      setMessage(
        skipConflicts
          ? `Installed ${installed.packageKey} v${installed.installedVersion}. Keys that conflicted with existing packages were skipped.`
          : `Installed ${installed.packageKey} v${installed.installedVersion}`,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Install failed");
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function triggerInstall() {
    fileInputRef.current?.click();
  }

  function triggerCompare(installedPackageId: string) {
    setCompareTargetId(installedPackageId);
    setDiff(null);
    compareInputRef.current?.click();
  }

  async function handleCompareFromFile(file: File) {
    if (!workspaceId || !compareTargetId) return;
    setBusy(true);
    setError(null);
    try {
      const text = await file.text();
      const manifest = JSON.parse(text) as PackageManifest;
      const result = await comparePackageApi(workspaceId, compareTargetId, manifest);
      setDiff(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Compare failed");
    } finally {
      setBusy(false);
      if (compareInputRef.current) compareInputRef.current.value = "";
    }
  }

  async function handleInstallFromCatalog(packageKey: string) {
    if (!workspaceId) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const installed = await installPackageByKeyApi(workspaceId, packageKey, !skipConflicts);
      setMessage(
        skipConflicts
          ? `Installed ${installed.packageKey} v${installed.installedVersion}. Keys that conflicted with existing packages were skipped.`
          : `Installed ${installed.packageKey} v${installed.installedVersion}`,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Install failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleArchive(installedPackageId: string) {
    if (!workspaceId || !confirm("Archive this installed package?")) return;
    setError(null);
    try {
      await archiveInstalledPackageApi(workspaceId, installedPackageId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Archive failed");
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        code="PACKAGES"
        title="Package Manager"
        lede="Install, export, and compare operational intelligence bundles. Updates are manual: export → compare → install."
        action={
          <Button onClick={triggerInstall} disabled={!workspaceId || busy}>
            Install from manifest
          </Button>
        }
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleInstallFromFile(file);
        }}
      />
      <input
        ref={compareInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleCompareFromFile(file);
        }}
      />

      <label className="flex max-w-2xl items-start gap-2 text-sm text-[var(--color-text-secondary)]">
        <input
          type="checkbox"
          checked={skipConflicts}
          onChange={(e) => setSkipConflicts(e.target.checked)}
          className="mt-1"
        />
        <span>
          Skip conflicting keys — install domains, facts, and instructions that do not collide with
          packages already in this workspace (e.g. when a second bundle reuses{" "}
          <code className="text-[var(--color-accent)]">website</code> +{" "}
          <code className="text-[var(--color-accent)]">audit</code>).
        </span>
      </label>

      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
      {message && <p className="text-sm text-[var(--color-success)]">{message}</p>}

      <Panel title="Local package catalog">
        {catalogError && (
          <p className="mb-3 text-sm text-[var(--color-danger)]">{catalogError}</p>
        )}
        {catalogLoading ? (
          <p className="text-sm text-[var(--color-text-tertiary)]">Loading catalog…</p>
        ) : catalog.length === 0 && !catalogError ? (
          <p className="text-sm text-[var(--color-text-secondary)]">
            No catalog entries yet. From the repo root run{" "}
            <code className="text-[var(--color-accent)]">npm run package-catalog:seed</code> while
            the API is running locally.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {catalog.map((entry) => {
              const installed = activePackageKeys.has(entry.packageKey);
              return (
                <div
                  key={entry.packageDefinitionId}
                  className="rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{entry.name}</p>
                      <p className="font-mono text-xs text-[var(--color-text-tertiary)]">
                        {entry.packageKey} · v{entry.version}
                      </p>
                      {entry.description && (
                        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                          {entry.description}
                        </p>
                      )}
                    </div>
                    <Button
                      disabled={!workspaceId || busy || installed}
                      onClick={() => void handleInstallFromCatalog(entry.packageKey)}
                    >
                      {installed ? "Installed" : "Install"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      <Panel title="Installed packages">
        {loading ? (
          <p className="text-sm text-[var(--color-text-tertiary)]">Loading…</p>
        ) : packages.length === 0 ? (
          <EmptyState
            title="No packages installed"
            description="Upload a package manifest JSON to install domains, facts, instructions, and retrieval rules in one operation."
            action={
              <Button onClick={triggerInstall} disabled={busy}>
                Install from manifest
              </Button>
            }
          />
        ) : (
          <DataTable>
            <DataTableHead>
              <DataTableHeaderCell>Package</DataTableHeaderCell>
              <DataTableHeaderCell>Version</DataTableHeaderCell>
              <DataTableHeaderCell>Snapshot</DataTableHeaderCell>
              <DataTableHeaderCell>Status</DataTableHeaderCell>
              <DataTableHeaderCell>Installed</DataTableHeaderCell>
              <DataTableHeaderCell>Actions</DataTableHeaderCell>
            </DataTableHead>
            <DataTableBody>
              {packages.map((pkg) => (
                <DataTableRow key={pkg.installedPackageId}>
                  <DataTableCell mono>{pkg.packageKey}</DataTableCell>
                  <DataTableCell mono>{pkg.installedVersion}</DataTableCell>
                  <DataTableCell mono className="max-w-[140px] truncate">
                    {pkg.snapshotVersion}
                  </DataTableCell>
                  <DataTableCell>
                    <Badge variant={statusToBadge(pkg.status)}>{pkg.status}</Badge>
                  </DataTableCell>
                  <DataTableCell mono>
                    {new Date(pkg.installedAt).toLocaleString()}
                  </DataTableCell>
                  <DataTableCell>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        disabled={busy}
                        onClick={() =>
                          void handleExport(pkg.installedPackageId, pkg.packageKey)
                        }
                      >
                        Export
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={busy}
                        onClick={() => triggerCompare(pkg.installedPackageId)}
                      >
                        Compare
                      </Button>
                      {pkg.status === "active" && (
                        <Button
                          variant="danger"
                          onClick={() => void handleArchive(pkg.installedPackageId)}
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

      {diff && <PackageDiffView diff={diff} />}
    </div>
  );
}
