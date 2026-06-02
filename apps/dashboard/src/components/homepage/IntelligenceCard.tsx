import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";
import { transition } from "../../design-system/motion.js";

interface IntelligenceCardProps {
  label: string;
  children: ReactNode;
  className?: string;
  accent?: boolean;
}

export function IntelligenceCard({ label, children, className, accent }: IntelligenceCardProps) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={transition.normal}
      whileHover={{ borderColor: "rgba(255,255,255,0.1)" }}
      className={cn(
        "rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)]/80 p-4",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]",
        accent && "border-[rgba(56,189,248,0.12)]",
        className,
      )}
    >
      <h3 className="mb-3 font-metric text-[0.6875rem] font-medium uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">
        {label}
      </h3>
      <div className="space-y-2">{children}</div>
    </motion.article>
  );
}

interface MetricRowProps {
  label: string;
  value: ReactNode;
  mono?: boolean;
  highlight?: boolean;
}

export function MetricRow({ label, value, mono, highlight }: MetricRowProps) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[0.6875rem] text-[var(--color-text-tertiary)]">{label}</span>
      <span
        className={cn(
          "text-[0.8125rem] font-medium tabular-nums",
          mono && "font-metric",
          highlight ? "text-[var(--color-accent)]" : "text-[var(--color-text-primary)]",
        )}
      >
        {value}
      </span>
    </div>
  );
}
