import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { staggerContainer, staggerItem } from "../../design-system/motion.js";
import { MetricCell } from "../ui/MetricCell.js";
import {
  emptyWorkspaceTelemetry,
  fetchWorkspaceTelemetry,
  type WorkspaceTelemetry,
} from "../../lib/workspaceTelemetry.js";

export function MetricsSidebar() {
  const [telemetry, setTelemetry] = useState<WorkspaceTelemetry>(emptyWorkspaceTelemetry());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const refresh = () => {
      void fetchWorkspaceTelemetry().then((data) => {
        if (!cancelled) {
          setTelemetry(data ?? emptyWorkspaceTelemetry());
          setLoading(false);
        }
      });
    };

    refresh();
    const interval = window.setInterval(refresh, 20_000);
    window.addEventListener("mms:data-cleared", refresh);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("mms:data-cleared", refresh);
    };
  }, []);

  const { metrics, activityFeed } = telemetry;

  return (
    <aside className="hidden w-[var(--metrics-sidebar-width)] shrink-0 border-l border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] xl:block">
      <div className="sticky top-[var(--topbar-height)] h-[calc(100vh-var(--topbar-height))] overflow-y-auto p-5">
        <header className="mb-5">
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
            System Metrics
          </h2>
          <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
            Live operational telemetry
          </p>
        </header>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="space-y-3"
        >
          <motion.div variants={staggerItem}>
            <MetricCell
              label="Retrievals (24h)"
              value={loading ? "—" : metrics.retrievalOps24h.toLocaleString()}
              accent
            />
          </motion.div>
          <motion.div variants={staggerItem}>
            <MetricCell
              label="Avg Latency"
              value={loading ? "—" : `${metrics.avgLatencyMs}ms`}
            />
          </motion.div>
          <motion.div variants={staggerItem}>
            <MetricCell
              label="Token Efficiency"
              value={loading ? "—" : metrics.tokenEfficiency.toFixed(2)}
              subValue="Mean ranking score"
            />
          </motion.div>
          <motion.div variants={staggerItem}>
            <MetricCell
              label="Memory Objects"
              value={loading ? "—" : metrics.memoryObjects.toLocaleString()}
            />
          </motion.div>
          <motion.div variants={staggerItem}>
            <MetricCell
              label="Compression Ratio"
              value={loading ? "—" : metrics.compressionRatio.toFixed(2)}
            />
          </motion.div>
          <motion.div variants={staggerItem}>
            <MetricCell
              label="Determinism"
              value={metrics.determinismScore}
              accent
            />
          </motion.div>
        </motion.div>

        <div className="mt-6 border-t border-[var(--color-border-subtle)] pt-5">
          <h3 className="mb-3 font-metric text-[0.6875rem] uppercase tracking-[0.08em] text-[var(--color-text-tertiary)]">
            Recent Activity
          </h3>
          {activityFeed.length === 0 ? (
            <p className="text-xs text-[var(--color-text-secondary)]">No recent pipeline activity.</p>
          ) : (
            <ul className="space-y-1">
              {activityFeed.map((item, i) => (
                <motion.li
                  key={item.id}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.25 }}
                  className="group rounded-md px-2 py-2 transition-colors hover:bg-[var(--color-surface-2)]"
                >
                  <div className="flex items-start gap-2">
                    <FeedDot type={item.type} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)]">
                        {item.label}
                      </p>
                      <p className="truncate font-metric text-[0.6875rem] text-[var(--color-text-tertiary)]">
                        {item.memory}
                      </p>
                    </div>
                    <span className="shrink-0 font-metric text-[0.625rem] text-[var(--color-text-tertiary)]">
                      {item.time}
                    </span>
                  </div>
                </motion.li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </aside>
  );
}

function FeedDot({ type }: { type: string }) {
  const colors: Record<string, string> = {
    ingest: "bg-[var(--color-accent)]",
    embed: "bg-[var(--color-success)]",
    retrieve: "bg-[var(--color-warning)]",
    compress: "bg-[var(--color-text-tertiary)]",
  };

  return (
    <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${colors[type] ?? "bg-[var(--color-text-muted)]"}`} />
  );
}
