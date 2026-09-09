"use server";

import { z } from "zod";

import { getQuickView, type QuickView } from "@/lib/products/quick-view";

/**
 * Load one listing's detail for the quick view.
 *
 * A read of data the storefront already renders to signed-out visitors, so there is no auth check —
 * RLS is the gate, exactly as it is on `/s/[slug]`. There is no rate limit for the same reason
 * `record_storefront_view` has none: it writes nothing and costs no money.
 *
 * Returns null for anything the caller may not see. The id is validated as a UUID first so a
 * malformed value is refused here rather than becoming a Postgres error.
 */
export async function getQuickViewAction(productId: string): Promise<QuickView | null> {
  const parsed = z.string().uuid().safeParse(productId);
  if (!parsed.success) return null;

  return getQuickView(parsed.data);
}
