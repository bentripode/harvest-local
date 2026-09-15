import type { Money } from "@/lib/money";
import "server-only";

import { createClient } from "@/lib/supabase/server";
import { stateName } from "@/lib/geo/state";
import type { ComplianceBlock } from "@/lib/compliance/blocks";
import type { StateFoodProgram } from "@/lib/compliance/programs";

/**
 * Choosing a cottage-food program.
 *
 * A seller doesn't know what "Class B Cottage Food" means — they know they want to sell bread, or
 * jam, or pickles. So the wizard asks what they intend to make in marketplace categories, maps that
 * to the regulatory axes through `categories.food_axes`, and shows which of their state's programs
 * actually cover it. The trade-offs between programs are then stated in the seller's terms: caps,
 * licences, inspections, training.
 */

const AXIS_COLUMN = {
  shelf_stable: "cat_shelf_stable",
  refrigerated: "cat_refrigerated",
  meat: "cat_meat",
  acidified: "cat_acidified",
  low_acid_canned: "cat_low_acid_canned",
  fermented: "cat_fermented",
} as const;

export type FoodAxis = keyof typeof AXIS_COLUMN;

/** A food category a seller can say they intend to sell, with the axes it implicates. */
export interface IntendedCategory {
  id: string;
  name: string;
  axes: FoodAxis[];
}

/** One requirement the seller has to satisfy before they can trade under a program. */
export interface ProgramRequirement {
  key: string;
  label: string;
  detail: string | null;
  url: string | null;
}

export interface ProgramChoice {
  program: StateFoodProgram;
  /** Axes this program bans that the seller said they want to sell. Empty = it covers them. */
  blockedAxes: FoodAxis[];
  requirements: ProgramRequirement[];
  /** One line summarising the deal: cap, licence, inspection. */
  summary: string;
}

/** The food categories a seller can choose from, in menu order. */
export async function getIntendedCategories(): Promise<IntendedCategory[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("categories")
    .select("id, name, food_axes, requires_food_permit, sort_order")
    .is("parent_id", null)
    .eq("requires_food_permit", true)
    .order("sort_order");

  return (data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    axes: ((c.food_axes ?? []) as string[]).filter((a): a is FoodAxis => a in AXIS_COLUMN),
  }));
}

