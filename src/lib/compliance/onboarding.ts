import "server-only";

import { createClient } from "@/lib/supabase/server";
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

function money(value: string | null): string {
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
