import "server-only";

import { createClient } from "@/lib/supabase/server";
import { formatAddress } from "@/lib/geo/address";
import { isUsState, stateName } from "@/lib/geo/state";
import {
  describeListingGaps,
  parseAlternatives,
  renderLabel,
  type LabelRule,
  type LabelSource,
} from "@/lib/labels/render";
import { parseAllergens, parseIngredients } from "@/lib/products/labeling";
import type { ComplianceBlock } from "@/lib/compliance/blocks";

/**
 * Publication is refused where the listing itself is the legal disclosure.
 *
 * Eleven jurisdictions require information to reach the buyer BEFORE the sale, and in those the
 * storefront listing is not a description of the compliance artifact — it IS the compliance
 * artifact. Tenn. Code 53-1-118(b)(5)(A)(iv) names "the webpage on which the homemade food item is
 * offered for sale"; Ind. Code 16-42-5.3-5(b) says a vendor "shall post the label of each food
 * product on the vendor's website"; Utah and Wyoming make being informed a precondition of the
 * exemption the seller is relying on.
 *
 * WHAT is owed varies, and treating it as one thing was a defect. Four states put the whole label on
 * the page (IN, NM, OK, TN). The rest ask for much less: California's § 114365.3(f) names three
 * items, Minnesota's 28A.152 subd. 2(d) and Illinois's 410 ILCS 625/4(b)(10) name a single sentence,
 * and Utah's § 4-5a-104(6) names a single fact. `predisclosure_elements` records the difference, and
 * a seller is held only to what their own state asked for.
 *
 * `DisclosureGapNotice` already tells a seller when a live listing is short of what their state
 * requires. This is the other half: in a predisclosure state we do not let it go live incomplete in
 * the first place. Everywhere else the notice stays advisory, because there the label travels with
 * the package and a listing missing a field is untidy rather than unlawful.
 *
 * Per-batch elements are never counted — a production date is a fact about a jar, and no listing can
 * carry one.
 */

export interface PublicationInput {
  categoryId: string;
  subcategoryId?: string;
  status: string;
  title: string;
  ingredients?: string;
  netWeightValue?: string;
  netWeightUnit?: string;
  allergens: string[];
  handlingInstructions?: string;
}

