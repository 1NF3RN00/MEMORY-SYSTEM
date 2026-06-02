import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn.js";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger";
  loading?: boolean;
  children: ReactNode;
}

const variants = {
  primary:
    "bg-[var(--color-text-primary)] text-[var(--color-void)] border-transparent hover:bg-white shadow-sm",
  secondary:
    "bg-transparent text-[var(--color-text-secondary)] border-[var(--color-border-default)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)]",
  danger:
    "bg-[var(--color-danger-soft)] text-[var(--color-danger)] border-[rgba(248,113,113,0.2)] hover:bg-[rgba(248,113,113,0.15)]",
};

export function Button({
  variant = "primary",
  loading = false,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-md border px-4 py-2",
        "font-metric text-xs font-medium uppercase tracking-[0.04em]",
        "transition-all duration-150 active:scale-[0.98]",
        "disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100",
        variants[variant],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? "Processing…" : children}
    </button>
  );
}
