import { useCallback, useEffect, useRef, useState } from "react";
import type { InstalledPackage, PackageManifest, PackageManifestDiff } from "@memory-middleware/shared-types";
import { useAuth } from "../context/AuthContext.js";
import {
  archiveInstalledPackageApi,
  comparePackageApi,
  downloadJson,
  exportPackageApi,
  fetchInstalledPackages,
  installPackageApi,
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [diff, setDiff] = useState<PackageManifestDiff | null>(null);
  const [compareTargetId, setCompareTargetId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      setPackages(await fetchInstalledPackages(workspaceId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load packages");
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

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
      const installed = await installPackageApi(workspaceId, manifest);
      setMessage(`Installed ${installed.packageKey} v${installed.installedVersion}`);
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

      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
      {message && <p className="text-sm text-[var(--color-success)]">{message}</p>}

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
