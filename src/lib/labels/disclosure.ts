import "server-only";

import { createClient } from "@/lib/supabase/server";
import { renderLabel, type LabelRule, type LabelSource } from "@/lib/labels/render";

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
      producerEmail: null,
      permitNumber: row.permit_number,
      municipality: null,
      ingredients: (row.ingredients as string[] | null) ?? [],
      netWeightValue: row.net_weight_value == null ? null : String(row.net_weight_value),
      netWeightUnit: row.net_weight_unit,
      allergens: row.allergens ?? [],
      // Per-batch, and not knowable at browse time — omitted rather than invented.
      productionDate: null,
      lotCode: null,
    };

    // Reuses the label composer, so what the buyer reads and what gets printed cannot drift apart.
    const rendered = renderLabel(rule, source);

    out[productId] = {
      productId,
      required: row.predisclosure_required,
      lines: rendered.lines.map((l) => ({ caption: l.caption, value: l.value })),
      disclaimer: rendered.disclaimer,
      disclaimerAllCaps: rendered.disclaimerAllCaps,
    };
  }

  return out;
}
