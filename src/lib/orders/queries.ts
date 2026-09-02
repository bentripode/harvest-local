import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Order, OrderItem, OrderStatusHistory } from "@/lib/db/types";

/**
 * Read helpers for orders. All of these run as the signed-in user, so RLS
 * (`supabase/migrations/20260902115500_phase2_orders.sql`) is what actually scopes visibility —
 * a buyer sees only their orders, a seller only orders for their storefront.
 */

export interface OrderListRow extends Order {
  seller: { business_name: string; storefront_slug: string } | null;
  buyer: { display_name: string } | null;
  item_count: { count: number }[];
}

export interface OrderDetail extends Order {
  seller: { id: string; business_name: string; storefront_slug: string } | null;
  buyer: { id: string; display_name: string } | null;
  items: OrderItem[];
  history: OrderStatusHistory[];
}

const LIST_SELECT =
  "*, seller:seller_profiles(business_name, storefront_slug), buyer:profiles(display_name), item_count:order_items(count)";

const DETAIL_SELECT =
  "*, seller:seller_profiles(id, business_name, storefront_slug), buyer:profiles(id, display_name), items:order_items(*), history:order_status_history(*)";

export async function getBuyerOrders(buyerId: string): Promise<OrderListRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select(LIST_SELECT)
    .eq("buyer_id", buyerId)
    .order("created_at", { ascending: false });
  return (data as OrderListRow[] | null) ?? [];
}

export async function getSellerOrders(sellerId: string): Promise<OrderListRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select(LIST_SELECT)
    .eq("seller_id", sellerId)
    .neq("status", "pending_payment")
    .order("created_at", { ascending: false });
  return (data as OrderListRow[] | null) ?? [];
}

/** One order with items + status history, or null when the caller can't see it. */
export async function getOrder(orderId: string): Promise<OrderDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select(DETAIL_SELECT)
    .eq("id", orderId)
    .maybeSingle();
  if (!data) return null;

  const detail = data as unknown as OrderDetail;
  detail.history = [...detail.history].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  return detail;
}
