import "server-only";

import { createClient } from "@/lib/supabase/server";
import { toCents } from "@/lib/money";

/**
 * Seller dashboard analytics — derived entirely from `orders` / `order_items` / `seller_view_counts`,
 * read as the signed-in seller (RLS scopes it). "Revenue" means the `total` of orders that reached
 * `completed`, bucketed by `created_at`. The window is 30 / 90 / 365 days; everything is compared
 * against the equally-long period before it.
 */

const DAY_MS = 86_400_000;

export const WINDOW_DAYS = [30, 90, 365] as const;
export type WindowDays = (typeof WINDOW_DAYS)[number];

export function parseWindowDays(raw: unknown): WindowDays {
  const n = Number(raw);
  return (WINDOW_DAYS as readonly number[]).includes(n) ? (n as WindowDays) : 30;
}

export interface StatWindow {
  revenueCents: number;
  orders: number;
}

export interface SellerStats {
  windowDays: WindowDays;
  current: StatWindow & {
    cancelled: number;
    aovCents: number;
    pickupOrders: number;
    deliveryOrders: number;
    deliveryRevenueCents: number;
    discountsCents: number;
    views: number;
    /** completed orders ÷ storefront views, as a percentage; null with no views. */
    conversionPct: number | null;
  };
  prior: StatWindow;
  /** Revenue buckets across the window — daily for ≤90d, weekly for 365d. Oldest first. */
  series: { label: string; cents: number }[];
  topProducts: { title: string; units: number; revenueCents: number }[];
  /** Products by storefront impressions over the window (top 5). */
  mostViewedProducts: { title: string; views: number }[];
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

const mmdd = (iso: string) => iso.slice(5, 10);

export async function getSellerDashboardStats(
  sellerId: string,
  windowDays: WindowDays = 30,
): Promise<SellerStats> {
  const supabase = await createClient();
  const now = Date.now();
  const since = now - windowDays * DAY_MS;
  const sincePrior = now - 2 * windowDays * DAY_MS;
  const sinceIso = new Date(since).toISOString();
  const sincePriorIso = new Date(sincePrior).toISOString();

  const sinceDay = sinceIso.slice(0, 10);
  const [{ data: orderData }, { data: itemData }, { data: viewData }, { data: prodViewData }] =
    await Promise.all([
      supabase
        .from("orders")
        .select("total, discount_total, delivery_fee, fulfillment_type, status, created_at")
        .eq("seller_id", sellerId)
        .neq("status", "pending_payment")
        .gte("created_at", sincePriorIso),
      supabase
        .from("order_items")
        .select("title_snapshot, quantity, line_total, orders!inner(seller_id, status, created_at)")
        .eq("orders.seller_id", sellerId)
        .eq("orders.status", "completed")
        .gte("orders.created_at", sinceIso),
      supabase
        .from("seller_view_counts")
        .select("views")
        .eq("seller_id", sellerId)
        .gte("day", sinceDay),
      supabase
        .from("product_view_counts")
        .select("views, products!inner(title, seller_id)")
        .eq("products.seller_id", sellerId)
        .gte("day", sinceDay),
    ]);

  const orders = (orderData ?? []) as OrderRow[];

  const current = {
    revenueCents: 0,
    orders: 0,
    cancelled: 0,
    aovCents: 0,
    pickupOrders: 0,
    deliveryOrders: 0,
    deliveryRevenueCents: 0,
    discountsCents: 0,
    views: 0,
    conversionPct: null as number | null,
  };
  const prior: StatWindow = { revenueCents: 0, orders: 0 };

  // Revenue series: daily up to 90 days, weekly for a year.
  const bucketDays = windowDays <= 90 ? 1 : 7;
  const bucketCount = Math.ceil(windowDays / bucketDays);
  const buckets = Array.from({ length: bucketCount }, (_, i) => ({
    // Bucket i covers [now - (i+1)*span, now - i*span); i=0 is the most recent.
    startIso: new Date(now - (i + 1) * bucketDays * DAY_MS + DAY_MS).toISOString(),
    cents: 0,
  }));

  for (const o of orders) {
    const t = new Date(o.created_at).getTime();
    const completed = o.status === "completed";
    const cents = completed ? toCents(o.total) : 0;

    if (t >= since) {
      if (completed) {
        current.revenueCents += cents;
        current.orders += 1;
        current.deliveryRevenueCents += toCents(o.delivery_fee);
        current.discountsCents += toCents(o.discount_total);
        if (o.fulfillment_type === "delivery") current.deliveryOrders += 1;
        else current.pickupOrders += 1;

        const bucketIdx = Math.floor((now - t) / (bucketDays * DAY_MS));
        if (bucketIdx >= 0 && bucketIdx < bucketCount) buckets[bucketIdx].cents += cents;
      }
      if (o.status === "cancelled") current.cancelled += 1;
    } else if (t >= sincePrior && completed) {
      prior.revenueCents += cents;
      prior.orders += 1;
    }
  }

  current.aovCents = current.orders > 0 ? Math.round(current.revenueCents / current.orders) : 0;
  current.views = ((viewData ?? []) as { views: number }[]).reduce((s, v) => s + (v.views ?? 0), 0);
  current.conversionPct =
    current.views > 0 ? Math.round((current.orders / current.views) * 1000) / 10 : null;

  const series = buckets
    .slice()
    .reverse()
    .map((b) => ({ label: mmdd(b.startIso), cents: b.cents }));

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

  const viewsByTitle = new Map<string, number>();
  for (const row of (prodViewData ?? []) as { views: number; products: { title?: string } | null }[]) {
    const title = row.products?.title;
    if (!title) continue;
    viewsByTitle.set(title, (viewsByTitle.get(title) ?? 0) + (row.views ?? 0));
  }
  const mostViewedProducts = [...viewsByTitle.entries()]
    .map(([title, views]) => ({ title, views }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 5);

  return {
    windowDays,
    current,
    prior,
    series,
    topProducts,
    mostViewedProducts,
    hasData:
      current.orders > 0 ||
      prior.orders > 0 ||
      current.cancelled > 0 ||
      current.views > 0 ||
      mostViewedProducts.length > 0,
  };
}
