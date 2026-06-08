import { memo, useCallback } from "react";
import { useShell } from "../../context/ShellContext.js";
import type { SystemIndicators } from "./types.js";

interface OperationalSystemBarProps {
  indicators: SystemIndicators;
}

function IndicatorPill({
  label,
  value,
  unit,
  pulse,
}: {
  label: string;
  value: string;
  unit?: string;
  pulse?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 border-l border-[var(--color-border-subtle)] pl-3 first:border-l-0 first:pl-0">
      <span className="font-metric text-[0.625rem] uppercase tracking-[0.08em] text-[var(--color-text-tertiary)]">
        {label}
      </span>
      <span className="flex items-center gap-1 font-metric text-[0.6875rem] tabular-nums text-[var(--color-text-secondary)]">
        {pulse && (
          <span className="relative flex h-1 w-1">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-accent)] opacity-30" />
            <span className="relative inline-flex h-1 w-1 rounded-full bg-[var(--color-accent)]" />
          </span>
        )}
        {value}
        {unit && <span className="text-[var(--color-text-tertiary)]">{unit}</span>}
      </span>
    </div>
  );
}

function OperationalSystemBarComponent({ indicators }: OperationalSystemBarProps) {
  const { openCommandPalette } = useShell();
  const handleOpenCommandPalette = useCallback(() => {
    openCommandPalette();
  }, [openCommandPalette]);
  const healthLabel = indicators.systemHealth;

  const healthColor =
    healthLabel === "nominal"
      ? "text-[var(--color-success)]"
      : healthLabel === "degraded"
        ? "text-[var(--color-warning)]"
        : "text-[var(--color-danger)]";

  return (
    <header className="flex h-12 shrink-0 items-center gap-6 border-b border-[var(--color-border-subtle)] bg-[var(--color-void)] px-5">
      <div className="flex min-w-0 shrink-0 flex-col">
        <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-primary)]">
          Midgley Memory Systems
        </span>
        <span className="font-metric text-[0.625rem] uppercase tracking-[0.08em] text-[var(--color-text-tertiary)]">
          Operational Intelligence Middleware
        </span>
      </div>

      <div className="mx-auto w-full max-w-xl">
        <button
          type="button"
          onClick={handleOpenCommandPalette}
          className="flex w-full items-center gap-2 rounded-md border border-[var(--color-border-default)] bg-[var(--color-surface-1)] px-3 py-1.5 text-left transition-colors hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-2)]"
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-tertiary)]" fill="none">
            <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.2" />
            <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          <span className="flex-1 text-[0.8125rem] text-[var(--color-text-tertiary)]">
            Search memories, traces, scopes…
          </span>
          <kbd className="hidden rounded border border-[var(--color-border-default)] px-1.5 py-0.5 font-metric text-[0.625rem] text-[var(--color-text-tertiary)] sm:inline">
            Ctrl K
          </kbd>
        </button>
      </div>

      <div className="hidden shrink-0 items-center gap-3 lg:flex">
        <IndicatorPill
          label="Latency"
          value={indicators.retrievalLatencyMs.toFixed(0)}
          unit="ms"
          pulse
        />
        <IndicatorPill
          label="Memories"
          value={indicators.activeMemories.toLocaleString()}
        />
        <IndicatorPill
          label="Ingest"
          value={indicators.ingestionThroughput.toFixed(1)}
          unit="/s"
        />
        <IndicatorPill
          label="Compress"
          value={`${Math.round(indicators.compressionEfficiency * 100)}%`}
        />
        <div className="flex items-center gap-1.5 border-l border-[var(--color-border-subtle)] pl-3">
          <span className="relative flex h-1.5 w-1.5">
            <span
              className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-30 ${
                healthLabel === "nominal" ? "bg-[var(--color-success)]" : "bg-[var(--color-warning)]"
              }`}
            />
            <span
              className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
                healthLabel === "nominal" ? "bg-[var(--color-success)]" : "bg-[var(--color-warning)]"
              }`}
            />
          </span>
          <span className={`font-metric text-[0.5625rem] uppercase tracking-[0.08em] ${healthColor}`}>
            {healthLabel}
          </span>
        </div>
      </div>
    </header>
  );
}

export const OperationalSystemBar = memo(OperationalSystemBarComponent);
