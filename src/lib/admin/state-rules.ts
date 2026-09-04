import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Per-state cottage-food rules for the admin editor.
 *
 * Read through the request client, not the service role: `state_cottage_food_rules` is
 * publicly readable ("cottage rules: public read") and admin-writable ("cottage rules: admin
 * write"), with no guard trigger, so RLS is a sufficient and tighter gate than bypassing it.
 *
 * A row is **unverified** until an admin saves it — the 51 seeded rows all carry the same invented
 * $50,000 cap, and `record_order_revenue` pauses storefronts against whatever is in here.
 */

export interface StateRule {
  stateCode: string;
  revenueCap: string | null;
  requiresLicense: boolean;
  notes: string | null;
  verifiedAt: string | null;
  updatedAt: string;
}

export async function getStateRules(): Promise<StateRule[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("state_cottage_food_rules")
    .select("state_code, revenue_cap, requires_license, notes, verified_at, updated_at")
    .order("state_code");

  return (data ?? []).map((r) => ({
    stateCode: r.state_code,
    revenueCap: r.revenue_cap,
    requiresLicense: r.requires_license,
    notes: r.notes,
    verifiedAt: r.verified_at,
    updatedAt: r.updated_at,
  }));
}

