import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Badge, statusToBadge } from "./ui/Badge.js";
import { Panel } from "./ui/Panel.js";
import { transition } from "../design-system/motion.js";

interface StatusPanelProps {
  title: string;
  description?: string;
  status?: string;
  href?: string;
  loading?: boolean;
  code?: string;
}

export function StatusPanel({
  title,
  description,
  status,
  href,
  loading,
  code,
}: StatusPanelProps) {
  if (loading) {
    return (
      <Panel title={title} description={description} {...(code ? { code } : {})}>
        <div className="flex items-center gap-3 py-4">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-border-default)] border-t-[var(--color-accent)]" />
          <span className="font-metric text-xs text-[var(--color-text-secondary)]">Loading…</span>
        </div>
      </Panel>
    );
  }

  const content = (
    <>
      {status && (
        <div className="mt-3">
          <Badge variant={statusToBadge(status)}>{status}</Badge>
        </div>
      )}
      {href && (
        <span className="mt-4 inline-flex items-center gap-1.5 font-metric text-[0.6875rem] uppercase tracking-[0.06em] text-[var(--color-text-tertiary)] group-hover:text-[var(--color-accent)] transition-colors">
          Open
          <svg className="h-3 w-3 transition-transform group-hover:translate-x-0.5" viewBox="0 0 12 12" fill="none">
            <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      )}
    </>
  );

  if (href) {
    return (
      <Link to={href} className="group block no-underline">
        <motion.div whileHover={{ y: -2 }} transition={transition.fast}>
          <Panel title={title} description={description} interactive {...(code ? { code } : {})}>
            {content}
          </Panel>
        </motion.div>
      </Link>
    );
  }

  return (
    <Panel title={title} description={description} {...(code ? { code } : {})}>
      {content}
    </Panel>
  );
}
