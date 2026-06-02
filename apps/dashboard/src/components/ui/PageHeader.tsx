import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { pageTransition } from "../../design-system/motion.js";
import { cn } from "../../lib/cn.js";

interface PageHeaderProps {
  code?: string;
  title: string;
  lede?: string;
  action?: ReactNode;
  className?: string;
}

export function PageHeader({ code, title, lede, action, className }: PageHeaderProps) {
  return (
    <motion.header
      {...pageTransition}
      className={cn("mb-8", className)}
    >
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          {code && (
            <div className="mb-2 flex items-center gap-3">
              <span className="font-metric text-[0.625rem] font-medium uppercase tracking-[0.1em] text-[var(--color-accent)]">
                {code}
              </span>
              <span className="h-px flex-1 max-w-[120px] bg-gradient-to-r from-[var(--color-border-strong)] to-transparent" />
            </div>
          )}
          <h1 className="text-[1.875rem] font-semibold tracking-[-0.03em] text-[var(--color-text-primary)] leading-tight">
            {title}
          </h1>
          {lede && (
            <p className="mt-2 max-w-[58ch] text-[0.9375rem] leading-relaxed text-[var(--color-text-secondary)]">
              {lede}
            </p>
          )}
        </div>
        {action && <div className="shrink-0 pt-1">{action}</div>}
      </div>
    </motion.header>
  );
}
