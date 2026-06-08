import { memo, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { NavLink, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { CommandPalette } from "../command-palette/CommandPalette.js";
import { GlobalSearch } from "./GlobalSearch.js";
import { useShell } from "../../context/ShellContext.js";
import { navGroups } from "../../lib/navigation.js";
import { cn } from "../../lib/cn.js";
import { transition } from "../../design-system/motion.js";

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useShell();

  return (
    <aside
      className={cn(
        "sticky top-0 flex h-screen shrink-0 flex-col border-r border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] transition-[width] duration-200",
        sidebarCollapsed ? "w-[var(--sidebar-width-collapsed)]" : "w-[var(--sidebar-width)]",
      )}
    >
      <div
        className={cn(
          "flex items-center border-b border-[var(--color-border-subtle)]",
          sidebarCollapsed ? "justify-center px-2 py-4" : "gap-3 px-4 py-4",
        )}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[var(--color-border-default)] bg-[var(--color-surface-1)]">
          <svg viewBox="0 0 24 24" className="h-4 w-4 text-[var(--color-accent)]" fill="none">
            <path
              d="M4 8h16M4 12h12M4 16h14"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <circle cx="18" cy="12" r="2" fill="currentColor" />
          </svg>
        </div>
        {!sidebarCollapsed && (
          <div className="min-w-0 flex-1">
            <span className="block text-sm font-semibold tracking-[-0.02em] text-[var(--color-text-primary)]">
              Midgley Memory
            </span>
            <span className="block font-metric text-[0.625rem] uppercase tracking-[0.06em] text-[var(--color-text-tertiary)]">
              Intelligence Middleware
            </span>
          </div>
        )}
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[var(--color-border-subtle)]",
            "text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)]",
            sidebarCollapsed && "mt-2 w-full border-0",
          )}
        >
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
            <path
              d={sidebarCollapsed ? "M6 4l4 4-4 4" : "M10 4L6 8l4 4"}
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-4">
            {!sidebarCollapsed && (
              <span className="mb-1.5 block px-2 font-metric text-[0.625rem] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">
                {group.label}
              </span>
            )}
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={"end" in item ? item.end : false}
                  title={sidebarCollapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    cn(
                      "group relative flex items-center rounded-md text-[0.8125rem] font-medium transition-colors duration-150",
                      sidebarCollapsed ? "justify-center px-2 py-2.5" : "px-2.5 py-2",
                      isActive
                        ? "bg-[var(--color-accent-muted)] text-[var(--color-text-primary)]"
                        : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)]",
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && !sidebarCollapsed && (
                        <motion.span
                          layoutId="nav-indicator"
                          className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-[var(--color-accent)]"
                          transition={transition.normal}
                        />
                      )}
                      {sidebarCollapsed ? (
                        <span className="font-metric text-[0.6875rem] uppercase">
                          {item.label.slice(0, 2)}
                        </span>
                      ) : (
                        item.label
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {!sidebarCollapsed && (
        <div className="border-t border-[var(--color-border-subtle)] p-4">
          <div className="grid grid-cols-2 gap-2">
            <SidebarStat label="Runtime" value="DEV" />
            <SidebarStat label="Version" value="0.1.0" />
          </div>
        </div>
      )}
    </aside>
  );
}

function SidebarStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] px-2.5 py-2">
      <span className="block font-metric text-[0.5625rem] uppercase tracking-[0.08em] text-[var(--color-text-tertiary)]">
        {label}
      </span>
      <span className="mt-0.5 block font-metric text-xs font-medium text-[var(--color-text-secondary)]">
        {value}
      </span>
    </div>
  );
}

interface AppShellProps {
  children: ReactNode;
  metricsSidebar?: ReactNode;
  operationalHome?: boolean;
}

export function AppShell({ children, metricsSidebar, operationalHome = false }: AppShellProps) {
  return (
    <>
      <div className="flex min-h-screen bg-[var(--color-void)]">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          {!operationalHome && <TopBar />}
          <div className="flex min-h-0 flex-1">
            <main
              className={cn(
                "min-w-0 flex-1",
                operationalHome ? "overflow-hidden" : "overflow-y-auto px-8 py-7 lg:px-10",
              )}
            >
              {children}
            </main>
            {metricsSidebar}
          </div>
        </div>
      </div>
      <CommandPalette />
    </>
  );
}

export function TopBar() {
  return (
    <header className="sticky top-0 z-20 flex h-[var(--topbar-height)] items-center gap-4 border-b border-[var(--color-border-subtle)] glass-subtle px-6 lg:px-8">
      <TopBarStatus />
      <div className="mx-auto hidden w-full max-w-md md:block">
        <GlobalSearch compact />
      </div>
      <TopBarClock />
    </header>
  );
}

function TopBarStatus() {
  const location = useLocation();
  const label =
    location.pathname === "/"
      ? "Dashboard"
      : location.pathname
          .slice(1)
          .split("/")
          .map((s) => s.replace(/-/g, " "))
          .join(" · ");

  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="inline-flex items-center gap-2 rounded-full border border-[rgba(74,222,128,0.15)] bg-[var(--color-success-soft)] px-2.5 py-1">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-success)] opacity-40" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--color-success)]" />
        </span>
        <span className="font-metric text-[0.625rem] font-medium uppercase tracking-[0.06em] text-[var(--color-success)]">
          Operational
        </span>
      </span>
      <span className="hidden truncate font-metric text-[0.625rem] uppercase tracking-[0.06em] text-[var(--color-text-tertiary)] sm:inline">
        {label}
      </span>
    </div>
  );
}

const TopBarClock = memo(function TopBarClock() {
  const clockRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const updateClock = () => {
      if (clockRef.current) {
        clockRef.current.textContent = new Date().toISOString().slice(11, 19);
      }
    };

    updateClock();
    const id = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <span className="shrink-0 font-metric text-xs tabular-nums text-[var(--color-text-secondary)]">
      <span ref={clockRef}>{new Date().toISOString().slice(11, 19)}</span>
      <span className="text-[var(--color-text-muted)]"> UTC</span>
    </span>
  );
});
