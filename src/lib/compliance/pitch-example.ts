import "server-only";

import { createClient } from "@/lib/supabase/server";
import { stateName } from "@/lib/geo/state";

/**
 * A real restriction from a real state, for the seller pitch page.
 *
 * The page's central claim is "we will not let you publish a listing your state doesn't permit",
 * and the way to make that credible is to show one — with the words it rests on and a link to the
 * statute. So this reads live rows rather than quoting prose someone typed once: if the data is
 * corrected, the example on the marketing page is corrected with it, and if it is wrong, the claim
 * is falsifiable by anyone who follows the link. That is the same bargain `ComplianceBlock` makes
 * with a blocked seller.
 *
 * The cascade below always finds something, because every state has a label rule even where nothing
 * is banned. It never invents an example, and it never shows a `unclear` row as a restriction —
 * missing data is not a rule.
 */

export interface PitchExample {
  stateCode: string;
  stateName: string;
  /** The headline, in the seller's words. */
  headline: string;
  /** What we'd actually stop, said plainly. */
  effect: string;
  /** The state's own words, where the row carries them. */
  citation: string | null;
  programName: string | null;
  sourceUrl: string | null;
  sourceCheckedAt: string | null;
  verifiedAt: string | null;
  kind: "online_ban" | "category_ban" | "label";
}

const AXIS_LABEL: Record<string, string> = {
  cat_meat: "meat and poultry",
  cat_refrigerated: "anything that needs refrigerating",
  cat_low_acid_canned: "low-acid canned goods",
  cat_acidified: "pickles and acidified vegetables",
  cat_fermented: "fermented foods",
  cat_shelf_stable: "shelf-stable baked goods",
};

export async function getPitchExample(stateCode: string): Promise<PitchExample | null> {
  const code = stateCode.toUpperCase();
  const supabase = await createClient();

  const { data: programs } = await supabase
    .from("state_food_programs")
    .select("*")
    .eq("state_code", code)
    .order("ordinal");

  if (!programs || programs.length === 0) return null;
  const where = stateName(code);

  // 1. The strongest case: a programme that forbids selling food online at all.
  const banned = programs.find((p) => p.online_orders === "banned");
  if (banned) {
    return {
      stateCode: code,
      stateName: where,
      headline: `In ${where}, we won't let you list food for sale online.`,
      effect:
        "Your non-food listings carry on as normal. It's the food listing that's blocked, not " +
        "your storefront — pausing the whole shop would take down the legal candles along with " +
        "the illegal bread.",
      citation: banned.venue_note,
      programName: banned.name,
      sourceUrl: banned.source_url,
      sourceCheckedAt: banned.source_checked_at,
      verifiedAt: banned.verified_at,
      kind: "online_ban",
    };
  }

  // 2. A category one of the state's programmes won't permit.
  for (const program of programs) {
    for (const [axis, label] of Object.entries(AXIS_LABEL)) {
      if ((program[axis as keyof typeof program] as string) === "banned") {
        return {
          stateCode: code,
          stateName: where,
          headline: `In ${where}, we won't let you publish ${label} under ${program.name}.`,
          effect:
            programs.length > 1
              ? "Another of your state's programmes may permit it — which is exactly why we ask " +
                "which one you're on before you publish, instead of applying whichever rule is " +
                "most permissive."
              : "Everything your programme does permit publishes normally.",
          citation: program.category_note,
          programName: program.name,
          sourceUrl: program.source_url,
          sourceCheckedAt: program.source_checked_at,
          verifiedAt: program.verified_at,
          kind: "category_ban",
        };
      }
    }
  }

  // 3. Everywhere else: the label. Every state prescribes something, and most prescribe wording.
  const { data: rule } = await supabase
    .from("state_label_rules")
    .select("disclaimer_text, disclaimer_min_pt, required_elements, source_url, source_checked_at, verified_at, program_id")
    .in(
      "program_id",
      programs.map((p) => p.id),
    )
    .not("disclaimer_text", "is", null)
    .limit(1)
    .maybeSingle();

  if (rule?.disclaimer_text) {
    const program = programs.find((p) => p.id === rule.program_id);
    return {
      stateCode: code,
      stateName: where,
      headline: `In ${where}, this sentence has to be on the package, in these words.`,
      effect:
        `We print it for you, at the size the rule requires, and we won't print a label that's ` +
        `missing something ${where} asks for — we tell you which field to fill in instead.`,
      citation: rule.disclaimer_text,
      programName: program?.name ?? null,
      sourceUrl: rule.source_url,
      sourceCheckedAt: rule.source_checked_at,
      verifiedAt: rule.verified_at,
      kind: "label",
    };
  }

  return null;
}
