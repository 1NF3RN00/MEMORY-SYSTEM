/**
 * Set operator password without email (bypasses Supabase mail rate limits).
 *
 * Usage (from repo root):
 *   npm run platform:set-password -- your@email.com 'YourNewPassword'
 */
import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isSupabaseConfigured, setAuthUserPassword } from "../src/lib/supabase-admin.js";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../../..");
loadEnv({ path: resolve(repoRoot, ".env") });

async function main(): Promise<void> {
  if (!isSupabaseConfigured()) {
    console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env");
    process.exit(1);
  }

  const email = process.argv[2]?.trim().toLowerCase();
  const password = process.argv[3];
  if (!email?.includes("@") || !password || password.length < 8) {
    console.error("Usage: npm run platform:set-password -- your@email.com 'AtLeast8Chars'");
    process.exit(1);
  }

  const userId = await setAuthUserPassword(email, password);
  console.log(`\n✓ Password updated for ${email}`);
  console.log(`  Supabase user: ${userId}`);
  console.log("  Log in at http://localhost:5173/access (or your deployed /access URL).");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
