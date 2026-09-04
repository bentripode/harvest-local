import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export interface RateLimit {
  max: number;
  windowSecs: number;
}

/**
 * Fixed-window limits for the public write paths (LAUNCH.md §7). Keyed per authenticated user.
 * Tuned for one deliberate person, not a burst — a human hitting these is almost certainly
 * scripted. Backed by `check_rate_limit()` in Postgres.
 */
export const RATE_LIMITS = {
  /** Order + Stripe Checkout Session creation. */
  checkout: { max: 10, windowSecs: 60 },
  /** Server re-price of the cart — also the Mapbox geocode/route cost path on the checkout page. */
  reprice: { max: 40, windowSecs: 60 },
  /** Referral-code attempts — the code-probing guard. */
  promo: { max: 12, windowSecs: 60 },
  /** Sending a chat message. */
  message: { max: 30, windowSecs: 60 },
  /** Opening a new conversation. */
  conversation: { max: 12, windowSecs: 60 },
  /** Filing an order report. */
  report: { max: 6, windowSecs: 300 },
} as const satisfies Record<string, RateLimit>;

/**
 * Check one fixed-window limit, keyed by a server-derived string (e.g. `checkout:<userId>`).
 * Returns `null` when the request is allowed, or a ready-to-display message when the window is
 * exhausted.
 *
 * Fails OPEN: a limiter/DB error must never take checkout down, so it is logged and allowed.
 */
export async function tryRateLimit(
  key: string,
  limit: RateLimit,
  action = "do that",
): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("check_rate_limit", {
    p_key: key,
    p_max: limit.max,
    p_window_secs: limit.windowSecs,
  });

  if (error) {
    console.error("[rate-limit] check failed, allowing request:", error.message);
    return null;
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row || row.allowed) return null;

  const secs = Math.max(1, row.retry_after ?? limit.windowSecs);
  return `You're trying to ${action} too often. Try again in ${
    secs < 60 ? `${secs} seconds` : "a minute"
  }.`;
}
