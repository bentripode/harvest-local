import "server-only";

import { createClient } from "@/lib/supabase/server";
import { gateByDrops, type DropGate, type DropLike } from "@/lib/orders/drops";
import type { ProductDrop } from "@/lib/db/types";

/**
 * Reading drops. The arithmetic and every buyer-facing sentence live in `drops.ts` (pure); this is
 * the loading half, and the one place the column names are spelled.
 *
 * `DROP_SELECT` is shared by the storefront, the checkout re-price and the seller's own page, so a
 * batch cannot look different depending on which of them you came through. In particular
 * `units_claimed` is always read live — never cached into a page prop and reused — because the
 * number a buyer is shown is a promise about a real oven.
 */

export const DROP_SELECT =
  "id, name, opens_at, closes_at, fulfillment_date, pickup_window, unit_cap, units_claimed, cancelled_at";

/** The subset of `product_drops` the pure module works on. Rows come back snake_case. */
export type DropRow = Pick<
  ProductDrop,
  | "id"
  | "name"
  | "opens_at"
  | "closes_at"
  | "fulfillment_date"
  | "pickup_window"
  | "unit_cap"
  | "units_claimed"
  | "cancelled_at"
>;

export function toDrop(row: DropRow): DropLike {
  return {
    id: row.id,
    name: row.name,
    opensAt: row.opens_at,
    closesAt: row.closes_at,
    fulfillmentDate: row.fulfillment_date,
    pickupWindow: row.pickup_window,
    unitCap: row.unit_cap,
    unitsClaimed: row.units_claimed,
    cancelledAt: row.cancelled_at,
  };
}

export function toDrops(rows: DropRow[] | null | undefined): DropLike[] {
  return (rows ?? []).map(toDrop);
}

/** The batch situation for one listing. */
export async function getProductDropGate(productId: string): Promise<DropGate> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("product_drops")
    .select(DROP_SELECT)
    .eq("product_id", productId)
    .order("closes_at", { ascending: false });

  return gateByDrops(toDrops(data as DropRow[] | null));
}

export interface SellerDropRow extends DropLike {
  productId: string;
  productTitle: string;
}

/**
 * Every batch this seller has, newest window first — the seller's own list.
 *
 * Includes cancelled ones. A cancelled batch is a thing that happened to real buyers, and a page
 * that quietly drops it leaves the seller wondering where it went.
 */
export async function getSellerDrops(sellerId: string): Promise<SellerDropRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("product_drops")
    .select(`${DROP_SELECT}, product_id, product:products!product_drops_product_id_fkey(title)`)
    .eq("seller_id", sellerId)
    .order("closes_at", { ascending: false });

  return (data ?? []).map((row) => {
    const r = row as unknown as DropRow & {
      product_id: string;
      product: { title: string } | null;
    };
    return {
      ...toDrop(r),
      productId: r.product_id,
      productTitle: r.product?.title ?? "Deleted listing",
    };
  });
}
