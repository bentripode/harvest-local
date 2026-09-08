"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { RATE_LIMITS, tryRateLimit } from "@/lib/rate-limit";

export interface WatchFormState {
  error?: string;
  ok?: boolean;
}

const watchSchema = z.object({
  marketId: z.string().uuid(),
  email: z.string().trim().toLowerCase().email().max(254),
});

/**
 * The client IP, for throttling a path that has no user to key on. Vercel sets
 * `x-forwarded-for` as a comma-separated chain with the client first; behind no proxy it is
 * absent, and we fall back to a single shared bucket rather than to no limit at all.
 */
async function rateLimitKey(): Promise<string> {
  const user = await getUser();
  if (user) return `market-watch:user:${user.id}`;

  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || h.get("x-real-ip")?.trim();
  return `market-watch:ip:${ip || "unknown"}`;
}

/**
 * Join a market's waitlist.
 *
 * Open to signed-out visitors on purpose: an empty market page exists to capture interest before
 * any seller is there, and asking for an account first would collect nothing. The insert is
 * write-only from the client's side — `market_watchers` has no general SELECT policy, so the list
 * can't be read back or enumerated.
 */
export async function watchMarketAction(
  _prev: WatchFormState,
  formData: FormData,
): Promise<WatchFormState> {
  const parsed = watchSchema.safeParse({
    marketId: formData.get("marketId"),
    email: formData.get("email"),
  });
  if (!parsed.success) return { error: "Enter a valid email address." };

  const limited = await tryRateLimit(await rateLimitKey(), RATE_LIMITS.marketWatch, "sign up");
  if (limited) return { error: limited };

  const user = await getUser();
  const supabase = await createClient();

  const { error } = await supabase.from("market_watchers").insert({
    market_id: parsed.data.marketId,
    email: parsed.data.email,
    profile_id: user?.id ?? null,
  });

  // 23505 = already on this market's list. That is the outcome they asked for, so say yes.
  if (error && error.code !== "23505") {
    return { error: "We couldn't add you just now. Try again in a moment." };
  }

  return { ok: true };
}
