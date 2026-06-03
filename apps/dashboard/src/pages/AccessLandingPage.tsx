import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { OperationalBackdrop } from "../components/auth/OperationalBackdrop.js";
import { useAuth } from "../context/AuthContext.js";
import { apiPost } from "../lib/api.js";
import { isSupabaseConfigured, supabase } from "../lib/supabase.js";

type Panel = "login" | "request";

function parseAuthHashError(): string | null {
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  if (!params.get("error") && !params.get("error_code")) return null;
  return (
    params.get("error_description")?.replace(/\+/g, " ") ??
    "Email link is invalid or has expired."
  );
}

function clearAuthHash(): void {
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
}

export function AccessLandingPage() {
  const { signIn, loading, workspace, session, refreshProfile } = useAuth();
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [hashError, setHashError] = useState<string | null>(() => parseAuthHashError());
  const [panel, setPanel] = useState<Panel>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [company, setCompany] = useState("");
  const [useCase, setUseCase] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (hashError) clearAuthHash();
  }, [hashError]);

  useEffect(() => {
    if (!supabase) return;
    if (window.location.hash.includes("type=recovery")) {
      setRecoveryMode(true);
    }
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setRecoveryMode(true);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (loading || workspace || recoveryMode || !session) return;
    setError(
      "Signed in, but the API did not return a workspace. Restart the API (auth fix) and try again, or run platform:bootstrap for your email.",
    );
  }, [loading, workspace, session, recoveryMode]);

  const readyToEnter = !loading && Boolean(workspace) && !recoveryMode;

  if (readyToEnter) {
    return <Navigate to="/" replace />;
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (!supabase) {
        setError("Supabase auth is not configured.");
        return;
      }
      if (newPassword.length < 8) {
        setError("Password must be at least 8 characters.");
        return;
      }
      if (newPassword !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
      setRecoveryMode(false);
      setNewPassword("");
      setConfirmPassword("");
      clearAuthHash();
      setMessage("Password saved. Sign in with your email and new password.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set password");
    } finally {
      setBusy(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (!isSupabaseConfigured) {
        setError("Supabase auth is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
        return;
      }
      await signIn(email.trim(), password);
      const profileLoaded = await refreshProfile();
      if (!profileLoaded) {
        setError(
          "Signed in, but workspace profile failed to load. Ensure the API is running and redeployed with the latest /auth/me fix.",
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleRequestAccess(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await apiPost("/access/request", {
        email: email.trim(),
        company: company.trim() || undefined,
        useCase: useCase.trim() || undefined,
        note: note.trim() || undefined,
      });
      setMessage("Access request submitted. Awaiting operational approval.");
      setCompany("");
      setUseCase("");
      setNote("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-[var(--color-void)] text-[var(--color-text-primary)]">
      <OperationalBackdrop />

      <header className="relative z-10 flex items-center justify-between border-b border-[var(--color-border-subtle)] px-8 py-5">
        <div>
          <p className="font-mono text-[0.625rem] uppercase tracking-[0.2em] text-[var(--color-accent)]">
            Contextual Middleware Infrastructure
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-[-0.03em]">Operational Access Gateway</h1>
        </div>
        <div className="hidden items-center gap-6 font-mono text-[0.6875rem] text-[var(--color-text-tertiary)] md:flex">
          <span>STATUS: INVITE_ONLY</span>
          <span>PROVISIONING: CONTROLLED</span>
          <span className="text-[var(--color-success)]">● SECURE CHANNEL</span>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 py-12">
        <div className="mb-8 flex gap-2">
          {(["login", "request"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setPanel(key);
                setError(null);
                setMessage(null);
              }}
              className={`rounded-md border px-4 py-2 font-mono text-xs uppercase tracking-[0.1em] transition-colors ${
                panel === key
                  ? "border-[var(--color-accent)]/50 bg-[var(--color-accent-muted)] text-[var(--color-text-primary)]"
                  : "border-[var(--color-border-subtle)] text-[var(--color-text-tertiary)] hover:border-[var(--color-border-default)]"
              }`}
            >
              {key === "login" ? "Authorized Login" : "Request Access"}
            </button>
          ))}
        </div>

        {hashError && (
          <p className="mb-6 rounded-md border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 px-4 py-3 text-sm text-[var(--color-danger)]">
            {hashError} Request a new setup email:{" "}
            <code className="text-[var(--color-accent)]">
              npm run platform:bootstrap -- your@email.com
            </code>{" "}
            (with dashboard running at the URL in PASSWORD_SETUP_REDIRECT_URL).
          </p>
        )}

        <motion.div
          layout
          className="overflow-hidden rounded-xl border border-[var(--color-border-default)] bg-[var(--color-surface-0)]/90 shadow-[var(--shadow-elevated)] backdrop-blur-md"
        >
          <AnimatePresence mode="wait">
            {recoveryMode ? (
              <motion.form
                key="recovery"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                onSubmit={handleSetPassword}
                className="p-8 md:p-10"
              >
                <h2 className="text-lg font-medium">Set Your Password</h2>
                <p className="mt-2 max-w-xl text-sm text-[var(--color-text-secondary)]">
                  Complete setup from your invite email. Choose a password, then sign in on the login
                  tab.
                </p>
                <div className="mt-6 space-y-4 max-w-md">
                  <label className="block">
                    <span className="font-mono text-[0.625rem] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">
                      New Password
                    </span>
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="mt-1.5 w-full rounded-md border border-[var(--color-border-default)] bg-[var(--color-surface-1)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-accent)]/60"
                    />
                  </label>
                  <label className="block">
                    <span className="font-mono text-[0.625rem] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">
                      Confirm Password
                    </span>
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="mt-1.5 w-full rounded-md border border-[var(--color-border-default)] bg-[var(--color-surface-1)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-accent)]/60"
                    />
                  </label>
                </div>
                {error && <p className="mt-4 text-sm text-[var(--color-danger)]">{error}</p>}
                {message && <p className="mt-4 text-sm text-[var(--color-success)]">{message}</p>}
                <button
                  type="submit"
                  disabled={busy}
                  className="mt-6 rounded-md border border-[var(--color-accent)]/40 bg-[var(--color-accent-soft)] px-6 py-2.5 font-mono text-xs uppercase tracking-[0.12em] text-[var(--color-accent)] transition hover:bg-[var(--color-accent)]/20 disabled:opacity-50"
                >
                  {busy ? "Saving…" : "Save Password"}
                </button>
              </motion.form>
            ) : panel === "login" ? (
              <motion.form
                key="login"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                onSubmit={handleLogin}
                className="grid gap-6 p-8 md:grid-cols-[1fr_280px] md:p-10"
              >
                <div>
                  <h2 className="text-lg font-medium">Infrastructure Login</h2>
                  <p className="mt-2 max-w-md text-sm text-[var(--color-text-secondary)]">
                    For provisioned operators only. Access is workspace-scoped and fully isolated across
                    middleware systems.
                  </p>
                  <div className="mt-6 space-y-4">
                    <label className="block">
                      <span className="font-mono text-[0.625rem] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">
                        Operator Email
                      </span>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="mt-1.5 w-full rounded-md border border-[var(--color-border-default)] bg-[var(--color-surface-1)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-accent)]/60"
                      />
                    </label>
                    <label className="block">
                      <span className="font-mono text-[0.625rem] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">
                        Password
                      </span>
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="mt-1.5 w-full rounded-md border border-[var(--color-border-default)] bg-[var(--color-surface-1)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-accent)]/60"
                      />
                    </label>
                  </div>
                  {error && (
                    <p className="mt-4 text-sm text-[var(--color-danger)]">{error}</p>
                  )}
                  <button
                    type="submit"
                    disabled={busy}
                    className="mt-6 rounded-md border border-[var(--color-accent)]/40 bg-[var(--color-accent-soft)] px-6 py-2.5 font-mono text-xs uppercase tracking-[0.12em] text-[var(--color-accent)] transition hover:bg-[var(--color-accent)]/20 disabled:opacity-50"
                  >
                    {busy ? "Authenticating…" : "Enter Operations"}
                  </button>
                </div>
                <aside className="border-t border-[var(--color-border-subtle)] pt-6 font-mono text-[0.6875rem] text-[var(--color-text-tertiary)] md:border-t-0 md:border-l md:pl-8 md:pt-0">
                  <p className="text-[var(--color-text-secondary)]">Provisioning Flow</p>
                  <ol className="mt-4 space-y-2 list-decimal pl-4">
                    <li>Request access</li>
                    <li>Admin approval</li>
                    <li>Workspace provisioned</li>
                    <li>Middleware initialized</li>
                    <li>Password setup via email</li>
                    <li>Dashboard access</li>
                  </ol>
                </aside>
              </motion.form>
            ) : (
              <motion.form
                key="request"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                onSubmit={handleRequestAccess}
                className="p-8 md:p-10"
              >
                <h2 className="text-lg font-medium">Request Infrastructure Access</h2>
                <p className="mt-2 max-w-xl text-sm text-[var(--color-text-secondary)]">
                  No public signup. Submit an operational access request for admin review and controlled
                  workspace provisioning.
                </p>
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <label className="block md:col-span-2">
                    <span className="font-mono text-[0.625rem] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">
                      Email *
                    </span>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="mt-1.5 w-full rounded-md border border-[var(--color-border-default)] bg-[var(--color-surface-1)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-accent)]/60"
                    />
                  </label>
                  <label className="block">
                    <span className="font-mono text-[0.625rem] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">
                      Company
                    </span>
                    <input
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      className="mt-1.5 w-full rounded-md border border-[var(--color-border-default)] bg-[var(--color-surface-1)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-accent)]/60"
                    />
                  </label>
                  <label className="block">
                    <span className="font-mono text-[0.625rem] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">
                      Use Case
                    </span>
                    <input
                      value={useCase}
                      onChange={(e) => setUseCase(e.target.value)}
                      className="mt-1.5 w-full rounded-md border border-[var(--color-border-default)] bg-[var(--color-surface-1)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-accent)]/60"
                    />
                  </label>
                  <label className="block md:col-span-2">
                    <span className="font-mono text-[0.625rem] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">
                      Operational Note
                    </span>
                    <textarea
                      rows={3}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      className="mt-1.5 w-full resize-none rounded-md border border-[var(--color-border-default)] bg-[var(--color-surface-1)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-accent)]/60"
                    />
                  </label>
                </div>
                {error && <p className="mt-4 text-sm text-[var(--color-danger)]">{error}</p>}
                {message && (
                  <p className="mt-4 text-sm text-[var(--color-success)]">{message}</p>
                )}
                <button
                  type="submit"
                  disabled={busy}
                  className="mt-6 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface-2)] px-6 py-2.5 font-mono text-xs uppercase tracking-[0.12em] transition hover:bg-[var(--color-surface-3)] disabled:opacity-50"
                >
                  {busy ? "Submitting…" : "Submit Access Request"}
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </motion.div>
      </main>

      <footer className="relative z-10 border-t border-[var(--color-border-subtle)] px-8 py-4 font-mono text-[0.625rem] text-[var(--color-text-muted)]">
        WORKSPACE ISOLATION ENFORCED · API KEYS HASHED AT REST · NO ANONYMOUS MIDDLEWARE ACCESS
        <span className="mt-2 block text-[var(--color-text-tertiary)]">
          First operator? Run{" "}
          <code className="text-[var(--color-accent)]">npm run platform:bootstrap -- your@email.com</code>{" "}
          from the repo (see .env.example), then use the password email to log in.
        </span>
      </footer>
    </div>
  );
}