function money(value: Money | null): string {
  const n = Number(value ?? 0);
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

/** What the seller has to do before selling under this program, in plain terms. */
export function programRequirements(program: StateFoodProgram): ProgramRequirement[] {
  const out: ProgramRequirement[] = [];

  if (program.license_required === "yes" || program.license_required === "conditional") {
    out.push({
      key: "license",
      label:
        program.license_required === "yes"
          ? "A licence, permit or registration"
          : "A licence in some circumstances",
      detail: program.license_note,
      url: program.application_url,
    });
  }

  if (program.inspection_required) {
    out.push({
      key: "inspection",
      label: "A kitchen inspection before you start",
      detail: null,
      url: null,
    });
  }

  if (program.training_required === "yes" || program.training_required === "conditional") {
    out.push({
      key: "training",
      label:
        program.training_required === "yes"
          ? "A food handler training course"
          : "Food handler training for some foods",
      detail: program.training_note,
      url: program.training_url,
    });
  }

  if (program.recipe_approval === "yes" || program.recipe_approval === "conditional") {
    out.push({
      key: "recipe",
      label:
        program.recipe_approval === "yes"
          ? "Recipe approval or lab testing"
          : "Recipe approval for some foods",
      detail: program.recipe_note,
      url: null,
    });
  }

  if (program.license_threshold) {
    out.push({
      key: "threshold",
      label: `A licence once you pass ${money(program.license_threshold)} a year`,
      detail: program.license_note,
      url: program.application_url,
    });
  }

  return out;
}

/** "No sales cap · no licence needed · no inspection" — the deal at a glance. */
export function programSummary(program: StateFoodProgram): string {
  const parts: string[] = [];

  if (program.cap_basis === "none") {
    parts.push("no sales cap");
  } else if (program.cap_basis === "per_product") {
    parts.push(`${money(program.revenue_cap)} per product`);
  } else if (program.cap_basis === "per_category") {
    parts.push(`${money(program.revenue_cap)} for some foods`);
  } else {
    parts.push(`${money(program.revenue_cap)} a year`);
  }

  parts.push(program.license_required === "no" ? "no licence needed" : "licence required");
  if (program.inspection_required) parts.push("inspection required");
  if (program.online_orders !== "allowed") parts.push("no online orders");

  return parts.join(" · ");
}

/**
 * Every program in the seller's state, annotated with whether it covers what they want to make.
 * Nothing is hidden — a seller should see that a program exists and why it doesn't fit, rather than
 * wonder where it went.
 */
export async function getProgramChoices(
  sellerId: string,
  intendedAxes: FoodAxis[],
): Promise<ProgramChoice[]> {
  const supabase = await createClient();

  const { data: seller } = await supabase
    .from("seller_profiles")
    .select("home_state")
    .eq("id", sellerId)
    .maybeSingle();
  if (!seller) return [];

  const { data: programs } = await supabase
    .from("state_food_programs")
    .select("*")
    .eq("state_code", seller.home_state)
    .order("ordinal");

  return (programs ?? []).map((program) => {
    const blockedAxes = intendedAxes.filter(
      (axis) => (program[AXIS_COLUMN[axis]] as string) === "banned",
    );
    return {
      program,
      blockedAxes,
      requirements: programRequirements(program),
      summary: programSummary(program),
    };
  });
}

/** The seller's current choice, if they've made one. */
export async function getChosenProgram(sellerId: string): Promise<StateFoodProgram | null> {
  const supabase = await createClient();
  const { data: seller } = await supabase
    .from("seller_profiles")
    .select("food_program_id")
    .eq("id", sellerId)
    .maybeSingle();
  if (!seller?.food_program_id) return null;

  const { data } = await supabase
    .from("state_food_programs")
    .select("*")
    .eq("id", seller.food_program_id)
    .maybeSingle();
  return data ?? null;
}

/**
 * A food listing may not go live until the seller has said which programme they are on.
 *
 * Without a choice, `seller_permits_food_axis()` and `seller_allows_online_food_sales()` fall back
 * to "does ANY programme in this state permit it" — the most permissive answer available. In the
 * multi-programme states that is not a small imprecision:
 *
 *   * California Class A bans meat where MEHKO allows it, so the same listing is lawful or not
 *     depending on a choice we were letting sellers skip.
 *   * Utah runs three mutually exclusive routes answering to three different regulators — the
 *     microenterprise one permits with the COUNTY, not the state.
 *   * Vermont runs four, two licensed and two exempt, with different labels and different duties.
 *
 * It is required in single-programme states too, and that is deliberate rather than an oversight.
 * The choice is one click there, and what it buys is that the seller has been shown what their
 * programme actually demands — the cap, the licence, the training, the inspection — before they
 * start selling under it, rather than after somebody asks.
 *
 * Non-food listings are unaffected. A candle maker has no food programme to choose.
 */
export async function describeProgramChoiceBlock(
  sellerId: string,
  categoryId: string,
): Promise<ComplianceBlock | null> {
  const supabase = await createClient();

  const { data: category } = await supabase
    .from("categories")
    .select("requires_food_permit")
    .eq("id", categoryId)
    .maybeSingle();
  if (!category?.requires_food_permit) return null;

  const { data: seller } = await supabase
    .from("seller_profiles")
    .select("home_state, food_program_id")
    .eq("id", sellerId)
    .maybeSingle();
  if (!seller || seller.food_program_id) return null;

  const { count } = await supabase
    .from("state_food_programs")
    .select("id", { count: "exact", head: true })
    .eq("state_code", seller.home_state);

  const many = (count ?? 0) > 1;
  const where = stateName(seller.home_state);

  return {
    message: many
      ? `${where} runs ${count} different cottage food programmes, and they don't allow the same ` +
        `things. Choose the one you're on before publishing food — otherwise we'd be applying ` +
        `whichever rule happens to be most permissive, which may not be yours.`
      : `Choose your ${where} food programme before publishing food. It takes a moment and it's ` +
        `how we know which rules to hold you to.`,
    citation: null,
    programName: null,
    sourceUrl: null,
    sourceCheckedAt: null,
    verified: false,
    fixPath: "/seller/onboarding/program",
    fixLabel: "Choose your programme",
  };
}
