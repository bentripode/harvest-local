import { describe, expect, it } from "vitest";

import { renderLabel, type LabelRule, type LabelSource } from "@/lib/labels/render";

/**
 * What the pre-checkout disclosure does with a required field the seller hasn't supplied.
 *
 * `getProductDisclosures` renders through `renderLabel` and used to keep only `lines`, throwing
 * `missing` away — so an advertisement short of something the state requires looked complete. These
 * pin the composer's half of that: the element is absent from `lines` AND named in `missing`, so a
 * caller can tell the difference between "not required" and "required and not shown".
 */
const californiaRule: LabelRule = {
  requiredElements: [
    "business_name",
    "producer_address",
    "permit_number",
    "municipality",
    "product_name",
    "ingredients_desc_by_weight",
    "allergens",
    "net_weight",
  ],
  disclaimerText: "Made in a Home Kitchen.",
  disclaimerMinPt: 12,
  disclaimerAllCaps: false,
  disclaimerFontNote: null,
  metricRequired: false,
  placardRequired: false,
  placardText: null,
  notes: null,
};

/** A seller mid-onboarding: no pickup address recorded, no verified permit number. */
const incomplete: LabelSource = {
  productName: "Levain",
  businessName: "Ben's Baked Bread",
  producerName: "Ben's Baked Bread",
  producerAddress: null,
  mailingAddress: null,
  producerPhone: null,
  producerEmail: null,
  producerIdNumber: null,
  permitNumber: null,
  countyOfApproval: null,
  municipality: null,
  stateName: "California",
  ingredients: ["Wheat flour", "Water", "Sea salt"],
  netWeightValue: "20",
  netWeightUnit: "oz",
  allergens: ["wheat"],
  productionDate: null,
  lotCode: null,
  expirationDate: null,
  handlingInstructions: null,
  sellerStatement: null,
};

describe("disclosure gaps", () => {
  it("drops the unfillable elements from the label rather than printing blanks", () => {
    const out = renderLabel(californiaRule, incomplete);
    expect(out.lines.map((l) => l.element)).toEqual([
      "business_name",
      "product_name",
      "ingredients_desc_by_weight",
      "allergens",
      "net_weight",
    ]);
  });

  it("names every one of them, so the caller can tell a gap from a non-requirement", () => {
    const out = renderLabel(californiaRule, incomplete);
    expect(out.missing.map((m) => m.element).sort()).toEqual([
      "municipality",
      "permit_number",
      "producer_address",
    ]);
  });

  it("treats a seller-written statement as a profile gap, not a print-time one", () => {
    // It lives on seller_profiles now (20260906390000), so the disclosure gap notice surfaces it —
    // which is what Neb. Rev. Stat. 81-2,280(5)(c) needs, since that wants the notification on the
    // producer's website and not only on the package.
    const out = renderLabel(
      { ...californiaRule, requiredElements: ["seller_statement"] },
      incomplete,
    );
    expect(out.missing).toEqual([
      { element: "seller_statement", label: "Statement", fix: "profile" },
    ]);
  });

  it("points each gap at the person who can close it", () => {
    const byElement = new Map(
      renderLabel(californiaRule, incomplete).missing.map((m) => [m.element, m.fix]),
    );
    // Cal. Health & Saf. Code 114365.3(f)(2) wants the permit number in the advertisement, and it
    // comes from a verified licence — not something the seller types on the product.
    expect(byElement.get("permit_number")).toBe("licence");
    expect(byElement.get("municipality")).toBe("profile");
    expect(byElement.get("producer_address")).toBe("profile");
  });

  it("reports nothing once the seller has supplied them", () => {
    const out = renderLabel(californiaRule, {
      ...incomplete,
      producerAddress: "1114 Nueces St, Austin, TX 78701",
      permitNumber: "CA-CFO-4471",
      municipality: "Alameda",
    });
    expect(out.missing).toEqual([]);
  });
});
