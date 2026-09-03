import "server-only";

import { createClient } from "@/lib/supabase/server";
import { toCents } from "@/lib/money";

/**
 * Seller dashboard analytics — derived entirely from `orders` / `order_items`, read as the
 * signed-in seller (RLS scopes it). No schema, no service role. "Revenue" means the `total` of
 * orders that reached `completed`, bucketed by `created_at` (local-food orders complete within
 * days; a dedicated completion timestamp is a later refinement).
 */

const DAY_MS = 86_400_000;

export interface StatWindow {
  revenueCents: number;
  orders: number;
}

export interface SellerStats {
  last30: StatWindow & {
    cancelled: number;
    aovCents: number;
    pickupOrders: number;
    deliveryOrders: number;
    deliveryRevenueCents: number;
    discountsCents: number;
  };
  prev30: StatWindow;
  last90: StatWindow;
  daily: { date: string; cents: number }[];
  topProducts: { title: string; units: number; revenueCents: number }[];
  hasData: boolean;
}

interface OrderRow {
  total: string;
  discount_total: string;
  delivery_fee: string;
  fulfillment_type: string;
  status: string;
  created_at: string;
}

const utcDay = (iso: string) => iso.slice(0, 10);

export async function getSellerDashboardStats(sellerId: string): Promise<SellerStats> {
  const supabase = await createClient();
  const now = Date.now();
  const since90 = new Date(now - 90 * DAY_MS).toISOString();
  const since30 = new Date(now - 30 * DAY_MS).toISOString();
  const since60 = new Date(now - 60 * DAY_MS).toISOString();

  const [{ data: orderData }, { data: itemData }] = await Promise.all([
    supabase
      .from("orders")
      .select("total, discount_total, delivery_fee, fulfillment_type, status, created_at")
      .eq("seller_id", sellerId)
      .neq("status", "pending_payment")
      .gte("created_at", since90),
    supabase
      .from("order_items")
      .select("title_snapshot, quantity, line_total, orders!inner(seller_id, status, created_at)")
      .eq("orders.seller_id", sellerId)
      .eq("orders.status", "completed")
      .gte("orders.created_at", since30),
  ]);

  const orders = (orderData ?? []) as OrderRow[];

  const blankWindow = () => ({ revenueCents: 0, orders: 0 });
  const last30 = {
    ...blankWindow(),
    cancelled: 0,
    aovCents: 0,
    pickupOrders: 0,
    deliveryOrders: 0,
    deliveryRevenueCents: 0,
    discountsCents: 0,
  };
  const prev30 = blankWindow();
  const last90 = blankWindow();

  const dailyMap = new Map<string, number>();
  for (let i = 0; i < 30; i++) {
    dailyMap.set(utcDay(new Date(now - i * DAY_MS).toISOString()), 0);
  }

  for (const o of orders) {
    const t = new Date(o.created_at).getTime();
    const completed = o.status === "completed";
    const cents = completed ? toCents(o.total) : 0;

    if (completed) {
      last90.revenueCents += cents;
      last90.orders += 1;
    }

    if (t >= now - 30 * DAY_MS) {
      if (completed) {
        last30.revenueCents += cents;
        last30.orders += 1;
        last30.deliveryRevenueCents += toCents(o.delivery_fee);
        last30.discountsCents += toCents(o.discount_total);
        if (o.fulfillment_type === "delivery") last30.deliveryOrders += 1;
        else last30.pickupOrders += 1;
        const day = utcDay(o.created_at);
        if (dailyMap.has(day)) dailyMap.set(day, (dailyMap.get(day) ?? 0) + cents);
      }
      if (o.status === "cancelled") last30.cancelled += 1;
    } else if (t >= new Date(since60).getTime() && t < now - 30 * DAY_MS && completed) {
      prev30.revenueCents += cents;
      prev30.orders += 1;
    }
  }

  last30.aovCents = last30.orders > 0 ? Math.round(last30.revenueCents / last30.orders) : 0;

  const daily = [...dailyMap.entries()]
    .map(([date, c]) => ({ date, cents: c }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Top products, last 30d completed orders.
  const byTitle = new Map<string, { units: number; revenueCents: number }>();
  for (const it of (itemData ?? []) as {
    title_snapshot: string;
    quantity: number;
    line_total: string;
  }[]) {
    const cur = byTitle.get(it.title_snapshot) ?? { units: 0, revenueCents: 0 };
    cur.units += it.quantity;
    cur.revenueCents += toCents(it.line_total);
    byTitle.set(it.title_snapshot, cur);
  }
  const topProducts = [...byTitle.entries()]
    .map(([title, v]) => ({ title, ...v }))
    .sort((a, b) => b.revenueCents - a.revenueCents)
    .slice(0, 5);

  return {
    last30,
    prev30,
    last90,
    daily,
    topProducts,
    hasData: last90.orders > 0 || last30.cancelled > 0,
  };
}
