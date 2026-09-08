import "server-only";

import { createClient } from "@/lib/supabase/server";
import { stateName } from "@/lib/geo/state";
import { elementLabel } from "@/lib/labels/render";
import { programRequirements, programSummary, type ProgramRequirement } from "@/lib/compliance/onboarding";
import type { StateFoodProgram } from "@/lib/compliance/programs";
import {
  aggregateOnlineVerdict,
  cadence,
  type OnlineVerdict,
} from "@/lib/compliance/guide-format";


/**
 * The public cottage-food guide — everything we know about one state, assembled once.
 *
 * This is the same data the listing gates, the label generator and the revenue-cap job read. It is
 * published rather than kept behind the login for two reasons. It is the most defensible thing
 * Harvest Local has, and nobody else publishes it correctly. And `verified_at` is null on
 * essentially every row: the corrections in here are ours, not a state's, and the people best
 * placed to catch a mistake are the sellers living under the rule. The same argument
 * `ComplianceBlock` makes for showing a seller why they were blocked applies to showing everyone
 * else what we think the rule is.
 *
 * So every claim on these pages carries the words it rests on, the source it came from, the date we
 * read it, and whether a person has signed it off. Nothing is asserted more confidently than the
 * row behind it justifies — `unclear` renders as "the law does not say", never as a yes or a no.
 */


export interface LabelGuide {
  /** Element keys in the order the rule lists them, with their reader-facing names. */
  required: { key: string; label: string }[];
  optional: { key: string; label: string }[];
  /** Either/or groups: at least one member of each. */
  alternatives: { key: string; label: string }[][];
  /** Quoted statute, printed verbatim. Never paraphrased — see the column comment. */
  disclaimerText: string | null;
  disclaimerMinPt: number | null;
  disclaimerAllCaps: boolean;
  disclaimerFontNote: string | null;
  metricRequired: boolean;
  placardRequired: boolean;
  placardText: string | null;
  /** The state prescribes the substance and leaves the seller to word it. */
  sellerStatementPrompt: string | null;
  /** In these states the listing itself owes the buyer the disclosure, before payment. */
  predisclosureRequired: boolean;
  notes: string | null;
  sourceUrl: string;
  sourceCheckedAt: string;
  verifiedAt: string | null;
}

export interface ObligationGuide {
  kind: string;
  label: string;
  detail: string;
  citation: string | null;
  sourceUrl: string | null;
  /** "every year on 15 January" / "every 24 months". */
  cadence: string;
}

export interface ProgramGuide {
  program: StateFoodProgram;
  summary: string;
  requirements: ProgramRequirement[];
  /** The six regulatory axes, with this programme's answer to each. */
  categories: { axis: string; label: string; value: string }[];
  label: LabelGuide | null;
  obligations: ObligationGuide[];
}

export interface StateGuide {
  stateCode: string;
  stateName: string;
  programs: ProgramGuide[];
  onlineSales: OnlineVerdict;
  /** True when at least one programme in the state has been signed off by a person. */
  anyVerified: boolean;
}

/*
 * Deliberately absent: `state_cottage_food_rules.revenue_cap`.
 *
 * That column is our operational fallback — the figure `record_order_revenue` pauses a storefront
 * against when a seller has chosen no programme — and all 51 rows shipped carrying the same
 * invented $50,000. It is a real number for exactly the states an admin has since verified, and a
 * placeholder everywhere else. A page whose whole claim is "we read the statute" must not publish
 * a figure nobody read. The researched, per-programme caps in `state_food_programs.revenue_cap` are
 * what these pages show; the fallback stays on /seller/compliance, where it is labelled as a
 * placeholder until `verified_at` is set.
 */

const AXES = [
  { axis: "cat_shelf_stable", label: "Shelf-stable baked goods, candy, dry mixes" },
  { axis: "cat_refrigerated", label: "Anything needing refrigeration (TCS)" },
  { axis: "cat_meat", label: "Meat and poultry" },
  { axis: "cat_acidified", label: "Pickles and acidified vegetables" },
  { axis: "cat_low_acid_canned", label: "Low-acid canned goods" },
  { axis: "cat_fermented", label: "Fermented foods" },
] as const;

