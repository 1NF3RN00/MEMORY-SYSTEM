import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { apiGet, setAuthTokenProvider } from "../lib/api.js";
import { isSupabaseConfigured, supabase } from "../lib/supabase.js";
import type { WorkspaceBootstrapStatus } from "@memory-middleware/shared-types";

export interface AuthUser {
  userId: string;
  email: string;
  isPlatformAdmin: boolean;
}

export interface AuthWorkspace {
  workspaceId: string;
  name: string;
  plan: string;
  archived: boolean;
  role: string;
  bootstrap: WorkspaceBootstrapStatus;
}

interface AuthState {
  loading: boolean;
  session: Session | null;
  user: AuthUser | null;
  workspace: AuthWorkspace | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

async function fetchProfile(accessToken: string): Promise<{
  user: AuthUser;
  workspace: AuthWorkspace;
} | null> {
  try {
    const data = await apiGet<{
      user: AuthUser;
      workspace: AuthWorkspace;
    }>("/auth/me", accessToken);
    return data;
  } catch (err) {
    console.error("[auth] /auth/me failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [workspace, setWorkspace] = useState<AuthWorkspace | null>(null);

  const refreshProfile = useCallback(async () => {
    if (!session?.access_token) {
      if (!isSupabaseConfigured) {
        const fallback = await apiGet<{
          id: string;
          workspaceId: string;
          name: string;
        }>("/workspaces/default");
        setWorkspace({
          workspaceId: fallback.workspaceId ?? fallback.id,
          name: fallback.name,
          plan: "internal",
          archived: false,
          role: "owner",
          bootstrap: {
            replayInitialized: true,
            diagnosticsInitialized: true,
            relationshipsInitialized: true,
            observabilityOnline: true,
            retrievalCalibrated: true,
            contextualMappingInitialized: true,
          },
        });
        setUser({
          userId: "dev",
          email: "dev@local",
          isPlatformAdmin: true,
        });
      }
      return;
    }
    const profile = await fetchProfile(session.access_token);
    if (profile) {
      setUser(profile.user);
      setWorkspace(profile.workspace);
    }
  }, [session]);

  useEffect(() => {
    setAuthTokenProvider(() => session?.access_token ?? null);
  }, [session]);

  useEffect(() => {
    if (!supabase) {
      void refreshProfile().finally(() => setLoading(false));
      return;
    }

    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (loading) return;
    void refreshProfile();
  }, [loading, session, refreshProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error("Supabase is not configured");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setWorkspace(null);
  }, []);

  const value = useMemo(
    () => ({
      loading,
      session,
      user,
      workspace,
      signIn,
      signOut,
      refreshProfile,
    }),
    [loading, session, user, workspace, signIn, signOut, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
