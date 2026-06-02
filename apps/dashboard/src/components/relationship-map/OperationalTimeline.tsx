import { useMemo } from "react";
import { motion } from "framer-motion";
import type { GraphTimelineEvent } from "./types.js";
import { EVENT_TYPE_LABELS } from "./constants.js";

interface OperationalTimelineProps {
  events: GraphTimelineEvent[];
  scrubPosition: number;
  onScrub: (position: number) => void;
  activeEventId: string | null;
  onEventSelect: (event: GraphTimelineEvent | null) => void;
}

export function OperationalTimeline({
  events,
  scrubPosition,
  onScrub,
  activeEventId,
  onEventSelect,
}: OperationalTimelineProps) {
  const { minTime, maxTime, range } = useMemo(() => {
    if (events.length === 0) return { minTime: 0, maxTime: 1, range: 1 };
    const times = events.map((e) => new Date(e.timestamp).getTime());
    const min = Math.min(...times);
    const max = Math.max(...times);
    return { minTime: min, maxTime: max, range: Math.max(max - min, 1) };
  }, [events]);

  const scrubTime = minTime + scrubPosition * range;

  const visibleEvents = useMemo(() => {
    const windowMs = range * 0.15;
    return events.filter((e) => {
      const t = new Date(e.timestamp).getTime();
      return Math.abs(t - scrubTime) <= windowMs || t <= scrubTime;
    });
  }, [events, scrubTime, range]);

  const eventTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of visibleEvents) {
      counts[e.eventType] = (counts[e.eventType] ?? 0) + 1;
    }
    return counts;
  }, [visibleEvents]);

  return (
    <div className="relmap-timeline flex h-full flex-col border-t border-[var(--color-border-subtle)] bg-[var(--color-surface-0)]">
      <header className="flex shrink-0 items-center justify-between px-4 py-2">
        <div className="flex items-center gap-3">
          <span className="font-metric text-[0.5625rem] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
            OPS.TIMELINE
          </span>
          <span className="font-metric text-[0.625rem] tabular-nums text-[var(--color-text-tertiary)]">
            {new Date(scrubTime).toISOString().slice(0, 19).replace("T", " ")} UTC
          </span>
        </div>
        <div className="flex items-center gap-3">
          {Object.entries(eventTypeCounts).map(([type, count]) => (
            <span
              key={type}
              className="font-metric text-[0.5625rem] tabular-nums text-[var(--color-text-muted)]"
            >
              {EVENT_TYPE_LABELS[type] ?? type}: {count}
            </span>
          ))}
        </div>
      </header>

      <div className="relative flex-1 px-4 pb-3">
        {/* Scrub track */}
        <div className="relative h-8">
          <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[var(--color-border-default)]" />

          {/* Event markers */}
          {events.map((event) => {
            const t = new Date(event.timestamp).getTime();
            const pos = (t - minTime) / range;
            const isActive = activeEventId === event.id;
            const isPast = t <= scrubTime;

            return (
              <button
                key={event.id}
                type="button"
                onClick={() => onEventSelect(isActive ? null : event)}
                className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 group"
                style={{ left: `${pos * 100}%` }}
                title={event.detail}
              >
                <span
                  className={`block h-2 w-2 rounded-full transition-all ${
                    isActive
                      ? "bg-[var(--color-accent)] shadow-[0_0_8px_rgba(56,189,248,0.6)] scale-150"
                      : isPast
                        ? "bg-[var(--color-text-tertiary)] group-hover:bg-[var(--color-accent)]"
                        : "bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)] group-hover:border-[var(--color-accent)]"
                  }`}
                />
              </button>
            );
          })}

          {/* Scrub head */}
          <motion.div
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{ left: `${scrubPosition * 100}%` }}
          >
            <div className="h-4 w-0.5 bg-[var(--color-accent)] shadow-[0_0_12px_rgba(56,189,248,0.8)]" />
          </motion.div>

          <input
            type="range"
            min={0}
            max={1000}
            value={Math.round(scrubPosition * 1000)}
            onChange={(e) => onScrub(Number(e.target.value) / 1000)}
            className="absolute inset-0 w-full cursor-ew-resize opacity-0"
            aria-label="Timeline scrubber"
          />
        </div>

        {/* Active event detail */}
        {activeEventId && (
          <div className="mt-2 rounded border border-[var(--color-border-subtle)] bg-[var(--color-surface-2)] px-3 py-2">
            {events
              .filter((e) => e.id === activeEventId)
              .map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-4">
                  <p className="truncate text-xs text-[var(--color-text-secondary)]">{e.detail}</p>
                  <span className="shrink-0 font-metric text-[0.5625rem] text-[var(--color-text-muted)]">
                    {e.memoryIds.length} node{e.memoryIds.length !== 1 ? "s" : ""}
                  </span>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
