import { describe, expect, it } from "vitest";

import {
  canPrint,
  describeListingGaps,
  parseAlternatives,
  parseSubstitutions,
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
  mailingAddress: "PO Box 44, Austin, TX 78767",
  producerPhone: null,
  producerEmail: null,
  producerIdNumber: null,
  permitNumber: "TX-CF-12345",
  countyOfApproval: null,
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

/**
 * S.D. Codified Laws 34-18-37 lists "(3) Physical address of production" and "(4) Mailing address
 * of the producer" as separate items, so the label needs both.
 */
describe("renderLabel — mailing address", () => {
  const southDakota: LabelRule = {
    ...texas,
    requiredElements: ["producer_address", "mailing_address"],
  };

  it("prints both addresses, distinctly captioned", () => {
    const out = renderLabel(southDakota, source);
    expect(out.lines.map((l) => [l.element, l.caption])).toEqual([
      ["producer_address", "Address where the food was made"],
      ["mailing_address", "Mailing address"],
    ]);
  });

  it("reports a missing mailing address against the seller's profile", () => {
    const out = renderLabel(southDakota, { ...source, mailingAddress: null });
    expect(out.missing).toEqual([
      { element: "mailing_address", label: "Mailing address", fix: "profile" },
    ]);
  });
});

/**
 * Tennessee, the state that made the phone number a real gap rather than a theoretical one.
 *
 * Tenn. Code 53-1-118(b)(4) is the whole of what the chapter asks for, and (b)(5)(A)(iv) puts it on
 * "the webpage on which the homemade food item is offered for sale" — so a missing telephone number
 * is not just an unprintable label, it is a listing that does not carry what the statute requires.
 */
describe("renderLabel — Tennessee", () => {
  const tennessee: LabelRule = {
    ...texas,
    requiredElements: [
      "product_name",
      "producer_name",
      "producer_address",
      "producer_phone",
      "ingredients_desc_by_weight",
    ],
    optionalElements: [],
    elementAlternatives: [],
    disclaimerText:
      "This product was produced at a private residence that is exempt from state licensing and inspection. This product may contain allergens.",
    disclaimerAllCaps: false,
    metricRequired: false,
  };

  it("will not print without the telephone number the statute names", () => {
    const out = renderLabel(tennessee, source);
    expect(out.missing.map((m) => m.element)).toEqual(["producer_phone"]);
    // The seller fixes it on their settings page, not on the product and not at print time.
    expect(out.missing[0].fix).toBe("profile");
    expect(canPrint(out)).toBe(false);
  });

  it("prints the five elements and the statutory sentence once a number is set", () => {
    const out = renderLabel(tennessee, { ...source, producerPhone: "(615) 555-0134" });
    expect(out.missing).toEqual([]);
    expect(canPrint(out)).toBe(true);
    expect(out.lines.map((l) => l.element)).toEqual([
      "product_name",
      "producer_name",
      "producer_address",
      "producer_phone",
      "ingredients_desc_by_weight",
    ]);
    // No net weight: 53-1-118(a) exempts homemade food from state packaging and labelling law, and
    // (b)(4) asks for no weight statement — so no metric equivalent either.
    expect(out.lines.map((l) => l.element)).not.toContain("net_weight");
    expect(out.disclaimer).toBe(
      "This product was produced at a private residence that is exempt from state licensing and inspection. This product may contain allergens.",
    );
    expect(out.disclaimerAllCaps).toBe(false);
  });
});

/**
 * `nutrition_if_claimed` never blocks a label, from either list.
 *
 * It always resolves to null — a panel needs per-serving figures nothing here collects — so the
 * renderer carries an explicit exception that keeps it out of `missing` even when a rule lists it
 * as required. Fourteen rules across ten states did, and 20260906540000 moved them all to
 * `optional_elements` so the data says what the code does. The exception below stays as a guard
 * against a rule re-adding it through /admin, and this pair pins both halves.
 */
describe("renderLabel — nutrition is never a blocker", () => {
  const withNutritionRequired: LabelRule = {
    ...texas,
    requiredElements: ["product_name", "nutrition_if_claimed"],
  };

  it("does not block even when a rule wrongly lists it as required", () => {
    const out = renderLabel(withNutritionRequired, source);
    expect(out.missing).toEqual([]);
    expect(canPrint(out)).toBe(true);
  });

  it("blocks nothing once it is optional", () => {
    const out = renderLabel(
      { ...texas, requiredElements: ["product_name"], optionalElements: ["nutrition_if_claimed"] },
      source,
    );
    expect(out.missing).toEqual([]);
    // Nothing to print either — there is no value to print — but the label is printable.
    expect(out.lines.map((l) => l.element)).not.toContain("nutrition_if_claimed");
    expect(canPrint(out)).toBe(true);
  });
});

/**
 * Utah's cottage food label, from Utah Admin. Code R70-560-6(2). The statute delegates the whole
 * thing, so this list lives in the rule rather than the code.
 */
describe("renderLabel — Utah cottage food", () => {
  const utah: LabelRule = {
    ...texas,
    requiredElements: [
      "product_name",
      "ingredients_desc_by_weight",
      "allergens",
      "net_weight",
      "business_name",
      "producer_address",
      "producer_phone",
    ],
    optionalElements: ["nutrition_if_claimed"],
    elementAlternatives: [],
    disclaimerText: "Home Produced",
    disclaimerMinPt: 12,
    disclaimerAllCaps: false,
    metricRequired: false,
  };

  it("prints once the seller has a phone number, and is not blocked by nutrition", () => {
    const out = renderLabel(utah, { ...source, producerPhone: "801-555-0142" });
    expect(out.missing).toEqual([]);
    expect(canPrint(out)).toBe(true);
    expect(out.disclaimer).toBe("Home Produced");
    expect(out.disclaimerMinPt).toBe(12);
  });
});

/**
 * The listing gate's message.
 *
 * In a predisclosure state a listing may not go live short of what the buyer must be shown, so the
 * refusal has to name each gap AND where it gets closed — "incomplete" without an address is just a
 * locked door. Per-batch elements are dropped because no listing can ever carry one.
 */
describe("describeListingGaps", () => {
  it("names each gap and where the seller fixes it", () => {
    const out = renderLabel(
      { ...texas, requiredElements: ["producer_phone", "permit_number", "ingredients_desc_by_weight"] },
      { ...source, producerPhone: null, permitNumber: null, ingredients: [] },
    );
    const text = describeListingGaps(out.missing);
    expect(text).toContain("Phone number (on your settings page)");
    expect(text).toContain("Permit or registration number (on your verified licence or registration)");
    expect(text).toContain("Ingredients (on this form)");
  });

  it("says nothing when the only gaps are per-batch", () => {
    const out = renderLabel(
      { ...texas, requiredElements: ["production_date", "lot_code"] },
      { ...source, productionDate: null, lotCode: null },
    );
    expect(out.missing).toHaveLength(2);
    // Both are fix: "print" — a listing cannot carry either, so neither blocks publication.
    expect(describeListingGaps(out.missing)).toBeNull();
  });

  it("is null when nothing is missing", () => {
    expect(describeListingGaps([])).toBeNull();
  });
});

/**
 * The number a seller prints instead of their home address.
 *
 * Four states offer one so a home-based producer need not publish where they live. Texas and Oregon
 * had it modelled as `permit_number`, which resolves only from an admin-verified licence — and a
 * cottage food operation has none, so the either/or collapsed to "publish your address". That is the
 * regression this element exists to prevent.
 */
describe("renderLabel — the state identification number", () => {
  const texasWithIdNumber: LabelRule = {
    ...texas,
    requiredElements: ["product_name"],
    elementAlternatives: [["producer_address", "producer_id_number"]],
  };

  it("satisfies the address requirement on its own", () => {
    const out = renderLabel(texasWithIdNumber, {
      ...source,
      producerAddress: null,
      producerIdNumber: "TX-99887",
    });
    expect(out.missing).toEqual([]);
    expect(canPrint(out)).toBe(true);
    const idLine = out.lines.find((l) => l.element === "producer_id_number");
    expect(idLine?.value).toBe("TX-99887");
    expect(out.lines.map((l) => l.element)).not.toContain("producer_address");
  });

  it("still blocks when the seller has neither", () => {
    const out = renderLabel(texasWithIdNumber, {
      ...source,
      producerAddress: null,
      producerIdNumber: null,
    });
    expect(out.missing.map((m) => m.label)).toContain(
      "Address where the food was made or State identification number",
    );
    expect(canPrint(out)).toBe(false);
  });

  it("is fixed on the settings page, not by an admin — the state issued it", () => {
    const out = renderLabel(texasWithIdNumber, {
      ...source,
      producerAddress: null,
      producerIdNumber: null,
    });
    expect(out.missing[0].fix).toBe("profile");
  });
});

/**
 * California's county of approval.
 *
 * Cal. Health & Saf. Code 114365.3(e)(4) requires the number "and the name of the county of the
 * local enforcement agency that issued" it; (f)(1) puts "the county of approval" in any internet
 * advertising. It is a property of the REGISTRATION, and 114365(a)(4) is why it cannot be inferred
 * from where the seller lives: "A registration or permit from one county shall be sufficient for a
 * cottage food operation to operate throughout the state."
 */
describe("county of approval", () => {
  const california: LabelRule = {
    requiredElements: ["county_of_approval", "permit_number"],
    optionalElements: [],
    elementAlternatives: [],
    regulatorWebsiteUrl: null,
    sellerStatementPrompt: null,
    disclaimerText: "Made in a Home Kitchen.",
    disclaimerMinPt: 12,
    disclaimerAllCaps: false,
    disclaimerFontNote: null,
    metricRequired: false,
    placardRequired: false,
    placardText: null,
    notes: null,
  };

  it("prints the county under its own caption", () => {
    const out = renderLabel(california, {
      ...source,
      countyOfApproval: "Alameda",
      permitNumber: "CFO-2026-118",
    });
    const line = out.lines.find((l) => l.element === "county_of_approval");
    expect(line?.caption).toBe("County of approval");
    expect(line?.value).toBe("Alameda");
    expect(canPrint(out)).toBe(true);
  });

  /** The whole point of the element: the seller's town is a different fact and must not stand in. */
  it("does not fall back to the seller's town", () => {
    const out = renderLabel(california, {
      ...source,
      countyOfApproval: null,
      municipality: "Oakland",
      permitNumber: "CFO-2026-118",
    });
    expect(out.lines.some((l) => l.value === "Oakland")).toBe(false);
    expect(out.missing.map((m) => m.label)).toContain("County of approval");
    expect(canPrint(out)).toBe(false);
  });

  /** It comes off the registration, so that is where the seller is sent to fix it. */
  it("is fixed on the licence, not the profile", () => {
    const out = renderLabel(california, {
      ...source,
      countyOfApproval: null,
      permitNumber: null,
    });
    expect(out.missing.every((m) => m.fix === "licence")).toBe(true);
  });
});

/**
 * A number that stands in FOR other elements, rather than beside them.
 *
 * Okla. Stat. tit. 2 5-4.3(C): a producer paying $15 a year gets a registration number that "may be
 * used on product labels instead of the producer's name, phone number, and the physical address of
 * the location where the homemade food product was produced."
 *
 * An alternatives group cannot say this. A group is "at least one of these" and prints every member
 * the seller has — right for Colorado's phone-or-email, wrong here, because the producer bought the
 * number precisely to keep the other three off the label.
 */
describe("renderLabel — element substitutions", () => {
  const oklahoma: LabelRule = {
    ...texas,
    requiredElements: [
      "producer_name",
      "producer_phone",
      "producer_address",
      "product_name",
      "ingredients_desc_by_weight",
    ],
    elementSubstitutions: [
      {
        substitute: "producer_id_number",
        replaces: ["producer_name", "producer_phone", "producer_address"],
      },
    ],
  };

  const withNumber: LabelSource = {
    ...source,
    producerName: "Dale Whitfield",
    producerPhone: "405-555-0117",
    producerAddress: "88 Prairie Rd, Enid, OK 73701",
    producerIdNumber: "OK-HF-4417",
  };

  it("drops all three replaced elements when the seller has the number", () => {
    const out = renderLabel(oklahoma, withNumber);
    const elements = out.lines.map((l) => l.element);
    expect(elements).not.toContain("producer_name");
    expect(elements).not.toContain("producer_phone");
    expect(elements).not.toContain("producer_address");
    expect(elements).toContain("producer_id_number");
    expect(canPrint(out)).toBe(true);
  });

  /** None of the replaced values may survive anywhere in the rendered output. */
  it("publishes none of the replaced values", () => {
    const printed = renderLabel(oklahoma, withNumber)
      .lines.map((l) => l.value)
      .join(" | ");
    expect(printed).not.toContain("Dale Whitfield");
    expect(printed).not.toContain("405-555-0117");
    expect(printed).not.toContain("Prairie Rd");
    expect(printed).toContain("OK-HF-4417");
  });

  /**
   * Three elements collapse to one line, in the position the first of them held — so the label keeps
   * the order the statute lists things in rather than moving the number to the end.
   */
  it("prints the number once, where the first replaced element was", () => {
    const out = renderLabel(oklahoma, withNumber);
    expect(out.lines.map((l) => l.element)).toEqual([
      "producer_id_number",
      "product_name",
      "ingredients_desc_by_weight",
    ]);
  });

  /** Without the number nothing changes: the producer still owes their name, phone and address. */
  it("leaves every element required when the seller has no number", () => {
    const out = renderLabel(oklahoma, { ...withNumber, producerIdNumber: null });
    expect(out.lines.map((l) => l.element)).toEqual([
      "producer_name",
      "producer_phone",
      "producer_address",
      "product_name",
      "ingredients_desc_by_weight",
    ]);
    expect(canPrint(out)).toBe(true);
  });

  it("still blocks on a replaced element the seller has neither of", () => {
    const out = renderLabel(oklahoma, {
      ...withNumber,
      producerIdNumber: null,
      producerAddress: null,
    });
    expect(out.missing.map((m) => m.element)).toContain("producer_address");
    expect(canPrint(out)).toBe(false);
  });

  /**
   * An empty registration number is not a registration number — a blank string must not silently
   * strip the address off a label.
   */
  it("treats a blank number as no number at all", () => {
    const out = renderLabel(oklahoma, { ...withNumber, producerIdNumber: "" });
    expect(out.lines.map((l) => l.element)).toContain("producer_address");
    expect(out.lines.map((l) => l.element)).not.toContain("producer_id_number");
  });
});

describe("parseSubstitutions", () => {
  it("reads the stored shape", () => {
    expect(
      parseSubstitutions([{ substitute: "producer_id_number", replaces: ["producer_address"] }]),
    ).toEqual([{ substitute: "producer_id_number", replaces: ["producer_address"] }]);
  });

  /** Half a substitution would put an address back on a label, so a malformed entry is dropped. */
  it("discards entries missing either half", () => {
    expect(parseSubstitutions([{ substitute: "producer_id_number" }])).toEqual([]);
    expect(parseSubstitutions([{ replaces: ["producer_address"] }])).toEqual([]);
    expect(parseSubstitutions([{ substitute: "", replaces: ["producer_address"] }])).toEqual([]);
    expect(parseSubstitutions("nonsense")).toEqual([]);
    expect(parseSubstitutions(null)).toEqual([]);
  });
});
