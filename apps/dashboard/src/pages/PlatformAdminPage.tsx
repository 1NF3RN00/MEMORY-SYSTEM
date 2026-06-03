import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.js";
import { apiGet, apiPost } from "../lib/api.js";
import type { AccessRequest } from "@memory-middleware/shared-types";
import { PageHeader } from "../components/ui/PageHeader.js";
import { Panel } from "../components/ui/Panel.js";
import { Badge } from "../components/ui/Badge.js";

interface ProvisioningResult {
  workspaceId: string;
  rawApiKey: string;
}

export function PlatformAdminPage() {
  const { user, workspace } = useAuth();
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastKey, setLastKey] = useState<ProvisioningResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<{ requests: AccessRequest[] }>("/access/queue?status=pending");
      setRequests(data.requests);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load queue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  async function approve(requestId: string) {
    setError(null);
    try {
      const result = await apiPost<{
        provisioning: ProvisioningResult;
      }>(`/access/queue/${requestId}/approve`, {});
      setLastKey(result.provisioning);
      await loadQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approval failed");
    }
  }

  async function reject(requestId: string) {
    setError(null);
    try {
      await apiPost(`/access/queue/${requestId}/reject`, {});
      await loadQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rejection failed");
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Operational Provisioning"
        lede="Access request queue and controlled workspace initialization. Set PLATFORM_ADMIN_EMAILS on the API after the first approval."
      />

      {!user?.isPlatformAdmin && !loading && !error && requests.length > 0 && (
        <p className="text-sm text-[var(--color-warning)]">
          Bootstrap mode: no platform admin exists yet — you can approve pending requests.
        </p>
      )}

      {workspace && (
        <Panel title="Bootstrap Status">
          <div className="grid grid-cols-2 gap-3 font-mono text-xs md:grid-cols-3">
            {Object.entries(workspace.bootstrap).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between gap-2 border-b border-[var(--color-border-subtle)] py-2">
                <span className="text-[var(--color-text-tertiary)]">{key}</span>
                <Badge variant={value === true ? "success" : value === false ? "warning" : "default"}>
                  {String(value)}
                </Badge>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {lastKey && (
        <Panel title="Provisioned API Key (shown once)">
          <p className="font-mono text-sm text-[var(--color-warning)] break-all">{lastKey.rawApiKey}</p>
          <p className="mt-2 text-xs text-[var(--color-text-tertiary)]">
            Workspace {lastKey.workspaceId} — store securely; this value cannot be retrieved again.
          </p>
        </Panel>
      )}

      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

      <Panel title="Pending Access Requests">
        {loading ? (
          <p className="text-sm text-[var(--color-text-tertiary)]">Loading queue…</p>
        ) : requests.length === 0 ? (
          <p className="text-sm text-[var(--color-text-tertiary)]">No pending requests.</p>
        ) : (
          <ul className="divide-y divide-[var(--color-border-subtle)]">
            {requests.map((req) => (
              <li key={req.requestId} className="flex flex-wrap items-start justify-between gap-4 py-4">
                <div>
                  <p className="font-medium">{req.email}</p>
                  {req.company && (
                    <p className="text-sm text-[var(--color-text-secondary)]">{req.company}</p>
                  )}
                  {req.useCase && (
                    <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">{req.useCase}</p>
                  )}
                  {req.note && (
                    <p className="mt-2 text-xs text-[var(--color-text-muted)]">{req.note}</p>
                  )}
                  <p className="mt-2 font-mono text-[0.625rem] text-[var(--color-text-muted)]">
                    {req.requestId} · {new Date(req.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void approve(req.requestId)}
                    className="rounded-md border border-[var(--color-success)]/40 px-3 py-1.5 font-mono text-[0.625rem] uppercase tracking-wider text-[var(--color-success)] hover:bg-[var(--color-success-soft)]"
                  >
                    Approve & Provision
                  </button>
                  <button
                    type="button"
                    onClick={() => void reject(req.requestId)}
                    className="rounded-md border border-[var(--color-danger)]/40 px-3 py-1.5 font-mono text-[0.625rem] uppercase tracking-wider text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)]"
                  >
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
