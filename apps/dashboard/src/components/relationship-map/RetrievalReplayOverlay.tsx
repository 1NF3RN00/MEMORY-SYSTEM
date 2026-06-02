import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { GraphRetrievalTrace } from "./types.js";

interface RetrievalReplayOverlayProps {
  traces: GraphRetrievalTrace[];
  activeTraceId: string | null;
  onSelectTrace: (traceId: string | null) => void;
  onReplayProgress: (progress: number) => void;
  replayPath: string[];
}

export function RetrievalReplayOverlay({
  traces,
  activeTraceId,
  onSelectTrace,
  onReplayProgress,
  replayPath,
}: RetrievalReplayOverlayProps) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const activeTrace = traces.find((t) => t.retrievalTraceId === activeTraceId);

  useEffect(() => {
    if (!playing || !activeTrace) return;

    const interval = window.setInterval(() => {
      setProgress((p) => {
        const next = p + 0.015;
        if (next >= 1) {
          setPlaying(false);
          return 1;
        }
        return next;
      });
    }, 50);

    return () => window.clearInterval(interval);
  }, [playing, activeTrace]);

  useEffect(() => {
    onReplayProgress(progress);
  }, [progress, onReplayProgress]);

  useEffect(() => {
    setProgress(0);
    setPlaying(false);
  }, [activeTraceId]);

  const handlePlay = () => {
    if (progress >= 1) setProgress(0);
    setPlaying(true);
  };

  return (
    <div className="flex flex-col gap-3">
      <header className="flex items-center justify-between">
        <div>
          <span className="font-metric text-[0.5625rem] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
            RET.REPLAY
          </span>
          <p className="mt-0.5 text-xs text-[var(--color-text-tertiary)]">
            Visualize query flow through contextual assembly
          </p>
        </div>
        {activeTrace && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePlay}
              disabled={playing}
              className="rounded border border-[var(--color-border-default)] bg-[var(--color-surface-2)] px-2.5 py-1 font-metric text-[0.625rem] uppercase tracking-[0.06em] text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent-muted)] disabled:opacity-50"
            >
              {playing ? "Playing…" : progress >= 1 ? "Replay" : "Play"}
            </button>
            <button
              type="button"
              onClick={() => {
                setProgress(0);
                setPlaying(false);
                onReplayProgress(0);
              }}
              className="rounded border border-[var(--color-border-subtle)] px-2 py-1 font-metric text-[0.5625rem] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
            >
              Reset
            </button>
          </div>
        )}
      </header>

      <div className="max-h-40 space-y-1 overflow-y-auto">
        {traces.length === 0 && (
          <p className="text-xs text-[var(--color-text-muted)]">No retrieval traces available</p>
        )}
        {traces.slice(0, 12).map((trace) => {
          const isActive = activeTraceId === trace.retrievalTraceId;
          return (
            <button
              key={trace.retrievalTraceId}
              type="button"
              onClick={() =>
                onSelectTrace(isActive ? null : trace.retrievalTraceId)
              }
              className={`w-full rounded border px-2.5 py-2 text-left transition-colors ${
                isActive
                  ? "border-[rgba(56,189,248,0.3)] bg-[var(--color-accent-muted)]"
                  : "border-[var(--color-border-subtle)] bg-[var(--color-surface-2)] hover:border-[var(--color-border-default)]"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs text-[var(--color-text-secondary)]">
                  {trace.query}
                </span>
                <span className="shrink-0 font-metric text-[0.5625rem] tabular-nums text-[var(--color-text-muted)]">
                  {trace.memoryIds.length} mem
                </span>
              </div>
              <span className="mt-0.5 block font-metric text-[0.5625rem] text-[var(--color-text-muted)]">
                {trace.createdAt.slice(0, 19).replace("T", " ")}
              </span>
            </button>
          );
        })}
      </div>

      <AnimatePresence>
        {activeTrace && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] p-3">
              <p className="mb-2 font-metric text-[0.5625rem] uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
                Ranking Flow · {replayPath.length} nodes
              </p>
              <div className="flex flex-wrap gap-1">
                {activeTrace.rankingOrder.map((memId, i) => {
                  const lit = i / activeTrace.rankingOrder.length <= progress;
                  return (
                    <span
                      key={`${memId}-${i}`}
                      className={`rounded px-1.5 py-0.5 font-metric text-[0.5625rem] transition-colors ${
                        lit
                          ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                          : "bg-[var(--color-surface-3)] text-[var(--color-text-muted)]"
                      }`}
                    >
                      #{i + 1} {memId.slice(0, 6)}…
                    </span>
                  );
                })}
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-[var(--color-surface-3)]">
                <motion.div
                  className="h-full rounded-full bg-[var(--color-accent)]"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
