import "server-only";

import { createClient } from "@/lib/supabase/server";
import { formatAddress } from "@/lib/geo/address";
import { isUsState } from "@/lib/geo/state";
import type { LabelRule, LabelSource } from "@/lib/labels/render";

/**
 * Loading everything a label needs.
 *
 * The rule comes from the seller's chosen program where they have one. Without a choice we fall
 * back to the state's first program and say so — better than printing nothing, as long as the page
 * is honest that the rule may belong to a program the seller isn't on.
 */

export interface LabelContext {
  rule: LabelRule;
  source: LabelSource;
  /** The program the rule came from, and whether the seller actually chose it. */
  programName: string | null;
  programChosen: boolean;
  stateCode: string;
}

export async function getLabelContext(
  sellerId: string,
  productId: string,
): Promise<LabelContext | null> {
  const supabase = await createClient();

  const { data: product } = await supabase
    .from("products")
    .select("id, title, ingredients, net_weight_value, net_weight_unit, allergens")
    .eq("id", productId)
    .eq("seller_id", sellerId)
    .maybeSingle();
  if (!product) return null;

  const { data: seller } = await supabase
    .from("seller_profiles")
    .select("business_name, home_state, food_program_id, pickup_address_id")
    .eq("id", sellerId)
    .maybeSingle();
  if (!seller) return null;

  const [{ data: address }, { data: licence }, { data: programs }] = await Promise.all([
    seller.pickup_address_id
      ? supabase
          .from("addresses")
          .select("line1, line2, city, state, postal_code")
          .eq("id", seller.pickup_address_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    // A permit number for the label comes from a verified licence, not a rejected or pending one.
    supabase
      .from("seller_licenses")
      .select("license_number, license_type, verification_status")
      .eq("seller_id", sellerId)
      .eq("verification_status", "verified")
      .not("license_number", "is", null)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("state_food_programs")
      .select("id, name")
      .eq("state_code", seller.home_state)
      .order("ordinal"),
  ]);

  const programId = seller.food_program_id ?? programs?.[0]?.id ?? null;
  const programName = programs?.find((p) => p.id === programId)?.name ?? null;

  const { data: rule } = programId
    ? await supabase
        .from("state_label_rules")
        .select(
          "required_elements, disclaimer_text, disclaimer_min_pt, disclaimer_all_caps, disclaimer_font_note, metric_required, placard_required, placard_text, notes",
        )
        .eq("program_id", programId)
        .maybeSingle()
    : { data: null };

  return {
    stateCode: seller.home_state,
    programName,
    programChosen: !!seller.food_program_id,
    rule: {
      requiredElements: rule?.required_elements ?? [],
      disclaimerText: rule?.disclaimer_text ?? null,
      disclaimerMinPt: rule?.disclaimer_min_pt ?? null,
      disclaimerAllCaps: rule?.disclaimer_all_caps ?? false,
      disclaimerFontNote: rule?.disclaimer_font_note ?? null,
      metricRequired: rule?.metric_required ?? false,
      placardRequired: rule?.placard_required ?? false,
      placardText: rule?.placard_text ?? null,
      notes: rule?.notes ?? null,
    },
    source: {
      productName: product.title,
      businessName: seller.business_name,
      producerName: seller.business_name,
      producerAddress:
        address && isUsState(address.state)
          ? formatAddress({
              line1: address.line1,
              line2: address.line2 ?? "",
              city: address.city,
              state: address.state,
              postal: address.postal_code,
            })
          : null,
      // Not collected today — surfaced as missing where a state asks for it.
      producerPhone: null,
      producerEmail: null,
      permitNumber: licence?.license_number ?? null,
      municipality: address?.city ?? null,
      ingredients: product.ingredients ?? [],
      netWeightValue: product.net_weight_value,
      netWeightUnit: product.net_weight_unit,
      allergens: product.allergens ?? [],
      productionDate: null,
      lotCode: null,
    },
  };
}
