"use server";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const uuid = z.string().uuid();

/**
 * Bump a storefront's view counter and, for each product shown, a per-product impression counter
 * (`seller_view_counts` / `product_view_counts` via `record_storefront_view`). Fired from the client
 * once per browser session. Best-effort and advisory — failures are swallowed, unknown ids no-op.
 */
export async function recordStorefrontViewAction(
  sellerId: string,
  productIds: string[] = [],
): Promise<void> {
  if (!uuid.safeParse(sellerId).success) return;
  const ids = productIds.filter((id) => uuid.safeParse(id).success).slice(0, 200);

  try {
    const supabase = await createClient();
    await supabase.rpc("record_storefront_view", {
      p_seller_id: sellerId,
      ...(ids.length > 0 ? { p_product_ids: ids } : {}),
    });
  } catch {
    // advisory metric — never surface
  }
}
