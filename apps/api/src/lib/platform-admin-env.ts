/** Accept legacy singular env names used in early .env files. */
export function platformAdminEmails(): string[] {
  const raw =
    process.env.PLATFORM_ADMIN_EMAILS ??
    process.env.PLATFORM_ADMIN_EMAIL ??
    "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function primaryPlatformAdminEmail(): string | null {
  return platformAdminEmails()[0] ?? null;
}

export function passwordSetupRedirectUrl(): string | undefined {
  return (
    process.env.PASSWORD_SETUP_REDIRECT_URL ??
    process.env.PASSWORD_RESET_REDIRECT_URL ??
    process.env.SUPABASE_SETUP_REDIRECT_URL
  );
}
