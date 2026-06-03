import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

let adminClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for auth operations");
  }
  if (!adminClient) {
    adminClient = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return adminClient;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function passwordSetupRedirectUrl(): string | undefined {
  return (
    process.env.PASSWORD_SETUP_REDIRECT_URL ??
    process.env.SUPABASE_SETUP_REDIRECT_URL
  );
}

/** Sends Supabase recovery email so the user can set their password (idempotent). */
export async function sendPasswordSetupEmail(email: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const redirectTo = passwordSetupRedirectUrl();
  const { error: resetError } = await supabase.auth.resetPasswordForEmail(
    email,
    redirectTo ? { redirectTo } : {},
  );
  if (resetError) {
    throw new Error(resetError.message);
  }
}

async function findAuthUserByEmail(email: string): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const normalized = email.toLowerCase();
  let page = 1;
  const perPage = 200;
  while (page <= 20) {
    const response = await supabase.auth.admin.listUsers({ page, perPage });
    if (response.error) {
      throw new Error(response.error.message);
    }
    // listUsers() is a discriminated union; TS 6 does not narrow users after error check.
    const users: User[] = response.data.users;
    const match = users.find((u) => u.email?.toLowerCase() === normalized);
    if (match) return match.id;
    if (users.length < perPage) break;
    page += 1;
  }
  return null;
}

/** Sets password directly (no email). Requires service role. */
export async function setAuthUserPassword(email: string, password: string): Promise<string> {
  const userId = await findAuthUserByEmail(email);
  if (!userId) {
    throw new Error(`No Supabase auth user found for ${email}`);
  }
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.auth.admin.updateUserById(userId, { password });
  if (error) throw new Error(error.message);
  return userId;
}

/** Creates Supabase auth user if needed, then sends password-setup email. */
export async function createAuthUserAndInvite(email: string): Promise<{ supabaseUserId: string }> {
  const existingId = await findAuthUserByEmail(email);
  if (existingId) {
    await sendPasswordSetupEmail(email);
    return { supabaseUserId: existingId };
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(error?.message ?? "Failed to create Supabase auth user");
  }

  await sendPasswordSetupEmail(email);
  return { supabaseUserId: data.user.id };
}

export async function verifySupabaseJwt(token: string): Promise<{
  sub: string;
  email?: string;
} | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  const result: { sub: string; email?: string } = { sub: data.user.id };
  if (data.user.email) result.email = data.user.email;
  return result;
}
