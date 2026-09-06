import "server-only";

import { createClient } from "@/lib/supabase/server";
import { formatAddress } from "@/lib/geo/address";
import { isUsState, stateName } from "@/lib/geo/state";
import { parseAlternatives, type LabelRule, type LabelSource } from "@/lib/labels/render";

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
  // The label page is always the seller viewing their own product, so their session carries the
  // account email New Mexico wants on the label without going through the storefront function.
  const {
    data: { user: viewer },
  } = await supabase.auth.getUser();

  const { data: product } = await supabase
    .from("products")
    .select(
      "id, title, ingredients, net_weight_value, net_weight_unit, allergens, handling_instructions",
    )
    .eq("id", productId)
    .eq("seller_id", sellerId)
    .maybeSingle();
  if (!product) return null;

  const { data: seller } = await supabase
    .from("seller_profiles")
    .select(
      "business_name, home_state, food_program_id, pickup_address_id, homemade_food_statement, mailing_address, contact_phone",
    )
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
          "required_elements, optional_elements, element_alternatives, regulator_website_url, seller_statement_prompt, disclaimer_text, disclaimer_min_pt, disclaimer_all_caps, disclaimer_font_note, metric_required, placard_required, placard_text, notes",
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
      optionalElements: rule?.optional_elements ?? [],
      elementAlternatives: parseAlternatives(rule?.element_alternatives),
      regulatorWebsiteUrl: rule?.regulator_website_url ?? null,
      sellerStatementPrompt: rule?.seller_statement_prompt ?? null,
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
      // Printed verbatim, and deliberately not profiles.phone — that is the E.164 mobile used for
      // order-update SMS. Sixteen jurisdictions want a number on the label; Tenn. Code
      // 53-1-118(b)(4)(A) is the one that also puts it on the listing page.
      producerPhone: seller.contact_phone,
      // The seller's account email. This page is only ever the seller looking at their own product,
      // so it comes from their session rather than through the SECURITY DEFINER function the
      // storefront uses. N.M. Stat. 25-12-3(C)(1) is the state that requires it outright.
      producerEmail: viewer?.email ?? null,
      permitNumber: licence?.license_number ?? null,
      municipality: address?.city ?? null,
      stateName: stateName(seller.home_state),
      ingredients: product.ingredients ?? [],
      netWeightValue: product.net_weight_value,
      netWeightUnit: product.net_weight_unit,
      allergens: product.allergens ?? [],
      productionDate: null,
      lotCode: null,
      expirationDate: null,
      handlingInstructions: product.handling_instructions,
      mailingAddress: seller.mailing_address,
      // The seller's own wording, where their state prescribes the substance and not the text.
      sellerStatement: seller.homemade_food_statement,
    },
  };
}

/**
 * What the seller's own state needs from THEM, as opposed to from the product.
 *
 * Three label elements are facts about the producer rather than the food, so they are collected once
 * on /seller/settings rather than per listing: the statement four states prescribe by substance and
 * leave the wording of (LA, MO, MT, NE, and Oregon's pet disclosure), the separate mailing
 * address South Dakota wants beside the physical address of production, and the telephone number
 * eleven states require outright and five more accept in place of an email address.
 *
 * This decides which cards that page shows. It resolves the seller's programme the same way
 * getLabelContext does, so the settings page and the label generator cannot disagree about what the
 * state asks for.
 */
export interface SellerLabelNeeds {
  /** The state's own words for what a seller-written statement must convey, or null. */
  statementPrompt: string | null;
  /** Whether this state asks for a mailing address separate from the production address. */
  needsMailingAddress: boolean;
  /**
   * Whether this state asks for a telephone number on the label — either outright, or as one half
   * of the phone-or-email alternative CO, DE, HI, IA and ID offer. Offered in both cases: a seller
   * in an either/or state may reasonably prefer to publish a number rather than their email.
   */
  needsPhone: boolean;
  /** True only where the number is required outright, false where it is one half of an either/or. */
  phoneRequired: boolean;
}

export async function getSellerLabelNeeds(sellerId: string): Promise<SellerLabelNeeds> {
  const none: SellerLabelNeeds = {
    statementPrompt: null,
    needsMailingAddress: false,
    needsPhone: false,
    phoneRequired: false,
  };
  const supabase = await createClient();

  const { data: seller } = await supabase
    .from("seller_profiles")
    .select("home_state, food_program_id")
    .eq("id", sellerId)
    .maybeSingle();
  if (!seller) return none;

  let programId = seller.food_program_id;
  if (!programId) {
    const { data: first } = await supabase
      .from("state_food_programs")
      .select("id")
      .eq("state_code", seller.home_state)
      .order("ordinal")
      .limit(1)
      .maybeSingle();
    programId = first?.id ?? null;
  }
  if (!programId) return none;

  const { data: rule } = await supabase
    .from("state_label_rules")
    .select("seller_statement_prompt, required_elements, optional_elements, element_alternatives")
    .eq("program_id", programId)
    .maybeSingle();
  if (!rule) return none;

  const alternatives = parseAlternatives(rule.element_alternatives);
  const asks = (el: string) =>
    (rule.required_elements ?? []).includes(el) ||
    (rule.optional_elements ?? []).includes(el) ||
    alternatives.some((group) => group.includes(el));

  return {
    statementPrompt: rule.seller_statement_prompt ?? null,
    needsMailingAddress: asks("mailing_address"),
    needsPhone: asks("producer_phone"),
    phoneRequired: (rule.required_elements ?? []).includes("producer_phone"),
  };
}
