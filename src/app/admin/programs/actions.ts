"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cents, toCents, toDecimalString } from "@/lib/money";

export interface ProgramReviewState {
  error?: string;
  ok?: boolean;
}

const ONLINE = ["allowed", "banned", "unclear"] as const;
const MAIL = ["allowed", "banned", "restricted", "unclear"] as const;
const DELIVERY = ["allowed", "banned", "unclear"] as const;
const SHELF = ["unrestricted", "list_only", "limited", "conditional", "banned", "unclear"] as const;
const AXIS = ["allowed", "banned", "conditional", "unclear"] as const;
const GATE = ["yes", "no", "conditional", "unclear"] as const;
const CAP_BASIS = ["none", "annual_total", "per_product", "per_category"] as const;
const CAP_CATEGORY = [
  "shelf_stable",
  "refrigerated",
  "meat",
  "acidified",
  "low_acid_canned",
  "fermented",
] as const;

const text = z.string().trim().max(2000).optional().or(z.literal(""));
const money = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""))
  .refine((v) => !v || (Number.isFinite(Number(v)) && Number(v) >= 0), "Enter an amount in dollars.");
const url = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""))
  .refine((v) => !v || /^https?:\/\//.test(v), "Links must start with http:// or https://");

const schema = z.object({
  programId: z.string().uuid(),
  name: z.string().trim().min(2).max(200),

  online_orders: z.enum(ONLINE),
  mail_delivery: z.enum(MAIL),
  mail_note: text,
  direct_delivery: z.enum(DELIVERY),
  venue_note: text,
  retail_allowed: z.coerce.boolean().optional(),

  revenue_cap: money,
  cap_basis: z.enum(CAP_BASIS),
  cap_category: z.enum(CAP_CATEGORY).optional().or(z.literal("")),
  cap_note: text,
  license_threshold: money,

  cat_shelf_stable: z.enum(SHELF),
  cat_refrigerated: z.enum(AXIS),
  cat_meat: z.enum(AXIS),
  cat_acidified: z.enum(AXIS),
  cat_low_acid_canned: z.enum(AXIS),
  cat_fermented: z.enum(AXIS),
  category_note: text,

  license_required: z.enum(GATE),
  license_note: text,
  inspection_required: z.coerce.boolean().optional(),
  recipe_approval: z.enum(GATE),
  recipe_note: text,
  training_required: z.enum(GATE),
  training_note: text,
  training_url: url,
  application_url: url,
  local_preemption: z.coerce.boolean().optional(),

  source_url: z.string().trim().url(),
});

/**
 * Save one state food program and mark it verified.
 *
 * **Saving is the verification act.** These rows were seeded from a public summary of the law, and
 * `verified_at` exists to record that a person checked them against the state's own rules — so it
 * is stamped with the admin's id here and nowhere else. Nothing seeds or backfills it.
 *
 * Written through the request client: "food programs: admin write" RLS is the gate and there is no
 * guard trigger on the table, so there is no reason to reach for the service role.
 */
export async function reviewFoodProgramAction(
  _prev: ProgramReviewState,
  formData: FormData,
): Promise<ProgramReviewState> {
  const { user } = await requireRole("admin");

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  }
  const d = parsed.data;

  // A per-category cap that names no category silently tallies nothing, which is the failure the
  // DB constraint exists to prevent — catch it here so the admin gets a sentence, not a violation.
  if (d.cap_basis === "per_category" && !d.cap_category) {
    return { error: "A per-category cap has to say which category it applies to." };
  }
  if (d.cap_basis !== "none" && d.cap_basis !== undefined && !d.revenue_cap) {
    return { error: "Choose 'no cap' or enter the cap amount." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("state_food_programs")
    .update({
      name: d.name,
      online_orders: d.online_orders,
      mail_delivery: d.mail_delivery,
      mail_note: d.mail_note || null,
      direct_delivery: d.direct_delivery,
      venue_note: d.venue_note || null,
      retail_allowed: !!d.retail_allowed,
      revenue_cap: d.revenue_cap ? toDecimalString(cents(toCents(d.revenue_cap))) : null,
      cap_basis: d.cap_basis,
      cap_category: d.cap_basis === "per_category" ? (d.cap_category || null) : null,
      cap_note: d.cap_note || null,
      license_threshold: d.license_threshold
        ? toDecimalString(cents(toCents(d.license_threshold)))
        : null,
      cat_shelf_stable: d.cat_shelf_stable,
      cat_refrigerated: d.cat_refrigerated,
      cat_meat: d.cat_meat,
      cat_acidified: d.cat_acidified,
      cat_low_acid_canned: d.cat_low_acid_canned,
      cat_fermented: d.cat_fermented,
      category_note: d.category_note || null,
      license_required: d.license_required,
      license_note: d.license_note || null,
      inspection_required: !!d.inspection_required,
      recipe_approval: d.recipe_approval,
      recipe_note: d.recipe_note || null,
      training_required: d.training_required,
      training_note: d.training_note || null,
      training_url: d.training_url || null,
      application_url: d.application_url || null,
      local_preemption: !!d.local_preemption,
      source_url: d.source_url,
      source_checked_at: new Date().toISOString().slice(0, 10),
      verified_at: new Date().toISOString(),
      verified_by: user.id,
    })
    .eq("id", d.programId);

  if (error) {
    console.error("[admin] program review save failed:", error);
    return { error: "Could not save this program." };
  }

  revalidatePath("/admin/programs");
  revalidatePath(`/admin/programs/${d.programId}`);
  // Both food gates read this row.
  revalidatePath("/seller/products", "layout");
  revalidatePath("/seller/compliance");
  return { ok: true };
}
