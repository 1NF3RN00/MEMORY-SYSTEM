import { cn } from "../../lib/cn.js";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "accent" | "pending";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variants: Record<BadgeVariant, string> = {
  default:
    "border-[var(--color-border-default)] bg-[var(--color-surface-2)] text-[var(--color-text-secondary)]",
  success:
    "border-[rgba(74,222,128,0.2)] bg-[var(--color-success-soft)] text-[var(--color-success)]",
  warning:
    "border-[rgba(251,191,36,0.2)] bg-[var(--color-warning-soft)] text-[var(--color-warning)]",
  danger:
    "border-[rgba(248,113,113,0.2)] bg-[var(--color-danger-soft)] text-[var(--color-danger)]",
  accent:
    "border-[rgba(56,189,248,0.2)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]",
  pending:
    "border-dashed border-[var(--color-border-default)] text-[var(--color-text-tertiary)]",
};

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-2 py-0.5",
        "font-metric text-[0.625rem] font-medium uppercase tracking-[0.04em]",
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function statusToBadge(status: string): BadgeVariant {
  switch (status.toLowerCase()) {
    case "completed":
    case "active":
    case "success":
      return "success";
    case "processing":
    case "running":
      return "warning";
    case "failed":
    case "archived":
    case "error":
      return "danger";
    case "pending":
      return "pending";
    default:
      return "default";
  }
}
