import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "../../lib/cn.js";

const inputClass =
  "w-full rounded-md border border-[var(--color-border-default)] bg-[var(--color-surface-2)] px-3 py-2 font-metric text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] transition-colors focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]/30";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
}

export function TextField({ label, hint, className, ...props }: TextFieldProps) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="font-metric text-[0.625rem] uppercase tracking-[0.06em] text-[var(--color-text-tertiary)]">
        {label}
      </span>
      <input className={inputClass} {...props} />
      {hint && <span className="text-xs text-[var(--color-text-muted)]">{hint}</span>}
    </label>
  );
}

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
}

export function TextAreaField({ label, className, ...props }: TextAreaFieldProps) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="font-metric text-[0.625rem] uppercase tracking-[0.06em] text-[var(--color-text-tertiary)]">
        {label}
      </span>
      <textarea className={cn(inputClass, "min-h-[120px] resize-y leading-relaxed")} {...props} />
    </label>
  );
}
