import "server-only";

import { createClient } from "@/lib/supabase/server";
import { stateName } from "@/lib/geo/state";
import {
  parseAlternatives,
  renderLabel,
  type LabelRule,
  type LabelSource,
  type MissingField,
} from "@/lib/labels/render";

/**
 * The label information a buyer has to see before they pay.
 *
 * Texas §437.0194(b)(2) permits an internet sale only if the labelling information reaches the
 * consumer "before the operator accepts payment", posted as a legible statement — the package
 * turning up later is too late. Nebraska requires the disclaimer in any internet advertising, which
 * a storefront listing is.
 *
 * The underlying data spans tables a buyer cannot read (the producer's address, the permit number),
 * so it comes through `product_label_disclosure()`, a SECURITY DEFINER function that returns
 * exactly the fields required on the physical label and nothing more.
 */

export interface ProductDisclosure {
  productId: string;
  required: boolean;
  lines: { caption: string | null; value: string }[];
  disclaimer: string | null;
  disclaimerAllCaps: boolean;
  /**
   * What the state requires the buyer to be shown and we cannot show.
   *
   * `renderLabel()` drops an element with no value into `missing`, and until now this function threw
   * that away — so a Californian listing with no recorded permit number quietly rendered an
   * advertisement missing the permit number Cal. Health & Saf. Code 114365.3(f)(2) requires, and
   * looked complete. The buyer still sees what we have (a partial label is not a misleading one),
   * but the SELLER has to be told, because they are the only one who can fix it.
   *
   * Per-batch elements are excluded: a production date is a fact about a jar, not about a listing,
   * so no listing can ever carry one and warning about it would be noise the seller cannot act on.
   * Indiana is where that bites — 16-42-5.3-5 puts the production date in the label and (b) asks for
   * "the label" on the website — and it is recorded in that rule's notes rather than nagged about
   * here.
   */
  missing: MissingField[];
}

export async function getProductDisclosures(
  productIds: string[],
): Promise<Record<string, ProductDisclosure>> {
  if (productIds.length === 0) return {};
  const supabase = await createClient();

  const rows = await Promise.all(
    [...new Set(productIds)].map(async (id) => {
      const { data } = await supabase.rpc("product_label_disclosure", { p_product_id: id });
      return [id, data?.[0] ?? null] as const;
    }),
  );

  const out: Record<string, ProductDisclosure> = {};

  for (const [productId, row] of rows) {
    if (!row) continue;

    const rule: LabelRule = {
      requiredElements: row.required_elements ?? [],
      optionalElements: row.optional_elements ?? [],
      elementAlternatives: parseAlternatives(row.element_alternatives),
      regulatorWebsiteUrl: row.regulator_website_url,
      disclaimerText: row.disclaimer_text,
      disclaimerMinPt: row.disclaimer_min_pt,
      disclaimerAllCaps: row.disclaimer_all_caps,
      disclaimerFontNote: null,
      metricRequired: row.metric_required,
      placardRequired: false,
      placardText: null,
      notes: null,
    };

    const source: LabelSource = {
      productName: row.product_name,
      businessName: row.business_name,
      producerName: row.business_name,
      producerAddress: row.producer_address,
      producerPhone: null,
      // Returned by the RPC only where the state's own rule asks for it; null everywhere else.
      producerEmail: row.producer_email,
      permitNumber: row.permit_number,
      // California's advertising rule wants the county of approval on the listing itself
      // (114365.3(f)(1)), so this is not a print-only element.
      municipality: row.municipality,
      stateName: stateName(row.state_code),
      ingredients: (row.ingredients as string[] | null) ?? [],
      netWeightValue: row.net_weight_value == null ? null : String(row.net_weight_value),
      netWeightUnit: row.net_weight_unit,
      allergens: row.allergens ?? [],
      // Per-batch, and not knowable at browse time — omitted rather than invented.
      productionDate: null,
      lotCode: null,
      expirationDate: null,
      handlingInstructions: row.handling_instructions,
      sellerStatement: row.seller_statement,
    };

    // Reuses the label composer, so what the buyer reads and what gets printed cannot drift apart.
    const rendered = renderLabel(rule, source);

    out[productId] = {
      productId,
      required: row.predisclosure_required,
      lines: rendered.lines.map((l) => ({ caption: l.caption, value: l.value })),
      disclaimer: rendered.disclaimer,
      disclaimerAllCaps: rendered.disclaimerAllCaps,
      // Per-batch elements can never be on a listing, so they are not the seller's to fix here.
      missing: rendered.missing.filter((m) => m.fix !== "print"),
    };
  }

  return out;
}
