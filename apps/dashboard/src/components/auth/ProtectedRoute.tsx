import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../../context/AuthContext.js";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { loading, workspace } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-void)] font-mono text-xs uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
        Initializing operational session…
      </div>
    );
  }

  // Session alone is not enough — API must resolve platform user + workspace via /auth/me.
  const authenticated = Boolean(workspace);

  if (!authenticated) {
    return <Navigate to="/access" state={{ from: location.pathname }} replace />;
  }

  return <>{children}</>;
}
