"use server";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const uuid = z.string().uuid();

/**
 * Bump a storefront's view counter (`seller_view_counts` via `record_storefront_view`). Fired from
 * the client once per browser session. Best-effort and advisory — a failure is swallowed, and the
 * RPC no-ops on an unknown seller id.
 */
export async function recordStorefrontViewAction(sellerId: string): Promise<void> {
  if (!uuid.safeParse(sellerId).success) return;

  try {
    const supabase = await createClient();
    await supabase.rpc("record_storefront_view", { p_seller_id: sellerId });
  } catch {
    // advisory metric — never surface
  }
}
