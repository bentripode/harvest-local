import { describe, expect, it } from "vitest";

import {
  canPrint,
  parseAlternatives,
  renderLabel,
  type LabelRule,
  type LabelSource,
} from "@/lib/labels/render";

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
  stateName: "Texas",
  ingredients: ["Wheat flour", "Water", "Sourdough culture", "Sea salt"],
  netWeightValue: "24",
  netWeightUnit: "oz",
  allergens: ["wheat"],
  productionDate: "2026-09-04",
  lotCode: "B-2026-09-04",
  expirationDate: "2026-10-04",
  handlingInstructions: "Keep refrigerated. Eat within 3 days of opening.",
  sellerStatement: "Not produced in a licensed or regulated facility.",
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

/**
 * The three things `required_elements` alone could not express, each of which was being worked
 * around with a note asking a human to finish the label by hand.
 */
describe("renderLabel — optional elements, alternatives and state-supplied values", () => {
  // AS 17.20.332 wants the business licence number "if applicable".
  const alaska: LabelRule = {
    ...texas,
    requiredElements: ["producer_name", "producer_address", "producer_phone"],
    optionalElements: ["permit_number"],
  };

  it("prints an optional element when the seller has a value", () => {
    const out = renderLabel(alaska, { ...source, producerPhone: "907-555-0134" });
    expect(out.lines.map((l) => l.element)).toContain("permit_number");
    expect(out.missing).toEqual([]);
    expect(canPrint(out)).toBe(true);
  });

  it("never blocks on an optional element the seller does not have", () => {
    const out = renderLabel(alaska, {
      ...source,
      producerPhone: "907-555-0134",
      permitNumber: null,
    });
    expect(out.lines.map((l) => l.element)).not.toContain("permit_number");
    expect(out.missing).toEqual([]);
    expect(canPrint(out)).toBe(true);
  });

  // Colo. Rev. Stat. 25-4-1614(3)(a)(II): "telephone number or electronic mail address".
  const colorado: LabelRule = {
    ...texas,
    requiredElements: ["product_name", "producer_name"],
    elementAlternatives: [["producer_phone", "producer_email"]],
  };

  it("is satisfied by either member of an alternatives group", () => {
    const withPhone = renderLabel(colorado, { ...source, producerPhone: "303-555-0100" });
    expect(withPhone.missing).toEqual([]);
    expect(withPhone.lines.map((l) => l.element)).toContain("producer_phone");

    const withEmail = renderLabel(colorado, { ...source, producerEmail: "ben@example.com" });
    expect(withEmail.missing).toEqual([]);
    expect(withEmail.lines.map((l) => l.element)).toContain("producer_email");
  });

  it("prints both members when the seller has both — one was the floor, not the ceiling", () => {
    const out = renderLabel(colorado, {
      ...source,
      producerPhone: "303-555-0100",
      producerEmail: "ben@example.com",
    });
    expect(out.lines.map((l) => l.element)).toEqual([
      "product_name",
      "producer_name",
      "producer_phone",
      "producer_email",
    ]);
  });

  it("reports one missing field naming every alternative when the seller has none", () => {
    const out = renderLabel(colorado, source);
    expect(out.missing).toHaveLength(1);
    expect(out.missing[0].label).toBe("Phone number or Email address");
    expect(out.missing[0].fix).toBe("profile");
    expect(canPrint(out)).toBe(false);
  });

  // A.R.S. 36-932(A)(5) / Colo. Rev. Stat. 25-4-1614(3)(a)(VI): an address the STATE supplies.
  const arizona: LabelRule = {
    ...texas,
    requiredElements: ["product_name", "regulator_website"],
  };

  it("prints the state-supplied website from the rule, not from the seller", () => {
    const out = renderLabel(
      { ...arizona, regulatorWebsiteUrl: "https://azhealth.gov/cottagefood" },
      source,
    );
    expect(out.lines.map((l) => l.value)).toContain("https://azhealth.gov/cottagefood");
    expect(canPrint(out)).toBe(true);
  });

  it("refuses to print, and blames an admin, when the state's website is unrecorded", () => {
    const out = renderLabel(arizona, source);
    expect(out.missing).toEqual([
      { element: "regulator_website", label: "State information website", fix: "admin" },
    ]);
    expect(canPrint(out)).toBe(false);
  });

  it("does not print an element twice when a rule lists it both ways", () => {
    const out = renderLabel(
      { ...texas, requiredElements: ["product_name"], optionalElements: ["product_name"] },
      source,
    );
    expect(out.lines).toHaveLength(1);
  });
});

describe("parseAlternatives", () => {
  it("keeps a well-formed group", () => {
    expect(parseAlternatives([["producer_phone", "producer_email"]])).toEqual([
      ["producer_phone", "producer_email"],
    ]);
  });

  it("drops anything that isn't a group of strings rather than trusting the cast", () => {
    expect(parseAlternatives("nonsense")).toEqual([]);
    expect(parseAlternatives(null)).toEqual([]);
    expect(parseAlternatives(["producer_phone"])).toEqual([]);
    expect(parseAlternatives([["producer_phone", 7]])).toEqual([["producer_phone"]]);
    expect(parseAlternatives([[]])).toEqual([]);
  });
});

