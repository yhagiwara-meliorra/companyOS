/**
 * Supabase Admin client — uses service_role key.
 * Bypasses RLS. Use ONLY for:
 *   - Creating / merging canonical organizations & sites
 *   - System-level operations (ingestion, cron jobs)
 *   - Invitation management
 *
 * NEVER expose this client to the browser.
 */
import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
