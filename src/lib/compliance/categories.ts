import "server-only";

import { createClient } from "@/lib/supabase/server";
import { stateName } from "@/lib/geo/state";
import type { ComplianceBlock } from "@/lib/compliance/blocks";

/**
 * Which marketplace categories a seller's state actually permits.
 *
 * `categories.food_axes` links our shopping taxonomy to the six regulatory axes
 * `state_food_programs` grades. `products_guard_food_categories` enforces the rule at the data
 * layer; everything here exists so the seller sees it on the form instead of discovering it when
 * they press save.
 *
 * Only an outright ban blocks. `conditional` (Colorado allows meat under 1,000 personally-raised
 * poultry), `list_only` and `limited` are qualifications — the listing goes through and the seller
 * is shown what the qualification is.
 */

const AXIS_COLUMN = {
  shelf_stable: "cat_shelf_stable",
  refrigerated: "cat_refrigerated",
  meat: "cat_meat",
  acidified: "cat_acidified",
  low_acid_canned: "cat_low_acid_canned",
  fermented: "cat_fermented",
} as const;

type Axis = keyof typeof AXIS_COLUMN;

const AXIS_LABEL: Record<Axis, string> = {
  shelf_stable: "shelf-stable food",
  refrigerated: "refrigerated baked goods",
  meat: "meat",
  acidified: "acidified or pickled food",
  low_acid_canned: "low-acid canned goods",
  fermented: "fermented food",
};

export interface CategoryPermission {
  allowed: boolean;
  /** Why it's blocked, in the seller's words. Null when allowed. */
  reason: string | null;
  /** A qualification that applies even though it's allowed — shown, not enforced. */
  qualification: string | null;
}

export type CategoryPermissions = Record<string, CategoryPermission>;

const ALLOWED: CategoryPermission = { allowed: true, reason: null, qualification: null };

/**
 * One lookup per category id for this seller's state. Categories with no `food_axes` are always
 * allowed — an empty mapping means no axis rule is known, not that the category is unregulated.
 */
export async function getCategoryPermissions(sellerId: string): Promise<CategoryPermissions> {
  const supabase = await createClient();

  const { data: seller } = await supabase
    .from("seller_profiles")
    .select("home_state")
    .eq("id", sellerId)
    .maybeSingle();
  if (!seller) return {};

  const [{ data: categories }, { data: programs }] = await Promise.all([
    supabase.from("categories").select("id, food_axes"),
    supabase
      .from("state_food_programs")
      .select(
        "name, category_note, cat_shelf_stable, cat_refrigerated, cat_meat, cat_acidified, cat_low_acid_canned, cat_fermented",
      )
      .eq("state_code", seller.home_state),
  ]);

  const out: CategoryPermissions = {};
  if (!categories) return out;

  for (const category of categories) {
    const axes = (category.food_axes ?? []) as Axis[];
    if (axes.length === 0) {
      out[category.id] = ALLOWED;
      continue;
    }

    let blocked: Axis | null = null;
    let qualification: string | null = null;

    for (const axis of axes) {
      const column = AXIS_COLUMN[axis];
      if (!column) continue;

      const values = (programs ?? []).map((p) => p[column] as string);
      if (values.length > 0 && values.every((v) => v === "banned")) {
        blocked = axis;
        break;
      }

      // Surface the first real qualification we find, with the note that explains it.
      if (!qualification) {
        const index = values.findIndex(
          (v) => v === "conditional" || v === "list_only" || v === "limited",
        );
        if (index >= 0) {
          const note = programs?.[index]?.category_note;
          qualification = note
            ? `${stateName(seller.home_state)} restricts this: ${note}`
            : `${stateName(seller.home_state)} restricts which ${AXIS_LABEL[axis]} may be sold.`;
        }
      }
    }

    out[category.id] = blocked
      ? {
          allowed: false,
          reason:
            `${stateName(seller.home_state)} bans selling ${AXIS_LABEL[blocked]} under every one of ` +
            `its cottage food programs, so this category can't be published from here.`,
          qualification: null,
        }
      : { allowed: true, reason: null, qualification };
  }

  return out;
}

/**
 * The block when this seller may not publish in this category, or null when they may.
 *
 * Carries the words it rests on: `category_note` on the refusing programme now holds quoted statute
 * — West Virginia's "excludes meat, meat products, poultry, poultry products, seafood, and Grade A
 * dairy products", Wyoming's seven exceptions to its meat ban — so the seller can read the sentence
 * rather than take ours on trust.
 */
export async function describeCategoryBlock(
  sellerId: string,
  categoryId: string,
): Promise<ComplianceBlock | null> {
  const permissions = await getCategoryPermissions(sellerId);
  const reason = permissions[categoryId]?.reason;
  if (!reason) return null;

  const supabase = await createClient();
  const { data: seller } = await supabase
    .from("seller_profiles")
    .select("home_state")
    .eq("id", sellerId)
    .maybeSingle();
  if (!seller) return { ...EMPTY_SOURCE, message: reason };

  // Every programme in the state bans the axis or we would not be here, so the first is
  // representative of all of them.
  const { data: program } = await supabase
    .from("state_food_programs")
    .select("name, category_note, source_url, source_checked_at, verified_at")
    .eq("state_code", seller.home_state)
    .order("ordinal")
    .limit(1)
    .maybeSingle();

  return {
    message: reason,
    citation: program?.category_note ?? null,
    programName: program?.name ?? null,
    sourceUrl: program?.source_url ?? null,
    sourceCheckedAt: program?.source_checked_at ?? null,
    verified: !!program?.verified_at,
  };
}

const EMPTY_SOURCE = {
  citation: null,
  programName: null,
  sourceUrl: null,
  sourceCheckedAt: null,
  verified: false,
} as const;

/**
 * Food categories with no regulatory axis mapped — the gate cannot fire for these.
 *
 * Surfaced in the admin view rather than hidden: the mapping is a judgement, and the honest state
 * of it is "these ones weren't clear enough to call". Fresh produce isn't one of the six axes at
 * all, and "Juice & Cider" could be acidified, refrigerated or neither depending on the product.
 */
export async function getUnmappedFoodCategories(): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("categories")
    .select("id, name, food_axes")
    .eq("requires_food_permit", true)
    .order("name");
  return (data ?? [])
    .filter((c) => ((c.food_axes ?? []) as string[]).length === 0)
    .map((c) => ({ id: c.id, name: c.name }));
}
