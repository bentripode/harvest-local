import "server-only";

import { createClient } from "@/lib/supabase/server";
import { stateName } from "@/lib/geo/state";
import type { ComplianceBlock } from "@/lib/compliance/blocks";

/**
 * Whether a seller may list food at all.
 *
 * Delaware, Hawaii, Michigan, Mississippi and Nevada ban online cottage-food orders under every
 * program they run. The rule is enforced by `products_guard_online_food_sales` at the data layer;
 * everything here exists so the seller reads an explanation instead of a constraint violation.
 *
 * The answer is derived from `state_food_programs`, never a hardcoded list — correcting a program
 * in the admin surface moves the gate with it.
 */

export interface FoodSalesStatus {
  stateCode: string;
  allowed: boolean;
  /** Programs that do permit online orders, for a state where only some do. */
  allowedProgramNames: string[];
}

/** The seller's own state and whether any of its programs permits online food orders. */
export async function getFoodSalesStatus(sellerId: string): Promise<FoodSalesStatus | null> {
  const supabase = await createClient();

  const { data: seller } = await supabase
    .from("seller_profiles")
    .select("home_state")
    .eq("id", sellerId)
    .maybeSingle();
  if (!seller) return null;

  const { data: programs } = await supabase
    .from("state_food_programs")
    .select("name, online_orders")
    .eq("state_code", seller.home_state);

  const allowedProgramNames = (programs ?? [])
    .filter((p) => p.online_orders === "allowed")
    .map((p) => p.name);

  return {
    stateCode: seller.home_state,
    allowed: allowedProgramNames.length > 0,
    allowedProgramNames,
  };
}

/** Whether a category is one the state gate applies to. */
async function isFoodCategory(categoryId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("categories")
    .select("requires_food_permit")
    .eq("id", categoryId)
    .maybeSingle();
  return data?.requires_food_permit ?? false;
}

/**
 * The message to show when this seller may not list in this category, or null when they may.
 * Written for someone who has never heard of a cottage food law.
 */
export async function describeFoodSalesBlock(
  sellerId: string,
  categoryId: string,
): Promise<ComplianceBlock | null> {
  if (!(await isFoodCategory(categoryId))) return null;

  const status = await getFoodSalesStatus(sellerId);
  if (!status || status.allowed) return null;

  const supabase = await createClient();
  // With every programme in the state banning it, the first is representative — and its
  // `venue_note` is where the quoted statute lives after the verification pass.
  const { data: program } = await supabase
    .from("state_food_programs")
    .select("name, venue_note, source_url, source_checked_at, verified_at")
    .eq("state_code", status.stateCode)
    .order("ordinal")
    .limit(1)
    .maybeSingle();

  return {
    message:
      `${stateName(status.stateCode)} does not allow homemade food to be sold through online orders, ` +
      `so this listing can't be published here. Non-food listings — candles, soap, flowers, crafts — ` +
      `are unaffected and can be published as normal.`,
    citation: program?.venue_note ?? null,
    programName: program?.name ?? null,
    sourceUrl: program?.source_url ?? null,
    sourceCheckedAt: program?.source_checked_at ?? null,
    verified: !!program?.verified_at,
  };
}
