import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useShell } from "../../context/ShellContext.js";
import { apiGet, apiPost } from "../../lib/api.js";
import { filterNavItems } from "../../lib/navigation.js";
import { cn } from "../../lib/cn.js";
import { Button } from "../ui/Button.js";

interface SearchResultItem {
  type: "page" | "memory" | "retrieval" | "ingestion" | "compression" | "plan" | "delivery";
  id: string;
  label: string;
  subtitle: string;
  path: string;
}

interface PaletteItem {
  key: string;
  type: string;
  label: string;
  subtitle: string;
  path: string;
}

const CLEAR_CONFIRMATION = "clear all data";

const TYPE_LABELS: Record<string, string> = {
  page: "Page",
  memory: "Memory",
  retrieval: "Retrieval",
  ingestion: "Ingestion",
  compression: "Compression",
  plan: "Plan",
  delivery: "Delivery",
};

export function CommandPalette() {
  const navigate = useNavigate();
  const {
    commandPaletteOpen,
    commandQuery,
    closeCommandPalette,
    setCommandQuery,
    notifyDataCleared,
  } = useShell();

  const inputRef = useRef<HTMLInputElement>(null);
  const [remoteResults, setRemoteResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [clearMode, setClearMode] = useState(false);
  const [clearInput, setClearInput] = useState("");
  const [clearing, setClearing] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);

  const pageResults = useMemo<PaletteItem[]>(() => {
    return filterNavItems(commandQuery).map((item) => ({
      key: `page:${item.to}`,
      type: "page",
      label: item.label,
      subtitle: item.to,
      path: item.to,
    }));
  }, [commandQuery]);

  const apiResults = useMemo<PaletteItem[]>(() => {
    return remoteResults.map((item) => ({
      key: `${item.type}:${item.id}`,
      type: item.type,
      label: item.label,
      subtitle: item.subtitle,
      path: item.path,
    }));
  }, [remoteResults]);

  const results = useMemo(() => {
    const seen = new Set<string>();
    const merged: PaletteItem[] = [];
    for (const item of [...pageResults, ...apiResults]) {
      if (seen.has(item.path)) continue;
      seen.add(item.path);
      merged.push(item);
    }
    return merged.slice(0, 20);
  }, [pageResults, apiResults]);

  useEffect(() => {
    if (!commandPaletteOpen) return;
    setSelectedIndex(0);
    setClearMode(false);
    setClearInput("");
    setClearError(null);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [commandPaletteOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [commandQuery, results.length]);

  useEffect(() => {
    if (!commandPaletteOpen) return;
    const q = commandQuery.trim();
    if (q.length < 2) {
      setRemoteResults([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const timer = window.setTimeout(() => {
      apiGet<{ id: string }>("/workspaces/default")
        .then((workspace) =>
          apiGet<{ results: SearchResultItem[] }>(
            `/search?q=${encodeURIComponent(q)}&workspaceId=${workspace.id}&limit=16`,
          ),
        )
        .then((res) => {
          if (!cancelled) setRemoteResults(res.results);
        })
        .catch(() => {
          if (!cancelled) setRemoteResults([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [commandPaletteOpen, commandQuery]);

  const selectItem = (item: PaletteItem) => {
    closeCommandPalette();
    navigate(item.path);
  };

  const handleClearData = async () => {
    if (clearInput.trim().toLowerCase() !== CLEAR_CONFIRMATION) return;
    setClearing(true);
    setClearError(null);
    try {
      await apiPost("/workspaces/default/clear", { confirmation: CLEAR_CONFIRMATION });
      notifyDataCleared();
      closeCommandPalette();
      navigate("/");
    } catch (error) {
      setClearError(error instanceof Error ? error.message : "Failed to clear data");
    } finally {
      setClearing(false);
    }
  };

  if (!commandPaletteOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[12vh]">
      <button
        type="button"
        aria-label="Close command palette"
        className="absolute inset-0 bg-black/70"
        onClick={closeCommandPalette}
      />
      <motion.div
        initial={{ opacity: 0, y: -8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.98 }}
        transition={{ duration: 0.18 }}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="relative z-10 flex w-full max-w-xl flex-col overflow-hidden rounded-xl border border-[var(--color-border-default)] bg-[var(--color-surface-1)] shadow-[var(--shadow-elevated)]"
      >
        <div className="flex items-center gap-2 border-b border-[var(--color-border-subtle)] px-4 py-3">
          <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0 text-[var(--color-text-tertiary)]" fill="none">
            <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.2" />
            <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            value={commandQuery}
            onChange={(e) => setCommandQuery(e.target.value)}
            onKeyDown={(e) => {
              if (clearMode) return;
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelectedIndex((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelectedIndex((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter" && results[selectedIndex]) {
                e.preventDefault();
                selectItem(results[selectedIndex]!);
              } else if (e.key === "Escape") {
                e.preventDefault();
                closeCommandPalette();
              }
            }}
            placeholder="Search pages, memories, traces…"
            className="w-full bg-transparent text-[0.875rem] text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-tertiary)]"
          />
          <kbd className="hidden rounded border border-[var(--color-border-default)] px-1.5 py-0.5 font-metric text-[0.625rem] text-[var(--color-text-tertiary)] sm:inline">
            Esc
          </kbd>
        </div>

        <div className="max-h-[min(50vh,420px)] overflow-y-auto py-2">
          {loading && (
            <p className="px-4 py-2 text-xs text-[var(--color-text-tertiary)]">Searching workspace…</p>
          )}

          {!loading && results.length === 0 && (
            <p className="px-4 py-6 text-sm text-[var(--color-text-secondary)]">
              {commandQuery.trim()
                ? "No matches found."
                : "Type to search pages, memories, and traces."}
            </p>
          )}

          <AnimatePresence initial={false}>
            {results.map((item, index) => (
              <motion.button
                key={item.key}
                type="button"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onMouseEnter={() => setSelectedIndex(index)}
                onClick={() => selectItem(item)}
                className={cn(
                  "flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors",
                  index === selectedIndex
                    ? "bg-[var(--color-accent-muted)]"
                    : "hover:bg-[var(--color-surface-2)]",
                )}
              >
                <span className="mt-0.5 w-16 shrink-0 font-metric text-[0.625rem] uppercase tracking-[0.06em] text-[var(--color-text-tertiary)]">
                  {TYPE_LABELS[item.type] ?? item.type}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.8125rem] font-medium text-[var(--color-text-primary)]">
                    {item.label}
                  </span>
                  <span className="block truncate font-metric text-[0.6875rem] text-[var(--color-text-tertiary)]">
                    {item.subtitle}
                  </span>
                </span>
              </motion.button>
            ))}
          </AnimatePresence>
        </div>

        <div className="border-t border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-4 py-3">
          {!clearMode ? (
            <button
              type="button"
              onClick={() => setClearMode(true)}
              className="flex w-full items-center justify-between rounded-md border border-[rgba(248,113,113,0.18)] bg-[var(--color-danger-soft)] px-3 py-2 text-left transition-colors hover:border-[rgba(248,113,113,0.35)]"
            >
              <span className="text-[0.8125rem] font-medium text-[var(--color-danger)]">
                Clear all data
              </span>
              <span className="font-metric text-[0.625rem] uppercase tracking-[0.06em] text-[var(--color-text-tertiary)]">
                Destructive
              </span>
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-[0.8125rem] text-[var(--color-text-secondary)]">
                Permanently delete all memories, traces, relationships, and operational history in
                the default workspace. Type{" "}
                <span className="font-metric text-[var(--color-danger)]">{CLEAR_CONFIRMATION}</span>{" "}
                to confirm.
              </p>
              <input
                value={clearInput}
                onChange={(e) => setClearInput(e.target.value)}
                placeholder={CLEAR_CONFIRMATION}
                className="w-full rounded-md border border-[var(--color-border-default)] bg-[var(--color-surface-1)] px-3 py-2 font-metric text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-danger)]"
              />
              {clearError && (
                <p className="text-xs text-[var(--color-danger)]">{clearError}</p>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setClearMode(false)}>
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  loading={clearing}
                  disabled={clearInput.trim().toLowerCase() !== CLEAR_CONFIRMATION}
                  onClick={() => void handleClearData()}
                >
                  Clear all data
                </Button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
