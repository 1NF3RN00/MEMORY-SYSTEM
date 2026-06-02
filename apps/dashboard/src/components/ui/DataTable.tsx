import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";

interface DataTableProps {
  children: ReactNode;
  className?: string;
  dense?: boolean;
}

export function DataTable({ children, className, dense }: DataTableProps) {
  return (
    <div className={cn("overflow-x-auto -mx-1", className)}>
      <table
        className={cn(
          "w-full border-collapse text-left",
          dense ? "text-xs" : "text-sm",
        )}
      >
        {children}
      </table>
    </div>
  );
}

export function DataTableHead({ children }: { children: ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-[var(--color-border-default)]">
        {children}
      </tr>
    </thead>
  );
}

export function DataTableHeaderCell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        "px-3 py-2.5 font-metric text-[0.625rem] font-medium uppercase tracking-[0.06em]",
        "text-[var(--color-text-tertiary)] bg-[var(--color-surface-2)]/50",
        "first:rounded-tl-md last:rounded-tr-md",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function DataTableBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function DataTableRow({
  children,
  className,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const Tag = onClick ? "tr" : "tr";
  return (
    <Tag
      onClick={onClick}
      className={cn(
        "border-b border-[var(--color-border-subtle)] transition-colors",
        "hover:bg-[var(--color-surface-2)]/60",
        onClick && "cursor-pointer",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function DataTableCell({ children, className, mono }: { children: ReactNode; className?: string; mono?: boolean }) {
  return (
    <td
      className={cn(
        "px-3 py-2.5 text-[var(--color-text-secondary)]",
        mono && "font-metric text-xs",
        className,
      )}
    >
      {children}
    </td>
  );
}