export async function describePredisclosureBlock(
  sellerId: string,
  input: PublicationInput,
): Promise<ComplianceBlock | null> {
  // A draft discloses nothing to anyone, so there is nothing to be short of.
  if (input.status !== "active") return null;

  const supabase = await createClient();

  const categoryIds = [input.categoryId, input.subcategoryId].filter(Boolean) as string[];
  const { data: categories } = await supabase
    .from("categories")
    .select("requires_food_permit")
    .in("id", categoryIds);
  if (!(categories ?? []).some((c) => c.requires_food_permit)) return null;

  const { data: seller } = await supabase
    .from("seller_profiles")
    .select(
      "business_name, home_state, food_program_id, pickup_address_id, homemade_food_statement, mailing_address, contact_phone, producer_id_number",
    )
    .eq("id", sellerId)
    .maybeSingle();
  if (!seller) return null;

  const [{ data: viewer }, { data: address }, { data: licence }, { data: programs }] =
    await Promise.all([
      supabase.auth.getUser().then((r) => ({ data: r.data.user })),
      seller.pickup_address_id
        ? supabase
            .from("addresses")
            .select("line1, line2, city, state, postal_code")
            .eq("id", seller.pickup_address_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("seller_licenses")
        .select("license_number")
        .eq("seller_id", sellerId)
        .eq("verification_status", "verified")
        .not("license_number", "is", null)
        .limit(1)
        .maybeSingle(),
      supabase
        .from("state_food_programs")
        .select("id, name, source_url, source_checked_at, verified_at")
        .eq("state_code", seller.home_state)
        .order("ordinal"),
    ]);

  // The seller's chosen programme decides the rule; without one, the state's first. Resolved the
  // same way `getLabelContext` and `getSellerLabelNeeds` do, so the three cannot disagree about
  // what the state asks for.
  const program =
    programs?.find((p) => p.id === seller.food_program_id) ?? programs?.[0] ?? null;
  if (!program) return null;

  const { data: ruleRow } = await supabase
    .from("state_label_rules")
    .select(
      "required_elements, optional_elements, element_alternatives, predisclosure_elements, predisclosure_disclaimer_text, regulator_website_url, seller_statement_prompt, disclaimer_text, disclaimer_min_pt, disclaimer_all_caps, metric_required, predisclosure_required, address_withheld_until_payment",
    )
    .eq("program_id", program.id)
    .maybeSingle();
  if (!ruleRow?.predisclosure_required) return null;

  // What the LISTING must carry, which is not always what the jar must carry. Where the state named
  // a narrower pre-sale set we hold publication against that set alone — blocking a Utah seller for
  // want of an address would be enforcing § 4-5a-104(3), which governs the label, against
  // § 4-5a-104(6), which asks only that the buyer be told the food is not inspected.
  //
  // Null means the whole label is genuinely owed before the sale (IN, NM, OK, TN), and an empty
  // array means the statement alone (MN, IL). `canPrint()` still holds the full label to the full
  // rule on the seller's own label page.
  const narrowed = ruleRow.predisclosure_elements;

  // Texas is the other shape: the full label MINUS the address, on a timing rule (Tex. Health &
  // Safety Code 437.0194(c)(1)). Still required on the printed label under 437.0193(b). The two
  // compose — a narrowed set that happened to name the address would still drop it here.
  const withheld = !!ruleRow.address_withheld_until_payment;

  const rule: LabelRule = {
    requiredElements: (narrowed ?? ruleRow.required_elements ?? []).filter(
      (e) => !(withheld && (e === "producer_address" || e === "municipality")),
    ),
    optionalElements: narrowed ? [] : (ruleRow.optional_elements ?? []),
    elementAlternatives: (narrowed ? [] : parseAlternatives(ruleRow.element_alternatives)).filter(
      (group) => !(withheld && group.includes("producer_address")),
    ),
    regulatorWebsiteUrl: ruleRow.regulator_website_url,
    sellerStatementPrompt: ruleRow.seller_statement_prompt,
    // Illinois prescribes a shorter sentence for the online interface than for the package
    // (410 ILCS 625/4(b)(10) against (b)(7)(E)), and the listing is the interface.
    disclaimerText: ruleRow.predisclosure_disclaimer_text ?? ruleRow.disclaimer_text,
    disclaimerMinPt: ruleRow.disclaimer_min_pt,
    disclaimerAllCaps: ruleRow.disclaimer_all_caps ?? false,
    disclaimerFontNote: null,
    metricRequired: ruleRow.metric_required ?? false,
    placardRequired: false,
    placardText: null,
    notes: null,
  };

  const source: LabelSource = {
    productName: input.title,
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
    mailingAddress: seller.mailing_address,
    producerPhone: seller.contact_phone,
    producerIdNumber: seller.producer_id_number,
    producerEmail: viewer?.email ?? null,
    permitNumber: licence?.license_number ?? null,
    municipality: address?.city ?? null,
    stateName: stateName(seller.home_state),
    ingredients: parseIngredients(input.ingredients ?? ""),
    netWeightValue: input.netWeightValue || null,
    netWeightUnit: input.netWeightUnit || null,
    allergens: parseAllergens(input.allergens),
    // Per-batch, and never knowable from a listing.
    productionDate: null,
    lotCode: null,
    expirationDate: null,
    handlingInstructions: input.handlingInstructions || null,
    sellerStatement: seller.homemade_food_statement,
  };

  const fields = describeListingGaps(renderLabel(rule, source).missing);
  if (!fields) return null;

  return {
    message:
      `${stateName(seller.home_state)} requires buyers to be shown this product's label information ` +
      `before they pay, so the listing itself has to carry it. It can't go live until you add: ` +
      `${fields}. Save it as a draft in the meantime and nothing is lost.`,
    citation: null,
    programName: program.name,
    sourceUrl: program.source_url,
    sourceCheckedAt: program.source_checked_at,
    verified: !!program.verified_at,
  };
}
