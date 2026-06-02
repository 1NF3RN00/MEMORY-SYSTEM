import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { staggerContainer, staggerItem } from "../design-system/motion.js";
import { PageHeader } from "../components/ui/PageHeader.js";
import { MetricCell, MetricStrip } from "../components/ui/MetricCell.js";
import { Panel } from "../components/ui/Panel.js";
import { Button } from "../components/ui/Button.js";
import {
  CompressionAnalytics,
  RetrievalHeatmap,
} from "../components/observability/RetrievalHeatmap.js";
import { ReinforcementScoringPanel } from "../components/observability/ExplainabilityPanel.js";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
} from "../components/ui/DataTable.js";
import {
  emptyWorkspaceTelemetry,
  fetchWorkspaceTelemetry,
  type WorkspaceTelemetry,
} from "../lib/workspaceTelemetry.js";

export function ObservabilityPage() {
  const [telemetry, setTelemetry] = useState<WorkspaceTelemetry>(emptyWorkspaceTelemetry());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetchWorkspaceTelemetry().then((data) => {
      if (!cancelled) {
        setTelemetry(data ?? emptyWorkspaceTelemetry());
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="max-w-[1200px]"
    >
      <motion.div variants={staggerItem}>
        <PageHeader
          code="OPS.06"
          title="System Metrics"
          lede="Structured logs, request traces, token accounting, and workspace analytics."
        />
      </motion.div>

      <motion.div variants={staggerItem} className="mb-8">
        <MetricStrip columns={4}>
          <MetricCell
            label="Requests (24h)"
            value={loading ? "—" : telemetry.requestCount24h.toLocaleString()}
            accent
          />
          <MetricCell
            label="P99 Latency"
            value={loading ? "—" : `${telemetry.p99LatencyMs}ms`}
          />
          <MetricCell
            label="Error Rate"
            value={loading ? "—" : `${(telemetry.errorRate * 100).toFixed(2)}%`}
          />
          <MetricCell
            label="Token Throughput (24h)"
            value={loading ? "—" : telemetry.tokenThroughput.toLocaleString()}
          />
        </MetricStrip>
      </motion.div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <motion.div variants={staggerItem}>
          <Panel
            code="OPS.01"
            title="Request Traces"
            description="Recent retrieval operations with trace IDs and status."
            headerAction={
              <Link to="/retrieval-traces">
                <Button variant="secondary">View all</Button>
              </Link>
            }
          >
            {telemetry.retrievalTraces.length === 0 ? (
              <p className="text-sm text-[var(--color-text-secondary)]">
                No retrieval traces recorded yet.
              </p>
            ) : (
              <DataTable>
                <DataTableHead>
                  <DataTableHeaderCell>Trace</DataTableHeaderCell>
                  <DataTableHeaderCell>Status</DataTableHeaderCell>
                  <DataTableHeaderCell>Created</DataTableHeaderCell>
                </DataTableHead>
                <DataTableBody>
                  {telemetry.retrievalTraces.slice(0, 6).map((trace) => (
                    <DataTableRow key={trace.retrievalTraceId}>
                      <DataTableCell>
                        <Link to={`/retrieval-traces/${trace.retrievalTraceId}`}>
                          {trace.retrievalTraceId?.slice(0, 14)}…
                        </Link>
                      </DataTableCell>
                      <DataTableCell>{trace.status}</DataTableCell>
                      <DataTableCell>
                        {new Date(trace.createdAt).toISOString().slice(0, 19).replace("T", " ")}
                      </DataTableCell>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
            )}
          </Panel>
        </motion.div>

        <motion.div variants={staggerItem}>
          <Panel
            code="OPS.02"
            title="Event Log"
            description="Recent ingestion operations from the append-only event pipeline."
            headerAction={
              <Link to="/ingestion">
                <Button variant="secondary">View all</Button>
              </Link>
            }
          >
            {telemetry.ingestionTraces.length === 0 ? (
              <p className="text-sm text-[var(--color-text-secondary)]">
                No ingestion traces recorded yet.
              </p>
            ) : (
              <DataTable>
                <DataTableHead>
                  <DataTableHeaderCell>Trace</DataTableHeaderCell>
                  <DataTableHeaderCell>Source</DataTableHeaderCell>
                  <DataTableHeaderCell>Status</DataTableHeaderCell>
                </DataTableHead>
                <DataTableBody>
                  {telemetry.ingestionTraces.slice(0, 6).map((trace) => (
                    <DataTableRow key={trace.traceId}>
                      <DataTableCell>
                        <Link to={`/ingestion/${trace.traceId}`}>
                          {trace.traceId?.slice(0, 14)}…
                        </Link>
                      </DataTableCell>
                      <DataTableCell>{trace.sourceType ?? "—"}</DataTableCell>
                      <DataTableCell>{trace.status}</DataTableCell>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
            )}
          </Panel>
        </motion.div>

        <motion.div variants={staggerItem}>
          <Panel
            code="OPS.03"
            title="Token Accounting"
            description="Latest compression impact from the most recent compression trace."
          >
            {telemetry.compressionAnalytics ? (
              <CompressionAnalytics
                originalTokens={telemetry.compressionAnalytics.originalTokens}
                compressedTokens={telemetry.compressionAnalytics.compressedTokens}
                {...(telemetry.compressionAnalytics.fidelityScore !== undefined
                  ? { fidelityScore: telemetry.compressionAnalytics.fidelityScore }
                  : {})}
                {...(telemetry.compressionAnalytics.mergeCount !== undefined
                  ? { mergeCount: telemetry.compressionAnalytics.mergeCount }
                  : {})}
                {...(telemetry.compressionAnalytics.trimCount !== undefined
                  ? { trimCount: telemetry.compressionAnalytics.trimCount }
                  : {})}
              />
            ) : (
              <p className="text-sm text-[var(--color-text-secondary)]">
                No compression traces available yet.
              </p>
            )}
          </Panel>
        </motion.div>

        <motion.div variants={staggerItem}>
          <Panel
            code="OPS.04"
            title="Reinforcement Scoring"
            description="Ranking breakdown from the latest completed retrieval."
          >
            {telemetry.rankingRows.length > 0 ? (
              <ReinforcementScoringPanel rows={telemetry.rankingRows} />
            ) : (
              <p className="text-sm text-[var(--color-text-secondary)]">
                No ranking data available. Complete a retrieval to populate scoring forensics.
              </p>
            )}
          </Panel>
        </motion.div>

        <motion.div variants={staggerItem} className="lg:col-span-2">
          <Panel
            code="OPS.05"
            title="Retrieval Access Frequency"
            description="Memory objects ranked by retrieval access count across workspace traces."
          >
            <RetrievalHeatmap entries={telemetry.heatmap} maxEntries={10} />
          </Panel>
        </motion.div>
      </div>
    </motion.div>
  );
}
