import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Notification, SellerLicense, StateCottageFoodRule } from "@/lib/db/types";

/**
 * Read helpers for the seller compliance surface. All run as the signed-in user, so RLS
 * (`20260902140500_phase2_compliance.sql`) scopes everything to the caller's own storefront.
 */

export interface RevenueStatus {
  year: number;
  state: string;
  grossThisYear: string; // decimal string, dollars
  cap: string | null;
  overCap: boolean;
  /** False while the state's rules are still the seeded placeholder (see /admin/states). */
  capVerified: boolean;
}

export async function getRevenueStatus(
  sellerId: string,
  state: string,
): Promise<RevenueStatus> {
  const supabase = await createClient();
  const year = new Date().getUTCFullYear();

  const [{ data: tracking }, { data: rule }] = await Promise.all([
    supabase
      .from("seller_revenue_tracking")
      .select("gross_revenue, is_over_cap")
      .eq("seller_id", sellerId)
      .eq("state", state)
      .eq("period_year", year)
      .maybeSingle(),
    supabase
      .from("state_cottage_food_rules")
      .select("revenue_cap, verified_at")
      .eq("state_code", state)
      .maybeSingle<Pick<StateCottageFoodRule, "revenue_cap" | "verified_at">>(),
  ]);

  return {
    year,
    state,
    grossThisYear: tracking?.gross_revenue ?? "0.00",
    cap: rule?.revenue_cap ?? null,
    overCap: tracking?.is_over_cap ?? false,
    capVerified: !!rule?.verified_at,
  };
}

export async function getSellerLicenses(sellerId: string): Promise<SellerLicense[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("seller_licenses")
    .select("*")
    .eq("seller_id", sellerId)
    .order("expiration_date", { ascending: true });
  return data ?? [];
}

/**
 * Whether the seller lists any non-archived product in a food category — i.e. whether the
 * cottage-food permit is part of their required set. Mirrors `seller_sells_cottage_food()`, which
 * is the authority (it's what the storefront gate uses); this is the read for the seller's own
 * checklist, run under their RLS rather than granting the function to `authenticated`.
 */
export async function sellerSellsCottageFood(sellerId: string): Promise<boolean> {
  const supabase = await createClient();

  const { data: products } = await supabase
    .from("products")
    .select("category_id")
    .eq("seller_id", sellerId)
    .neq("status", "archived");
  const categoryIds = [...new Set((products ?? []).map((p) => p.category_id))];
  if (categoryIds.length === 0) return false;

  const { count } = await supabase
    .from("categories")
    .select("id", { count: "exact", head: true })
    .in("id", categoryIds)
    .eq("requires_food_permit", true);
  return (count ?? 0) > 0;
}

export async function getInAppNotifications(userId: string): Promise<Notification[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .eq("channel", "in_app")
    .order("created_at", { ascending: false })
    .limit(25);
  return data ?? [];
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("channel", "in_app")
    .is("read_at", null);
  return count ?? 0;
}

/** Days from today (UTC) until a `YYYY-MM-DD` date. Negative = past. */
export function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return Math.round((new Date(`${dateStr}T00:00:00Z`).getTime() - today.getTime()) / 86_400_000);
}
