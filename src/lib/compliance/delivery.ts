import "server-only";

import { createClient } from "@/lib/supabase/server";
import { stateName } from "@/lib/geo/state";
import type { ComplianceBlock } from "@/lib/compliance/blocks";

/**
 * Whether this seller's programme lets them hand the food to the buyer themselves.
 *
 * Local delivery is a feature we built for logistics and then never checked against the law, even
 * though several states answer it directly and several more are the reason `direct_delivery`
 * defaults to `unclear`: whether taking food to a buyer's door counts as a permitted venue is a
 * legal question most sources do not address.
 *
 * WHAT THIS GATES, PRECISELY. Our delivery feature is the producer (or someone they arrange)
 * driving the order to the buyer, which is `direct_delivery`. It is NOT shipping — we have no
 * carrier integration — so `mail_delivery` is unreachable through the product today and is not
 * gated here. That matters for Texas, whose § 437.0194(b)(1) permits an internet sale only where
 * the operator, an employee or a household member personally delivers it: we satisfy it by having
 * no courier option at all rather than by checking one.
 *
 * THREE ANSWERS, NOT TWO. A ban stops delivery being offered. `unclear` does not — a seller must
 * not be blocked by a question nobody has answered — but they are told it is open, with the source,
 * so the decision is theirs and informed rather than ours and silent. That is the same standard the
 * category gate uses: only an outright ban blocks.
 */

export type DeliveryStatus = "allowed" | "unclear" | "banned";

export interface DeliveryPermission {
  status: DeliveryStatus;
  /** Set only for `banned`: delivery may not be offered at all. */
  block: ComplianceBlock | null;
  /** Set only for `unclear`: delivery may be offered, and here is what is unresolved. */
  caution: ComplianceBlock | null;
}

const ALLOWED: DeliveryPermission = { status: "allowed", block: null, caution: null };

export async function getDeliveryPermission(sellerId: string): Promise<DeliveryPermission> {
  const supabase = await createClient();

  const { data: seller } = await supabase
    .from("seller_profiles")
    .select("home_state, food_program_id")
    .eq("id", sellerId)
    .maybeSingle();
  if (!seller) return ALLOWED;

  const { data: programs } = await supabase
    .from("state_food_programs")
    .select(
      "id, name, direct_delivery, mail_delivery, mail_note, venue_note, source_url, source_checked_at, verified_at",
    )
    .eq("state_code", seller.home_state)
    .order("ordinal");

  // The seller's chosen programme decides it. Without one we fall back to the state's first, which
  // is the same resolution the label and category gates use.
  const program = programs?.find((p) => p.id === seller.food_program_id) ?? programs?.[0] ?? null;
  if (!program) return ALLOWED;

  const status = (program.direct_delivery ?? "unclear") as DeliveryStatus;
  if (status === "allowed") return ALLOWED;

  const source = {
    // `mail_note` is written about carriers; the venue list is what decides whether a doorstep is a
    // place the sale may happen, so it is the better citation for this question.
    citation: program.venue_note ?? program.mail_note ?? null,
    programName: program.name,
    sourceUrl: program.source_url,
    sourceCheckedAt: program.source_checked_at,
    verified: !!program.verified_at,
  };

  const where = stateName(seller.home_state);

  if (status === "banned") {
    return {
      status,
      block: {
        message:
          `${where} does not allow food sold under ${program.name} to be delivered to the buyer, so ` +
          `local delivery can't be switched on. Pickup is unaffected.`,
        ...source,
      },
      caution: null,
    };
  }

  return {
    status,
    block: null,
    caution: {
      message:
        `${where} hasn't answered whether taking food to a buyer's address counts as a permitted ` +
        `place to sell it under ${program.name}. You can offer delivery — we don't block on an ` +
        `open question — but check with your state before you rely on it.`,
      ...source,
    },
  };
}
