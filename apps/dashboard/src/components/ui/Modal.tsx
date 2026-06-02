import { useEffect, type ReactNode } from "react";
import { cn } from "../../lib/cn.js";
import { Button } from "./Button.js";

interface ModalProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  className,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={cn(
          "relative z-10 w-full max-w-lg rounded-xl border border-[var(--color-border-default)]",
          "bg-[var(--color-surface-1)] shadow-[var(--shadow-elevated)]",
          className,
        )}
      >
        <header className="border-b border-[var(--color-border-subtle)] px-5 py-4">
          <h2 id="modal-title" className="text-base font-semibold text-[var(--color-text-primary)]">
            {title}
          </h2>
          {description && (
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{description}</p>
          )}
        </header>
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--color-border-subtle)] px-5 py-4">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}

interface ModalActionsProps {
  onCancel: () => void;
  cancelLabel?: string;
  primaryLabel: string;
  onPrimary: () => void;
  primaryLoading?: boolean;
  primaryDisabled?: boolean;
}

export function ModalActions({
  onCancel,
  cancelLabel = "Cancel",
  primaryLabel,
  onPrimary,
  primaryLoading,
  primaryDisabled,
}: ModalActionsProps) {
  return (
    <>
      <Button variant="secondary" onClick={onCancel}>
        {cancelLabel}
      </Button>
      <Button
        loading={primaryLoading ?? false}
        disabled={primaryDisabled ?? false}
        onClick={onPrimary}
      >
        {primaryLabel}
      </Button>
    </>
  );
}
