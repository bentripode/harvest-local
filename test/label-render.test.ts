import { describe, expect, it } from "vitest";

import { canPrint, renderLabel, type LabelRule, type LabelSource } from "@/lib/labels/render";

/**
 * The label renderer. A cottage-food label is a legal document, so the behaviour that matters most
 * is what it REFUSES to print.
 */

const source: LabelSource = {
  productName: "Sourdough Boule",
  businessName: "Ben's Baked Bread",
  producerName: "Ben's Baked Bread",
  producerAddress: "1114 Nueces St, Austin, TX 78701",
  producerPhone: null,
  producerEmail: null,
  permitNumber: "TX-CF-12345",
  municipality: "Austin",
  ingredients: ["Wheat flour", "Water", "Sourdough culture", "Sea salt"],
  netWeightValue: "24",
  netWeightUnit: "oz",
  allergens: ["wheat"],
  productionDate: "2026-09-04",
  lotCode: "B-2026-09-04",
};

const texas: LabelRule = {
  requiredElements: ["product_name", "producer_address", "business_name", "allergens"],
  disclaimerText:
    "This food is made in a home kitchen and is not inspected by the Department of State Health Services or a local health department.",
  disclaimerMinPt: null,
  disclaimerAllCaps: false,
  disclaimerFontNote: null,
  metricRequired: false,
  placardRequired: false,
  placardText: null,
  notes: null,
};

describe("renderLabel", () => {
  it("emits elements in the order the state's rule lists them", () => {
    const out = renderLabel(texas, source);
    expect(out.lines.map((l) => l.element)).toEqual([
      "product_name",
      "producer_address",
      "business_name",
      "allergens",
    ]);
  });

  it("prints the disclaimer verbatim, never rewritten", () => {
    expect(renderLabel(texas, source).disclaimer).toBe(texas.disclaimerText);
  });

  it("joins ingredients in the seller's order", () => {
    const rule = { ...texas, requiredElements: ["ingredients_desc_by_weight"] };
    expect(renderLabel(rule, source).lines[0].value).toBe(
      "Wheat flour, Water, Sourdough culture, Sea salt",
    );
  });

  it("adds the metric equivalent only where the state asks", () => {
    const rule = { ...texas, requiredElements: ["net_weight"] };
    expect(renderLabel(rule, source).lines[0].value).toBe("24 oz");
    expect(renderLabel({ ...rule, metricRequired: true }, source).lines[0].value).toBe(
      "24 oz (680 g)",
    );
  });

  it("says None for allergens rather than treating absence as missing", () => {
    const rule = { ...texas, requiredElements: ["allergens"] };
    const out = renderLabel(rule, { ...source, allergens: [] });
    expect(out.lines[0].value).toBe("None");
    expect(out.missing).toHaveLength(0);
  });

  // -- what it refuses ------------------------------------------------------
  it("reports a required field the seller hasn't filled in", () => {
    const rule = { ...texas, requiredElements: ["net_weight", "product_name"] };
    const out = renderLabel(rule, { ...source, netWeightValue: null, netWeightUnit: null });
    expect(out.missing.map((m) => m.element)).toEqual(["net_weight"]);
    expect(canPrint(out)).toBe(false);
  });

  it("points at where each missing field is fixed", () => {
    const rule = {
      ...texas,
      requiredElements: ["ingredients_desc_by_weight", "permit_number", "lot_code"],
    };
    const out = renderLabel(rule, {
      ...source,
      ingredients: [],
      permitNumber: null,
      lotCode: null,
    });
    expect(out.missing.map((m) => m.fix).sort()).toEqual(["licence", "print", "product"]);
  });

  it("refuses to print when the state's rule isn't recorded at all", () => {
    const unknown: LabelRule = { ...texas, requiredElements: [], disclaimerText: null };
    const out = renderLabel(unknown, source);
    expect(out.ruleUnknown).toBe(true);
    expect(canPrint(out)).toBe(false);
  });

  it("a state that requires only a disclaimer is printable", () => {
    // North Dakota asks for the statement and nothing else.
    const nd: LabelRule = {
      ...texas,
      requiredElements: [],
      disclaimerText:
        "This product is made in a home kitchen that is not inspected by the state or local health department.",
    };
    const out = renderLabel(nd, source);
    expect(out.ruleUnknown).toBe(false);
    expect(canPrint(out)).toBe(true);
  });

  it("never blocks on nutrition, which depends on a claim we can't detect", () => {
    const rule = { ...texas, requiredElements: ["product_name", "nutrition_if_claimed"] };
    const out = renderLabel(rule, source);
    expect(out.missing).toHaveLength(0);
    expect(canPrint(out)).toBe(true);
  });

  it("ignores an element name it doesn't recognise rather than crashing", () => {
    const rule = { ...texas, requiredElements: ["product_name", "vibes"] };
    const out = renderLabel(rule, source);
    expect(out.lines.map((l) => l.element)).toEqual(["product_name"]);
  });

  it("carries the state's typography rules through", () => {
    const georgia: LabelRule = {
      ...texas,
      disclaimerText: "MADE IN A COTTAGE FOOD OPERATION THAT IS NOT SUBJECT TO STATE FOOD SAFETY INSPECTIONS",
      disclaimerMinPt: 10,
      disclaimerAllCaps: true,
      disclaimerFontNote: "Times New Roman or Arial",
    };
    const out = renderLabel(georgia, source);
    expect(out.disclaimerMinPt).toBe(10);
    expect(out.disclaimerAllCaps).toBe(true);
  });

  it("falls back to the business name when no producer name is set", () => {
    const rule = { ...texas, requiredElements: ["producer_name"] };
    const out = renderLabel(rule, { ...source, producerName: null });
    expect(out.lines[0].value).toBe("Ben's Baked Bread");
  });
});
