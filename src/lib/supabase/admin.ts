import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";
import type { Database } from "@/lib/db/types";

/**
 * Service-role client. BYPASSES RLS.
 *
 * Use ONLY in Stripe webhook handlers and trusted server-side jobs. Never in a request handler
 * that acts on user-supplied ids without first checking the caller's authorization.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
}
