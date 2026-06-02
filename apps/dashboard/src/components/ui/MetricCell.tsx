import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";

interface MetricCellProps {
  label: string;
  value: ReactNode;
  subValue?: ReactNode;
  accent?: boolean;
  className?: string;
}

export function MetricCell({ label, value, subValue, accent, className }: MetricCellProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-1)]",
        "px-4 py-3.5 shadow-[var(--shadow-panel)]",
        "transition-colors duration-150 hover:border-[var(--color-border-strong)]",
        className,
      )}
    >
      <span className="block font-metric text-[0.6875rem] uppercase tracking-[0.08em] text-[var(--color-text-tertiary)]">
        {label}
      </span>
      <span
        className={cn(
          "mt-1 block font-metric text-lg font-semibold tracking-[-0.02em]",
          accent ? "text-[var(--color-accent)]" : "text-[var(--color-text-primary)]",
        )}
      >
        {value}
      </span>
      {subValue && (
        <span className="mt-0.5 block text-xs text-[var(--color-text-tertiary)]">{subValue}</span>
      )}
    </div>
  );
}

interface MetricStripProps {
  children: ReactNode;
  columns?: 2 | 3 | 4 | 5;
  className?: string;
}

export function MetricStrip({ children, columns = 4, className }: MetricStripProps) {
  const cols = {
    2: "grid-cols-2",
    3: "grid-cols-3",
    4: "grid-cols-2 lg:grid-cols-4",
    5: "grid-cols-2 lg:grid-cols-5",
  };

  return (
    <div className={cn("grid gap-3", cols[columns], className)}>{children}</div>
  );
}
