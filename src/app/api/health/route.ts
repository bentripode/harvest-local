import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Liveness / readiness probe for an external uptime monitor (LAUNCH.md §7). Sentry reports thrown
 * errors; it does not tell you "the deployment is down" or "the DB is unreachable". Point Better
 * Stack / Pingdom / a Vercel check at `GET /api/health` and alert on a non-200.
 *
 * Deliberately unauthenticated and side-effect free: it runs one trivial, RLS-bypassing read
 * (`platform_settings` always has the `access_mode` row) with a short timeout. No user input, no
 * writes, nothing that could be abused — the response carries no data beyond pass/fail.
 */

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DB_TIMEOUT_MS = 3000;

async function checkDatabase(): Promise<boolean> {
  try {
    const supabase = createAdminClient();
    const query = supabase
      .from("platform_settings")
      .select("key", { head: true, count: "exact" })
      .limit(1);

    const { error } = await Promise.race([
      query,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("db health check timed out")), DB_TIMEOUT_MS),
      ),
    ]);

    if (error) {
      console.error("[health] database check failed:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[health] database check errored:", err instanceof Error ? err.message : err);
    return false;
  }
}

export async function GET() {
  const database = await checkDatabase();
  const ok = database;

  return NextResponse.json(
    {
      status: ok ? "ok" : "degraded",
      checks: { database: database ? "ok" : "error" },
      timestamp: new Date().toISOString(),
    },
    {
      status: ok ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
