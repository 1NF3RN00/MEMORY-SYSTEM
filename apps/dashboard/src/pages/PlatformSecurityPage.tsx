import { useEffect, useState } from "react";
import { apiGet } from "../lib/api.js";
import { PageHeader } from "../components/ui/PageHeader.js";
import { Panel } from "../components/ui/Panel.js";

interface SecurityEventRow {
  id: string;
  eventType: string;
  severity: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export function PlatformSecurityPage() {
  const [events, setEvents] = useState<SecurityEventRow[]>([]);

  useEffect(() => {
    void apiGet<{ events: SecurityEventRow[] }>("/platform/security-events?limit=100").then((data) =>
      setEvents(data.events),
    );
  }, []);

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Security Events"
        lede="Auth failures, permission denials, and key violations"
      />
      <Panel title="Audit Stream">
        <ul className="divide-y divide-[var(--color-border-subtle)] font-mono text-xs">
          {events.map((e) => (
            <li key={e.id} className="py-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-[var(--color-accent)]">{e.eventType}</span>
                <span className="text-[var(--color-text-tertiary)]">{e.severity}</span>
                <span className="text-[var(--color-text-muted)]">
                  {new Date(e.createdAt).toLocaleString()}
                </span>
              </div>
              <pre className="mt-2 overflow-x-auto text-[var(--color-text-secondary)]">
                {JSON.stringify(e.metadata, null, 2)}
              </pre>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
