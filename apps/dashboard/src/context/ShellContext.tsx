import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const SIDEBAR_STORAGE_KEY = "mms.sidebar.collapsed";

interface ShellContextValue {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  commandPaletteOpen: boolean;
  commandQuery: string;
  openCommandPalette: (query?: string) => void;
  closeCommandPalette: () => void;
  setCommandQuery: (query: string) => void;
  notifyDataCleared: () => void;
  dataClearVersion: number;
}

const ShellContext = createContext<ShellContextValue | null>(null);

export function ShellProvider({ children }: { children: ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [dataClearVersion, setDataClearVersion] = useState(0);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? "1" : "0");
      } catch {
        // ignore storage failures
      }
      return next;
    });
  }, []);

  const openCommandPalette = useCallback((query = "") => {
    setCommandQuery(query);
    setCommandPaletteOpen(true);
  }, []);

  const closeCommandPalette = useCallback(() => {
    setCommandPaletteOpen(false);
    setCommandQuery("");
  }, []);

  const notifyDataCleared = useCallback(() => {
    setDataClearVersion((v) => v + 1);
    window.dispatchEvent(new CustomEvent("mms:data-cleared"));
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isModK = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      if (!isModK) return;
      event.preventDefault();
      if (commandPaletteOpen) {
        closeCommandPalette();
      } else {
        openCommandPalette();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [commandPaletteOpen, closeCommandPalette, openCommandPalette]);

  const value = useMemo(
    () => ({
      sidebarCollapsed,
      toggleSidebar,
      commandPaletteOpen,
      commandQuery,
      openCommandPalette,
      closeCommandPalette,
      setCommandQuery,
      notifyDataCleared,
      dataClearVersion,
    }),
    [
      sidebarCollapsed,
      toggleSidebar,
      commandPaletteOpen,
      commandQuery,
      openCommandPalette,
      closeCommandPalette,
      notifyDataCleared,
      dataClearVersion,
    ],
  );

  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

export function useShell() {
  const ctx = useContext(ShellContext);
  if (!ctx) {
    throw new Error("useShell must be used within ShellProvider");
  }
  return ctx;
}
