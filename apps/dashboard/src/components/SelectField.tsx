import { useEffect, useId, useRef, useState } from "react";
import { cn } from "../lib/cn.js";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  className?: string;
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  className,
}: SelectFieldProps) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;

    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }

      if (!open) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlight((h) => (h + 1) % options.length);
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((h) => (h <= 0 ? options.length - 1 : h - 1));
      }
      if (e.key === "Enter" && highlight >= 0 && options[highlight]) {
        e.preventDefault();
        onChange(options[highlight].value);
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, highlight, options, onChange]);

  useEffect(() => {
    if (open) {
      const idx = options.findIndex((o) => o.value === value);
      setHighlight(idx >= 0 ? idx : 0);
    }
  }, [open, options, value]);

  return (
    <div ref={wrapRef} className={cn("flex flex-col gap-1.5", className)}>
      <span className="font-metric text-[0.625rem] uppercase tracking-[0.06em] text-[var(--color-text-tertiary)]">
        {label}
      </span>
      <div className="relative">
        <button
          type="button"
          className={cn(
            "flex w-full items-center justify-between rounded-md border px-3 py-2",
            "font-metric text-sm text-[var(--color-text-primary)]",
            "bg-[var(--color-surface-2)] transition-colors",
            open
              ? "border-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/30"
              : "border-[var(--color-border-default)] hover:border-[var(--color-border-strong)]",
          )}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((o) => !o)}
        >
          <span>{selected?.label ?? value}</span>
          <svg className={cn("h-3 w-3 text-[var(--color-text-tertiary)] transition-transform", open && "rotate-180")} viewBox="0 0 12 12" fill="none">
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.25" />
          </svg>
        </button>

        {open && (
          <ul
            id={listId}
            role="listbox"
            className="absolute top-full z-50 mt-1 w-full rounded-md border border-[var(--color-border-default)] bg-[var(--color-surface-1)] p-1 shadow-[var(--shadow-elevated)]"
          >
            {options.map((opt, i) => (
              <li key={opt.value} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={opt.value === value}
                  className={cn(
                    "flex w-full items-center gap-2 rounded px-2.5 py-2 text-left font-metric text-sm transition-colors",
                    opt.value === value
                      ? "text-[var(--color-accent)] bg-[var(--color-accent-muted)]"
                      : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)]",
                    i === highlight && opt.value !== value && "bg-[var(--color-surface-2)]",
                  )}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                >
                  {opt.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