/**
 * 16 Del. Admin. Code 4458A 8.2.1 asks for `"town/city, Delaware"` — one phrase, not a town.
 */
describe("renderLabel — municipality_state", () => {
  const delaware: LabelRule = {
    ...texas,
    requiredElements: ["business_name", "municipality_state"],
  };

  it("prints the town and the state together", () => {
    const out = renderLabel(delaware, {
      ...source,
      municipality: "Wilmington",
      stateName: "Delaware",
    });
    expect(out.lines[1].value).toBe("Wilmington, Delaware");
  });

  it("is missing unless both halves are known — half the phrase is not the phrase", () => {
    const out = renderLabel(delaware, { ...source, municipality: null });
    expect(out.missing.map((m) => m.element)).toEqual(["municipality_state"]);
  });

  it("leaves the plain municipality element alone — CA and CO want a bare county", () => {
    const out = renderLabel({ ...texas, requiredElements: ["municipality"] }, source);
    expect(out.lines[0].value).toBe("Austin");
  });
});

/**
 * Iowa Code 137D.2(7)(e): "For refrigerated time/temperature control for safety foods, an
 * expiration date based on food safety." Per-batch, so it is asked for at print time.
 */
describe("renderLabel — expiration date", () => {
  const iowa: LabelRule = {
    ...texas,
    requiredElements: ["business_name"],
    optionalElements: ["expiration_date"],
  };

  it("prints a use-by date when the seller supplies one", () => {
    const out = renderLabel(iowa, source);
    expect(out.lines.map((l) => l.element)).toContain("expiration_date");
    expect(out.lines.find((l) => l.element === "expiration_date")?.caption).toBe("Use by");
  });

  it("does not block a shelf-stable label that has none", () => {
    const out = renderLabel(iowa, { ...source, expirationDate: null });
    expect(out.missing).toEqual([]);
    expect(canPrint(out)).toBe(true);
  });
});

/**
 * La. Rev. Stat. 40:4.9(D)(1)(a) requires "a label which clearly indicates that the food was not
 * produced in a licensed or regulated facility" — a fact to convey, not a sentence to reproduce.
 */
describe("renderLabel — seller-written statement", () => {
  const louisiana: LabelRule = {
    ...texas,
    requiredElements: ["seller_statement"],
    disclaimerText: null,
    sellerStatementPrompt: "a label which clearly indicates that the food was not produced in a licensed or regulated facility",
  };

  it("prints the seller's own words, with no caption over them", () => {
    const out = renderLabel(louisiana, source);
    expect(out.lines).toEqual([
      {
        element: "seller_statement",
        caption: null,
        value: "Not produced in a licensed or regulated facility.",
      },
    ]);
    expect(canPrint(out)).toBe(true);
  });

  // fix moved from "print" to "profile" in 20260906390000: the statement is one sentence about the
  // producer, identical on every label, and Nebraska needs it on the website too.
  it("refuses to print until the seller writes one", () => {
    const out = renderLabel(louisiana, { ...source, sellerStatement: null });
    expect(out.missing).toEqual([
      { element: "seller_statement", label: "Statement", fix: "profile" },
    ]);
    expect(canPrint(out)).toBe(false);
  });

  it("is not treated as an unrecorded rule just because there is no disclaimer", () => {
    // Louisiana was one of five states this generator refused to print for. The rule is known now;
    // it simply has no quoted sentence in it.
    expect(renderLabel(louisiana, source).ruleUnknown).toBe(false);
  });
});

/**
 * Idaho Code 37-205(4)(b) and N.D. Cent. Code 23-09.5-02(7): safe storage and preparation
 * instructions. Per-product, and optional because both states ask only for some products.
 */
describe("renderLabel — handling instructions", () => {
  const rule: LabelRule = {
    ...texas,
    requiredElements: ["product_name"],
    optionalElements: ["handling_instructions"],
  };

  it("prints them when the seller has written some", () => {
    const out = renderLabel(rule, source);
    expect(out.lines.map((l) => l.element)).toContain("handling_instructions");
    expect(out.lines.find((l) => l.element === "handling_instructions")?.caption).toBe("Handling");
  });

  it("does not block a shelf-stable label that has none", () => {
    const out = renderLabel(rule, { ...source, handlingInstructions: null });
    expect(out.missing).toEqual([]);
    expect(canPrint(out)).toBe(true);
  });

  it("is the seller's to fix on the product, not at print time", () => {
    // Unlike the production date, this is a fact about the listing rather than the batch.
    const out = renderLabel(
      { ...rule, requiredElements: ["handling_instructions"], optionalElements: [] },
      { ...source, handlingInstructions: null },
    );
    expect(out.missing).toEqual([
      { element: "handling_instructions", label: "Handling", fix: "product" },
    ]);
  });
});
