import { useState, type ReactNode } from "react";
import type {
  ExecutionTimingAudit,
  LlmCallAudit,
  RetrievalDbObservability,
} from "@memory-middleware/shared-types";
import { Badge } from "../ui/Badge.js";
import { MetricCell, MetricStrip } from "../ui/MetricCell.js";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
} from "../ui/DataTable.js";
import { cn } from "../../lib/cn.js";
import { formatDurationMs } from "../../lib/timelineTiming.js";
import { RetrievalTimeline } from "./RetrievalTimeline.js";
import {
  buildObservabilitySummary,
  formatCostUsd,
  formatTimingSummary,
  hasDbData,
  hasLlmData,
  hasTimingData,
  type ObservabilitySubview,
  type TraceObservabilityInput,
} from "../../lib/traceObservability.js";

interface TraceObservabilityPanelProps extends TraceObservabilityInput {
  traceId: string;
  className?: string;
  initialSubview?: ObservabilitySubview;
  highlight?: boolean;
}

const SUBVIEW_OPTIONS: Array<{ id: ObservabilitySubview | "all"; label: string }> = [
  { id: "all", label: "All" },
  { id: "timing", label: "Timing" },
  { id: "llm", label: "LLM" },
  { id: "db", label: "Database" },
];

export function TraceObservabilityPanel({
  traceId,
  stages,
  timingAudit,
  legacyTotalLatencyMs,
  llmCallAudit,
  dbObservability,
  className,
  initialSubview,
  highlight,
}: TraceObservabilityPanelProps) {
  const [activeSubview, setActiveSubview] = useState<ObservabilitySubview | "all">(
    initialSubview ?? "all",
  );

  const input: TraceObservabilityInput = {
    ...(stages ? { stages } : {}),
    ...(timingAudit ? { timingAudit } : {}),
    ...(legacyTotalLatencyMs != null ? { legacyTotalLatencyMs } : {}),
    ...(llmCallAudit ? { llmCallAudit } : {}),
    ...(dbObservability ? { dbObservability } : {}),
  };

  const summary = buildObservabilitySummary(input);
  const showTiming = activeSubview === "all" || activeSubview === "timing";
  const showLlm = activeSubview === "all" || activeSubview === "llm";
  const showDb = activeSubview === "all" || activeSubview === "db";

  return (
    <div
      id="trace-observability"
      data-trace-id={traceId}
      className={cn(
        "space-y-4",
        highlight && "rounded-lg ring-1 ring-[rgba(74,222,128,0.35)]",
        className,
      )}
    >
      <MetricStrip columns={4}>
        <MetricCell
          label="Execution Time"
          value={formatTimingSummary(summary.timingMs, summary.timingSource)}
          accent={summary.timingSource === "hrtime"}
        />
        <MetricCell
          label="LLM Calls"
          value={summary.llmCalls}
          subValue={
            summary.llmCalls > 0
              ? `${summary.llmTokens.toLocaleString()} tokens · ${formatCostUsd(summary.llmCostUsd)}`
              : "No LLM calls recorded"
          }
        />
        <MetricCell
          label="DB Queries"
          value={summary.dbQueries}
          subValue={
            summary.dbQueries > 0
              ? `${formatDurationMs(summary.dbTimeMs)}ms total DB time`
              : "No DB observability on this trace"
          }
        />
        <MetricCell
          label="DB Anomalies"
          value={summary.slowQueryCount + summary.duplicateQueryCount}
          subValue={`${summary.slowQueryCount} slow · ${summary.duplicateQueryCount} duplicate`}
        />
      </MetricStrip>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Observability subview">
        {SUBVIEW_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={activeSubview === option.id}
            onClick={() => setActiveSubview(option.id)}
            className={cn(
              "rounded-md border px-3 py-1.5 font-metric text-[0.625rem] uppercase tracking-[0.06em] transition-colors",
              activeSubview === option.id
                ? "border-[rgba(74,222,128,0.35)] bg-[var(--color-success-soft)] text-[var(--color-text-primary)]"
                : "border-[var(--color-border-default)] bg-[var(--color-surface-2)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {showTiming && (
        <ObservabilitySection
          title="Execution Timing"
          code="OBS.TIME"
          available={hasTimingData(input)}
          unavailableMessage="No timing audit on this trace. Re-run after execution-timing instrumentation is enabled."
        >
          <RetrievalTimeline
            {...(stages ? { stages } : {})}
            {...(timingAudit ? { timingAudit } : {})}
            {...(legacyTotalLatencyMs != null ? { totalLatencyMs: legacyTotalLatencyMs } : {})}
          />
        </ObservabilitySection>
      )}

      {showLlm && (
        <ObservabilitySection
          title="LLM Call Audit"
          code="OBS.LLM"
          available={hasLlmData(input)}
          unavailableMessage="No LLM calls recorded for this trace."
        >
          {llmCallAudit && <LlmAuditSection audit={llmCallAudit} />}
        </ObservabilitySection>
      )}

      {showDb && (
        <ObservabilitySection
          title="Database Query Audit"
          code="OBS.DB"
          available={hasDbData(input)}
          unavailableMessage="No database observability on this trace. Older traces may predate DB instrumentation."
        >
          {dbObservability && <DbAuditSection observability={dbObservability} />}
        </ObservabilitySection>
      )}
    </div>
  );
}

function ObservabilitySection({
  title,
  code,
  available,
  unavailableMessage,
  children,
}: {
  title: string;
  code: string;
  available: boolean;
  unavailableMessage: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] p-4">
      <header className="mb-3 flex items-center gap-2">
        <span className="font-metric text-[0.625rem] uppercase tracking-[0.08em] text-[var(--color-text-tertiary)]">
          {code}
        </span>
        <h3 className="text-sm font-medium text-[var(--color-text-primary)]">{title}</h3>
        {!available && <Badge variant="pending">unavailable</Badge>}
      </header>
      {available ? (
        children
      ) : (
        <p className="text-sm text-[var(--color-text-secondary)]">{unavailableMessage}</p>
      )}
    </section>
  );
}

