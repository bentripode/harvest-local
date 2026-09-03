import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { toCents } from "@/lib/money";

/**
 * Platform-wide analytics for the superadmin dashboard. Uses the service-role client — callers
 * MUST be behind `requireRole("admin")` (the /admin layout is). Aggregated in JS; the data volume
 * is small.
 */

const DAY_MS = 86_400_000;
const MONTHLY_PRICE_CENTS = 2000;

export interface PlatformStats {
  gmvCents: number;
  gmv30Cents: number;
  ordersCompleted: number;
  ordersCompleted30: number;
  aovCents: number;
  refundedCents: number;
  refundCount: number;
  sellersTotal: number;
  sellersLive: number;
  sellersActive30: number;
  buyersTotal: number;
  buyersOrdered: number;
  subsActive: number;
  subsTrialing: number;
  mrrCents: number;
  signups30: number;
}

export async function getPlatformStats(): Promise<PlatformStats> {
  const admin = createAdminClient();
  const cutoff30 = Date.now() - 30 * DAY_MS;

  const [orders, refunds, sellers, profiles, subs] = await Promise.all([
    admin.from("orders").select("total, status, seller_id, buyer_id, created_at"),
    admin.from("refunds").select("amount"),
    admin.from("seller_profiles").select("id, is_paused"),
    admin.from("profiles").select("id, role, created_at"),
    admin.from("subscriptions").select("status"),
  ]);

  const orderRows = orders.data ?? [];
  const completed = orderRows.filter((o) => o.status === "completed");
  const completed30 = completed.filter((o) => new Date(o.created_at).getTime() >= cutoff30);

  const sum = (rows: { total: string }[]) =>
    rows.reduce((n, o) => n + toCents(o.total), 0);

  const refundedCents = (refunds.data ?? []).reduce((n, r) => n + toCents(r.amount), 0);

  const sellersActive30 = new Set(completed30.map((o) => o.seller_id)).size;
  const buyersOrdered = new Set(
    orderRows.filter((o) => o.status !== "pending_payment").map((o) => o.buyer_id),
  ).size;

  const profileRows = profiles.data ?? [];
  const subRows = subs.data ?? [];
  const gmvCents = sum(completed);
  const ordersCompleted = completed.length;

  return {
    gmvCents,
    gmv30Cents: sum(completed30),
    ordersCompleted,
    ordersCompleted30: completed30.length,
    aovCents: ordersCompleted > 0 ? Math.round(gmvCents / ordersCompleted) : 0,
    refundedCents,
    refundCount: (refunds.data ?? []).length,
    sellersTotal: (sellers.data ?? []).length,
    sellersLive: (sellers.data ?? []).filter((s) => !s.is_paused).length,
    sellersActive30,
    buyersTotal: profileRows.filter((p) => p.role === "buyer").length,
    buyersOrdered,
    subsActive: subRows.filter((s) => s.status === "active").length,
    subsTrialing: subRows.filter((s) => s.status === "trialing").length,
    mrrCents: subRows.filter((s) => s.status === "active").length * MONTHLY_PRICE_CENTS,
    signups30: profileRows.filter((p) => new Date(p.created_at).getTime() >= cutoff30).length,
  };
}
