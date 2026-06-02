import { useShell } from "../../context/ShellContext.js";
import { cn } from "../../lib/cn.js";

interface GlobalSearchProps {
  className?: string;
  compact?: boolean;
}

export function GlobalSearch({ className, compact }: GlobalSearchProps) {
  const { openCommandPalette } = useShell();

  return (
    <button
      type="button"
      onClick={() => openCommandPalette()}
      className={cn(
        "flex w-full items-center gap-2 rounded-md border border-[var(--color-border-default)]",
        "bg-[var(--color-surface-1)] px-3 text-left transition-colors",
        "hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-2)]",
        compact ? "py-1.5" : "py-2",
        className,
      )}
    >
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-tertiary)]" fill="none">
        <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.2" />
        <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
      <span className="flex-1 truncate text-[0.8125rem] text-[var(--color-text-tertiary)]">
        Search memories, traces, scopes…
      </span>
      <kbd className="hidden rounded border border-[var(--color-border-default)] px-1.5 py-0.5 font-metric text-[0.625rem] text-[var(--color-text-tertiary)] sm:inline">
        Ctrl K
      </kbd>
    </button>
  );
}
