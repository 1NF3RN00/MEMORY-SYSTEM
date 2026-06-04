import { Link, useParams } from "react-router-dom";
import { cn } from "../../lib/cn.js";

interface WorkflowSubNavProps {
  workflowName?: string | undefined;
  active: "runs" | "outputs";
}

export function WorkflowSubNav({ workflowName, active }: WorkflowSubNavProps) {
  const { workflowId } = useParams();
  if (!workflowId) return null;

  const tabs = [
    { id: "runs" as const, label: "Runs", to: `/workflows/${workflowId}/runs` },
    { id: "outputs" as const, label: "Outputs", to: `/workflows/${workflowId}/outputs` },
  ];

  return (
    <nav className="flex flex-col gap-3 border-b border-[var(--color-border-default)] pb-4">
      <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--color-text-tertiary)]">
        <Link to="/workflows" className="hover:text-[var(--color-text-secondary)]">
          Workflows
        </Link>
        <span>/</span>
        <span className="text-[var(--color-text-secondary)]">{workflowName ?? workflowId}</span>
      </div>
      <div className="flex gap-2">
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            to={tab.to}
            className={cn(
              "rounded px-3 py-1.5 text-sm font-medium transition-colors",
              active === tab.id
                ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                : "text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-secondary)]",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