function LlmAuditSection({ audit }: { audit: LlmCallAudit }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-4 font-metric text-xs text-[var(--color-text-tertiary)]">
        <span>{audit.totalPromptTokens.toLocaleString()} prompt tokens</span>
        <span>{audit.totalCompletionTokens.toLocaleString()} completion tokens</span>
        <span>{formatDurationMs(audit.totalLatencyMs)}ms latency</span>
        <span>{formatCostUsd(audit.totalCostUsd)} cost</span>
      </div>
      <DataTable dense>
        <DataTableHead>
          <DataTableHeaderCell>Operation</DataTableHeaderCell>
          <DataTableHeaderCell>Model</DataTableHeaderCell>
          <DataTableHeaderCell>Tokens</DataTableHeaderCell>
          <DataTableHeaderCell>Latency</DataTableHeaderCell>
          <DataTableHeaderCell>Cost</DataTableHeaderCell>
        </DataTableHead>
        <DataTableBody>
          {audit.calls.map((call, index) => (
            <DataTableRow key={`${call.operation}-${call.timestamp}-${index}`}>
              <DataTableCell>{call.operation}</DataTableCell>
              <DataTableCell mono>{call.model}</DataTableCell>
              <DataTableCell mono>
                {call.promptTokens}+{call.completionTokens}
              </DataTableCell>
              <DataTableCell mono>{formatDurationMs(call.latencyMs)}ms</DataTableCell>
              <DataTableCell mono>{formatCostUsd(call.costUsd)}</DataTableCell>
            </DataTableRow>
          ))}
        </DataTableBody>
      </DataTable>
    </div>
  );
}

function DbAuditSection({ observability }: { observability: RetrievalDbObservability }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 font-metric text-xs text-[var(--color-text-tertiary)]">
        <span>{observability.totalQueries} queries</span>
        <span>{formatDurationMs(observability.totalDbTime)}ms total DB time</span>
        <span>{observability.slowQueries.length} slow</span>
        <span>{observability.duplicateQueries.length} duplicate groups</span>
      </div>

      {observability.slowQueries.length > 0 && (
        <div>
          <p className="mb-2 font-metric text-[0.625rem] uppercase tracking-[0.06em] text-[var(--color-text-tertiary)]">
            Slow Queries
          </p>
          <DataTable dense>
            <DataTableHead>
              <DataTableHeaderCell>Model</DataTableHeaderCell>
              <DataTableHeaderCell>Operation</DataTableHeaderCell>
              <DataTableHeaderCell>Duration</DataTableHeaderCell>
              <DataTableHeaderCell>Fingerprint</DataTableHeaderCell>
            </DataTableHead>
            <DataTableBody>
              {observability.slowQueries.map((query) => (
                <DataTableRow key={query.queryId}>
                  <DataTableCell>{query.model}</DataTableCell>
                  <DataTableCell mono>{query.operation}</DataTableCell>
                  <DataTableCell mono>{formatDurationMs(query.durationMs)}ms</DataTableCell>
                  <DataTableCell mono>{query.fingerprint.slice(0, 12)}…</DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        </div>
      )}

      {observability.duplicateQueries.length > 0 && (
        <div>
          <p className="mb-2 font-metric text-[0.625rem] uppercase tracking-[0.06em] text-[var(--color-text-tertiary)]">
            Duplicate Query Groups
          </p>
          <DataTable dense>
            <DataTableHead>
              <DataTableHeaderCell>Fingerprint</DataTableHeaderCell>
              <DataTableHeaderCell>Count</DataTableHeaderCell>
              <DataTableHeaderCell>Total Duration</DataTableHeaderCell>
              <DataTableHeaderCell>Sample</DataTableHeaderCell>
            </DataTableHead>
            <DataTableBody>
              {observability.duplicateQueries.map((group) => (
                <DataTableRow key={group.fingerprint}>
                  <DataTableCell mono>{group.fingerprint.slice(0, 12)}…</DataTableCell>
                  <DataTableCell mono>{group.count}</DataTableCell>
                  <DataTableCell mono>{formatDurationMs(group.totalDurationMs)}ms</DataTableCell>
                  <DataTableCell mono>
                    {group.sample.model} · {group.sample.operation}
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        </div>
      )}
    </div>
  );
}
