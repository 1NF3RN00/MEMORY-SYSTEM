import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost } from "../lib/api.js";
import type { ApiKeyRecord } from "@memory-middleware/shared-types";
import { PageHeader } from "../components/ui/PageHeader.js";
import { Panel } from "../components/ui/Panel.js";
import { Badge } from "../components/ui/Badge.js";

export function PlatformApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeyRecord[]>([]);
  const [revealed, setRevealed] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await apiGet<{ keys: ApiKeyRecord[] }>("/platform/api-keys");
    setKeys(data.keys);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createKey() {
    const result = await apiPost<{ rawApiKey: string }>("/platform/api-keys", {
      name: "Operational Key",
    });
    setRevealed(result.rawApiKey);
    await load();
  }

  async function revoke(id: string) {
    await apiPost(`/platform/api-keys/${id}/revoke`, {});
    await load();
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="API Key Management"
        lede="Middleware credentials — hashed at rest, shown once on create"
      />
      {revealed && (
        <Panel title="New Key (copy now)">
          <p className="font-mono text-sm text-[var(--color-warning)] break-all">{revealed}</p>
        </Panel>
      )}
      <div>
        <button
          type="button"
          onClick={() => void createKey()}
          className="rounded-md border border-[var(--color-accent)]/40 px-4 py-2 font-mono text-xs uppercase tracking-wider text-[var(--color-accent)]"
        >
          Generate Key
        </button>
      </div>
      <Panel title="Workspace Keys">
        <ul className="divide-y divide-[var(--color-border-subtle)]">
          {keys.map((k) => (
            <li key={k.id} className="flex items-center justify-between py-3 text-sm">
              <div>
                <p className="font-medium">{k.name}</p>
                <p className="font-mono text-xs text-[var(--color-text-tertiary)]">
                  {(k as ApiKeyRecord & { keyPrefix?: string }).keyPrefix ?? k.id.slice(0, 12)}…
                </p>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                  {k.permissions.join(" · ")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={k.revoked ? "danger" : "success"}>{k.revoked ? "revoked" : "active"}</Badge>
                {!k.revoked && (
                  <button
                    type="button"
                    onClick={() => void revoke(k.id)}
                    className="font-mono text-[0.625rem] uppercase text-[var(--color-danger)]"
                  >
                    Revoke
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
