import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { AppShell } from "./layout/AppShell.js";
import { MetricsSidebar } from "./layout/MetricsSidebar.js";

interface LayoutProps {
  children: ReactNode;
  showMetrics?: boolean;
}

export function Layout({ children, showMetrics = true }: LayoutProps) {
  const location = useLocation();
  const isOperationalHome = location.pathname === "/";

  return (
    <AppShell
      operationalHome={isOperationalHome}
      metricsSidebar={showMetrics && !isOperationalHome ? <MetricsSidebar /> : undefined}
    >
      {children}
    </AppShell>
  );
}
