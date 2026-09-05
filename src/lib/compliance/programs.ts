import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/db/types";

/**
 * Per-state cottage-food programs — the reference data the compliance rules read.
 *
 * A seller does not operate "in a state", they operate in a **program within a state**: California,
 * Oregon, Utah and Vermont each run three, and ten more states run two, with different caps,
 * different permitted foods, and different answers on whether online orders are allowed at all.
 *
 * Read through the request client: `state_food_programs` is publicly readable ("food programs:
 * public read") and admin-writable, exactly like the state rules it hangs off, so RLS is a
 * sufficient and tighter gate than the service role.
 *
 * Nothing here enforces anything yet. The gates that will read it — product listing, the storefront
 * pause, revenue caps, the document set — move over in later changes.
 */

export type StateFoodProgram = Database["public"]["Tables"]["state_food_programs"]["Row"];

/** `banned` means a seller on this program may not list food on the marketplace at all. */
export type OnlineOrders = "allowed" | "banned" | "unclear";

export interface StateProgramSummary {
  stateCode: string;
  programs: StateFoodProgram[];
  /** True when no program in the state permits online orders — food cannot be sold here. */
  foodSalesBlocked: boolean;
  /** True when at least one program is still on the seeded, unverified data. */
  hasUnverified: boolean;
}

const COLUMNS =
  "id, state_code, ordinal, name, online_orders, mail_delivery, mail_note, direct_delivery, venue_note, retail_allowed, revenue_cap, cap_basis, cap_category, cap_note, license_threshold, cat_shelf_stable, cat_refrigerated, cat_meat, cat_acidified, cat_low_acid_canned, cat_fermented, category_note, license_required, license_note, inspection_required, recipe_approval, recipe_note, training_required, training_note, training_url, application_url, local_preemption, source_url, source_checked_at, verified_at, verified_by, created_at, updated_at";

/** Every program for one state, in display order. */
export async function getStatePrograms(stateCode: string): Promise<StateFoodProgram[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("state_food_programs")
    .select(COLUMNS)
    .eq("state_code", stateCode)
    .order("ordinal");
  return data ?? [];
}

/** Every program, grouped by state — the admin overview. */
export async function getAllStatePrograms(): Promise<StateProgramSummary[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("state_food_programs").select(COLUMNS).order("state_code").order("ordinal");

  const byState = new Map<string, StateFoodProgram[]>();
  for (const program of data ?? []) {
    const list = byState.get(program.state_code) ?? [];
    list.push(program);
    byState.set(program.state_code, list);
  }

  return [...byState.entries()].map(([stateCode, programs]) => ({
    stateCode,
    programs,
    foodSalesBlocked: programs.every((p) => p.online_orders === "banned"),
    hasUnverified: programs.some((p) => !p.verified_at),
  }));
}

/**
 * Whether any program in the state permits taking food orders online.
 *
 * Five states — Delaware, Hawaii, Michigan, Mississippi and Nevada — ban it under every program
 * they run. A seller there can sell candles and cut flowers through the marketplace, but every food
 * listing they create is a violation. This is the read the listing gate will use.
 */
export async function stateAllowsOnlineFoodSales(stateCode: string): Promise<boolean> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("state_food_programs")
    .select("id", { count: "exact", head: true })
    .eq("state_code", stateCode)
    .eq("online_orders", "allowed");
  return (count ?? 0) > 0;
}

export interface ProgramReviewStatus {
  total: number;
  neverVerified: number;
  overdue: number;
}

/**
 * How much of the compliance data nobody has checked. Mirrors the `program-review-scan` job so the
 * admin sees the same number the weekly email quotes.
 */
export async function getProgramReviewStatus(): Promise<ProgramReviewStatus> {
  const supabase = await createClient();
  const cutoff = new Date(Date.now() - 365 * 86_400_000).toISOString();

  const { data } = await supabase.from("state_food_programs").select("verified_at");
  const rows = data ?? [];
  return {
    total: rows.length,
    neverVerified: rows.filter((r) => !r.verified_at).length,
    overdue: rows.filter((r) => r.verified_at && r.verified_at < cutoff).length,
  };
}
