import { memo, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "../../lib/cn.js";
import { EVENT_CATEGORY_STYLES } from "./constants.js";
import type { OperationalEvent } from "./types.js";

function formatTimestamp(date: Date): string {
  return date.toISOString().slice(11, 19);
}

interface EventCardProps {
  event: OperationalEvent;
  isNew?: boolean;
}

function EventCard({ event, isNew }: EventCardProps) {
  const [expanded, setExpanded] = useState(false);
  const styles = EVENT_CATEGORY_STYLES[event.category];

  return (
    <motion.article
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 8 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      onClick={() => setExpanded((v) => !v)}
      className={cn(
        "group cursor-pointer rounded-md border bg-[var(--color-surface-1)] p-3",
        "transition-colors hover:bg-[var(--color-surface-2)]",
        styles.border,
        isNew && styles.glow,
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span
          className={cn(
            "font-metric text-[0.625rem] font-medium uppercase tracking-[0.08em]",
            styles.accent,
          )}
        >
          [{event.category}]
        </span>
        <span className="font-metric text-[0.6875rem] tabular-nums text-[var(--color-text-tertiary)]">
          {formatTimestamp(event.timestamp)}
        </span>
      </div>

      <p className="text-[0.8125rem] font-medium leading-snug text-[var(--color-text-primary)]">
        {event.title}
      </p>
      <p className="mt-1 font-metric text-[0.75rem] text-[var(--color-text-secondary)]">
        {event.detail}
      </p>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-3 space-y-2 border-t border-[var(--color-border-subtle)] pt-3">
              {event.metadata && (
                <div className="grid grid-cols-2 gap-1">
                  {Object.entries(event.metadata).map(([key, val]) => (
                    <div key={key} className="flex justify-between gap-2">
                      <span className="font-metric text-[0.625rem] uppercase tracking-[0.06em] text-[var(--color-text-tertiary)]">
                        {key}
                      </span>
                      <span className="font-metric text-[0.6875rem] text-[var(--color-text-secondary)]">
                        {val}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {event.lineage && (
                <p className="font-metric text-[0.6875rem] text-[var(--color-text-secondary)]">
                  <span className="text-[var(--color-text-tertiary)]">Lineage </span>
                  {event.lineage}
                </p>
              )}
              {event.source && (
                <p className="font-metric text-[0.6875rem] text-[var(--color-text-secondary)]">
                  <span className="text-[var(--color-text-tertiary)]">Source </span>
                  {event.source}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!expanded && (
        <p className="mt-2 font-metric text-[0.625rem] uppercase tracking-[0.06em] text-[var(--color-text-tertiary)] opacity-0 transition-opacity group-hover:opacity-100">
          Expand for lineage
        </p>
      )}
    </motion.article>
  );
}

interface LiveOperationalStreamProps {
  events: OperationalEvent[];
  loading?: boolean;
}

function LiveOperationalStreamComponent({ events, loading }: LiveOperationalStreamProps) {
  const [latestId, setLatestId] = useState<string | null>(null);
  const prevTopId = useRef<string | null>(null);

  useEffect(() => {
    const topId = events[0]?.id ?? null;
    if (topId && topId !== prevTopId.current) {
      prevTopId.current = topId;
      setLatestId(topId);
      const timer = window.setTimeout(() => setLatestId(null), 1000);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [events]);

  return (
    <section className="flex h-full min-h-0 flex-col border-r border-[var(--color-border-subtle)] bg-[var(--color-surface-0)]">
      <header className="flex shrink-0 items-center justify-between border-b border-[var(--color-border-subtle)] px-4 py-3">
        <div>
          <h2 className="text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-primary)]">
            Live System Stream
          </h2>
          <p className="mt-0.5 font-metric text-[0.625rem] uppercase tracking-[0.06em] text-[var(--color-text-tertiary)]">
            Forensic retrieval telemetry
          </p>
        </div>
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-accent)] opacity-25" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />
        </span>
      </header>

      <div className="relative min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {loading && events.length === 0 ? (
          <p className="px-1 py-2 text-[0.8125rem] text-[var(--color-text-secondary)]">Loading events…</p>
        ) : events.length === 0 ? (
          <p className="px-1 py-2 text-[0.8125rem] text-[var(--color-text-secondary)]">
            No operational events yet. Run ingestion or retrieval to populate this stream.
          </p>
        ) : (
          <AnimatePresence initial={false}>
            <div className="flex flex-col gap-2">
              {events.map((event) => (
                <EventCard key={event.id} event={event} isNew={event.id === latestId} />
              ))}
            </div>
          </AnimatePresence>
        )}
      </div>
    </section>
  );
}

export const LiveOperationalStream = memo(LiveOperationalStreamComponent);
