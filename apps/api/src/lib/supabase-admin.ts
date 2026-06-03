import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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

export async function createAuthUserAndInvite(email: string): Promise<{ supabaseUserId: string }> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(error?.message ?? "Failed to create Supabase auth user");
  }

  const redirectTo = process.env.PASSWORD_SETUP_REDIRECT_URL;
  const { error: resetError } = await supabase.auth.resetPasswordForEmail(
    email,
    redirectTo ? { redirectTo } : {},
  );
  if (resetError) {
    throw new Error(resetError.message);
  }

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
