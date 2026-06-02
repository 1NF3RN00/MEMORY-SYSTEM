import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";
import { transition } from "../../design-system/motion.js";

interface PanelProps {
  children: ReactNode;
  className?: string;
  code?: string | undefined;
  title?: string | undefined;
  description?: string | undefined;
  headerAction?: ReactNode;
  noPadding?: boolean;
  interactive?: boolean;
  onClick?: () => void;
}

export function Panel({
  children,
  className,
  code,
  title,
  description,
  headerAction,
  noPadding,
  interactive,
  onClick,
}: PanelProps) {
  const Tag = interactive || onClick ? motion.button : motion.section;

  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={transition.normal}
      whileHover={
        interactive || onClick
          ? { borderColor: "rgba(255, 255, 255, 0.11)" }
          : {}
      }
      className={cn(
        "relative w-full text-left rounded-lg border border-[var(--color-border-default)]",
        "bg-[var(--color-surface-1)] shadow-[var(--shadow-panel)]",
        "transition-colors duration-150",
        interactive && "cursor-pointer hover:bg-[var(--color-surface-2)]",
        onClick && "cursor-pointer hover:bg-[var(--color-surface-2)]",
        noPadding ? "" : "p-5",
        className,
      )}
    >
      {(code || title || headerAction) && (
        <header className={cn("flex items-start justify-between gap-4", (code || title || headerAction) && children ? "mb-4" : "")}>
          <div className="min-w-0">
            {code && (
              <span className="font-metric text-[0.625rem] uppercase tracking-[0.08em] text-[var(--color-text-tertiary)]">
                {code}
              </span>
            )}
            {title && (
              <h2 className="mt-0.5 text-base font-semibold tracking-[-0.01em] text-[var(--color-text-primary)]">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-1 text-sm text-[var(--color-text-secondary)] leading-relaxed">
                {description}
              </p>
            )}
          </div>
          {headerAction && <div className="shrink-0">{headerAction}</div>}
        </header>
      )}
      {children}
    </Tag>
  );
}
