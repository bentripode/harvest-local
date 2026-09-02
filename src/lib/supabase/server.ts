import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { env } from "@/lib/env";
import type { Database } from "@/lib/db/types";

/**
 * Server Supabase client for Server Components, Server Actions, and Route Handlers.
 * Subject to RLS as the signed-in user. `cookies()` is async in Next.js 16.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component — the session refresh in proxy.ts handles cookie
            // writes for that request. Safe to ignore.
          }
        },
      },
    },
  );
}
