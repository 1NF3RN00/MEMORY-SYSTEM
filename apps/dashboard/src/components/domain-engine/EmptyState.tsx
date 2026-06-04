import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-[var(--color-border-default)] bg-[var(--color-surface-2)]/30 px-6 py-12 text-center">
      <p className="text-sm font-medium text-[var(--color-text-primary)]">{title}</p>
      <p className="max-w-md text-sm text-[var(--color-text-tertiary)]">{description}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
