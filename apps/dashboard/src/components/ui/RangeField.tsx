import { useCallback, useRef, type KeyboardEvent, type PointerEvent } from "react";
import { cn } from "../../lib/cn.js";

interface RangeFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}

export function RangeField({
  label,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.05,
  className,
}: RangeFieldProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  const snap = useCallback(
    (raw: number) => {
      const clamped = Math.max(min, Math.min(max, raw));
      const stepped = Math.round(clamped / step) * step;
      return Number(stepped.toFixed(2));
    },
    [min, max, step],
  );

  const setFromClientX = useCallback(
    (clientX: number) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect) return;
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      onChange(snap(min + ratio * (max - min)));
    },
    [min, max, onChange, snap],
  );

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setFromClientX(e.clientX);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    setFromClientX(e.clientX);
  };

  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center justify-between gap-3">
        <span className="font-metric text-[0.625rem] uppercase tracking-[0.06em] text-[var(--color-text-tertiary)]">
          {label}
        </span>
        <span className="font-metric text-sm tabular-nums text-[var(--color-text-primary)]">
          {value.toFixed(2)}
        </span>
      </div>

      <div
        ref={trackRef}
        className="relative h-8 w-full cursor-pointer touch-none select-none rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/40"
        role="slider"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-label={label}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
          if (e.key === "ArrowRight" || e.key === "ArrowUp") {
            e.preventDefault();
            onChange(snap(value + step));
          }
          if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
            e.preventDefault();
            onChange(snap(value - step));
          }
        }}
      >
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[var(--color-surface-3)]" />
        <div
          className="absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[var(--color-accent)]"
          style={{ width: `${pct}%` }}
        />
        <div
          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--color-accent)] bg-[var(--color-surface-1)] shadow-[0_0_0_1px_rgba(0,0,0,0.4)]"
          style={{ left: `${pct}%` }}
        />
        <div className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-between px-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <span
              key={i}
              className="h-2 w-px bg-[var(--color-border-strong)]"
              aria-hidden="true"
            />
          ))}
        </div>
      </div>

      <div className="flex justify-between font-metric text-[0.5625rem] tabular-nums text-[var(--color-text-muted)]">
        <span>{min.toFixed(2)}</span>
        <span>{max.toFixed(2)}</span>
      </div>
    </div>
  );
}