/** Map a set of element keys to reader-facing names, preserving the rule's own order. */
function named(keys: string[] | null | undefined): { key: string; label: string }[] {
  return (keys ?? []).map((key) => ({ key, label: elementLabel(key) }));
}

function parseAlternativeGroups(value: unknown): { key: string; label: string }[][] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((group): group is unknown[] => Array.isArray(group))
    .map((group) => named(group.filter((m): m is string => typeof m === "string")))
    .filter((group) => group.length > 0);
}

/**
 * The whole guide for one state. A single round of reads, because the state page renders all of it
 * and splitting it up would make the page's honesty depend on which query happened to fail.
 */
export async function getStateGuide(stateCode: string): Promise<StateGuide | null> {
  const code = stateCode.toUpperCase();
  const supabase = await createClient();

  const { data: programs } = await supabase
    .from("state_food_programs")
    .select("*")
    .eq("state_code", code)
    .order("ordinal");

  if (!programs || programs.length === 0) return null;

  const programIds = programs.map((p) => p.id);

  const [{ data: labelRules }, { data: obligations }] = await Promise.all([
    supabase.from("state_label_rules").select("*").in("program_id", programIds),
    supabase
      .from("program_obligations")
      .select(
        "program_id, kind, label, detail, citation, source_url, schedule, due_month, due_day, interval_months",
      )
      .in("program_id", programIds)
      .order("label"),
  ]);

  const labelByProgram = new Map((labelRules ?? []).map((r) => [r.program_id, r]));
  const obligationsByProgram = new Map<string, ObligationGuide[]>();
  for (const row of obligations ?? []) {
    const list = obligationsByProgram.get(row.program_id) ?? [];
    list.push({
      kind: row.kind,
      label: row.label,
      detail: row.detail,
      citation: row.citation,
      sourceUrl: row.source_url,
      cadence: cadence(row),
    });
    obligationsByProgram.set(row.program_id, list);
  }

  const guides: ProgramGuide[] = programs.map((program) => {
    const rule = labelByProgram.get(program.id);
    return {
      program,
      summary: programSummary(program),
      requirements: programRequirements(program),
      categories: AXES.map(({ axis, label }) => ({
        axis,
        label,
        value: (program[axis as keyof StateFoodProgram] as string) ?? "unclear",
      })),
      label: rule
        ? {
            required: named(rule.required_elements),
            optional: named(rule.optional_elements),
            alternatives: parseAlternativeGroups(rule.element_alternatives),
            disclaimerText: rule.disclaimer_text,
            disclaimerMinPt: rule.disclaimer_min_pt,
            disclaimerAllCaps: rule.disclaimer_all_caps,
            disclaimerFontNote: rule.disclaimer_font_note,
            metricRequired: rule.metric_required,
            placardRequired: rule.placard_required,
            placardText: rule.placard_text,
            sellerStatementPrompt: rule.seller_statement_prompt,
            predisclosureRequired: rule.predisclosure_required,
            notes: rule.notes,
            sourceUrl: rule.source_url,
            sourceCheckedAt: rule.source_checked_at,
            verifiedAt: rule.verified_at,
          }
        : null,
      obligations: obligationsByProgram.get(program.id) ?? [],
    };
  });

  return {
    stateCode: code,
    stateName: stateName(code),
    programs: guides,
    onlineSales: aggregateOnlineVerdict(programs.map((p) => p.online_orders)),
    anyVerified: programs.some((p) => !!p.verified_at),
  };
}

export interface StateIndexEntry {
  stateCode: string;
  stateName: string;
  programCount: number;
  onlineSales: OnlineVerdict;
}

/** Every jurisdiction we hold rules for — the directory index. */
export async function getStateIndex(): Promise<StateIndexEntry[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("state_food_programs")
    .select("state_code, online_orders")
    .order("state_code");

  const byState = new Map<string, string[]>();
  for (const row of data ?? []) {
    const list = byState.get(row.state_code) ?? [];
    list.push(row.online_orders);
    byState.set(row.state_code, list);
  }

  return [...byState.entries()]
    .map(([stateCode, verdicts]) => ({
      stateCode,
      stateName: stateName(stateCode),
      programCount: verdicts.length,
      onlineSales: aggregateOnlineVerdict(verdicts),
    }))
    .sort((a, b) => a.stateName.localeCompare(b.stateName));
}
