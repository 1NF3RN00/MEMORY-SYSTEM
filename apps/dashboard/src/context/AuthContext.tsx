import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
  profileError: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<{ ok: boolean; error: string | null }>;
}

const AuthContext = createContext<AuthState | null>(null);

let lastProfileFetchError: string | null = null;

type ProfileFetchResult =
  | { ok: true; user: AuthUser; workspace: AuthWorkspace }
  | { ok: false; error: string; transient: boolean };

function isTransientProfileError(message: string): boolean {
  if (message === "Failed to fetch") return true;
  if (/^(502|503|504):/.test(message)) return true;
  return false;
}

async function fetchProfile(accessToken: string, attempt = 0): Promise<ProfileFetchResult> {
  try {
    const data = await apiGet<{
      user: AuthUser;
      workspace: AuthWorkspace;
    }>("/auth/me", accessToken);
    lastProfileFetchError = null;
    return { ok: true, user: data.user, workspace: data.workspace };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load workspace profile";
    if (attempt < 2 && isTransientProfileError(message)) {
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
      return fetchProfile(accessToken, attempt + 1);
    }
    lastProfileFetchError = message;
    console.error("[auth] /auth/me failed:", message);
    return { ok: false, error: message, transient: isTransientProfileError(message) };
  }
}

export function consumeLastProfileFetchError(): string | null {
  const err = lastProfileFetchError;
  lastProfileFetchError = null;
  return err;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [workspace, setWorkspace] = useState<AuthWorkspace | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const hasProfileRef = useRef(false);

  const refreshProfile = useCallback(async (): Promise<{ ok: boolean; error: string | null }> => {
    if (!session?.access_token) {
      if (!isSupabaseConfigured) {
        const fallback = await apiGet<{
          id: string;
          workspaceId: string;
          name: string;
        }>("/workspaces/default");
        setProfileError(null);
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
        hasProfileRef.current = true;
        return { ok: true, error: null };
      }
      hasProfileRef.current = false;
      setUser(null);
      setWorkspace(null);
      return { ok: false, error: null };
    }
    const profile = await fetchProfile(session.access_token);
    if (profile.ok) {
      hasProfileRef.current = true;
      setProfileError(null);
      setUser(profile.user);
      setWorkspace(profile.workspace);
      return { ok: true, error: null };
    }
    const err = consumeLastProfileFetchError() ?? profile.error;
    setProfileError(err);
    if (profile.transient && hasProfileRef.current) {
      return { ok: true, error: err };
    }
    hasProfileRef.current = false;
    setUser(null);
    setWorkspace(null);
    return { ok: false, error: err };
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

  useEffect(() => {
    if (!session?.access_token) return;
    const retryOnVisible = () => {
      if (document.visibilityState === "visible") {
        void refreshProfile();
      }
    };
    document.addEventListener("visibilitychange", retryOnVisible);
    return () => document.removeEventListener("visibilitychange", retryOnVisible);
  }, [session?.access_token, refreshProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error("Supabase is not configured");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
    hasProfileRef.current = false;
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
      profileError,
      signIn,
      signOut,
      refreshProfile,
    }),
    [loading, session, user, workspace, profileError, signIn, signOut, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
