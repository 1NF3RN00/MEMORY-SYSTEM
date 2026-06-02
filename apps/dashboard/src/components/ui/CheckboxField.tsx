interface CheckboxFieldProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function CheckboxField({ label, checked, onChange }: CheckboxFieldProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2.5"
    >
      <span
        className={`relative h-[18px] w-8 rounded-full border transition-colors duration-150 ${
          checked
            ? "border-[rgba(56,189,248,0.3)] bg-[var(--color-accent-soft)]"
            : "border-[var(--color-border-default)] bg-[var(--color-surface-3)]"
        }`}
      >
        <span
          className={`absolute top-0.5 h-3 w-3 rounded-full transition-all duration-150 ${
            checked
              ? "left-[17px] bg-[var(--color-accent)]"
              : "left-0.5 bg-[var(--color-text-tertiary)]"
          }`}
        />
      </span>
      <span className="font-metric text-xs text-[var(--color-text-secondary)]">{label}</span>
    </button>
  );
}
