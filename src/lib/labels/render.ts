/**
 * Turning a product, a seller and a state's rule into a printable label.
 *
 * Pure: the caller loads the rows, this decides what goes on the label, in what order, and — just
 * as important — what is missing. A cottage-food label is a legal document, so a field the state
 * requires and the seller hasn't filled in is a blocker, not something to quietly leave blank.
 *
 * The disclaimer is never generated. It is quoted statute, stored verbatim in
 * `state_label_rules.disclaimer_text`, and printed as-is at the point size the state names.
 */

import { formatAllergens, formatNetWeight } from "@/lib/products/labeling";

/** The vocabulary in `state_label_rules.required_elements`. */
export type LabelElement =
  | "product_name"
  | "producer_name"
  | "business_name"
  | "producer_address"
  /** A SECOND address, where a state wants the post separately from the production site (SD). */
  | "mailing_address"
  | "producer_phone"
  | "producer_email"
  | "producer_id_number"
  | "permit_number"
  | "municipality"
  /** The town AND the state as one phrase, which Delaware requires: "town/city, Delaware". */
  | "municipality_state"
  /**
   * The county whose enforcement agency issued the registration — NOT where the seller lives.
   *
   * Cal. Health & Saf. Code 114365.3(e)(4) pairs it with the number: "the registration or permit
   * number ... and the name of the county of the local enforcement agency that issued the permit or
   * registration number", and (f)(1) puts "the county of approval" in any internet advertising. A
   * registration is valid statewide (114365(a)(4)), so the issuing county and the seller's town are
   * routinely different places, and `municipality` cannot stand in for it.
   */
  | "county_of_approval"
  | "ingredients_desc_by_weight"
  | "net_weight"
  | "allergens"
  | "production_date"
  | "lot_code"
  /** Per-batch like the two above. Iowa asks for one on refrigerated TCS food. */
  | "expiration_date"
  /**
   * Per-product prose. Idaho wants it on perishable food, North Dakota on anything needing
   * refrigeration; both ask only of some products, so it is never a required element.
   */
  | "handling_instructions"
  /**
   * A statement the SELLER writes. Louisiana prescribes what the label must convey and not how to
   * word it, so there is no quoted text to store — see `seller_statement_prompt` on the rule.
   */
  | "seller_statement"
  | "nutrition_if_claimed"
  /** An address the STATE supplies for the producer to print (AZ, CO). Comes from the rule. */
  | "regulator_website";

export interface LabelRule {
  requiredElements: string[];
  /**
   * Printed when a value exists, never blocking when it does not — the "if applicable" case.
   * Alaska wants a business licence number only from producers who have one.
   */
  optionalElements?: string[];
  /**
   * Groups where at least one member is required. Colorado wants a telephone number OR an email
   * address, so demanding both would block a producer with one and demanding one would drop the
   * other off the label.
   */
  elementAlternatives?: string[][];
  /** The address this state prescribes, where it prescribes one. Null until an admin records it. */
  regulatorWebsiteUrl?: string | null;
  /**
   * What a seller-written statement must convey, in the state's own words. Present exactly when
   * `seller_statement` is one of the elements; shown on the print form beside the input.
   */
  sellerStatementPrompt?: string | null;
  disclaimerText: string | null;
  disclaimerMinPt: number | null;
  disclaimerAllCaps: boolean;
  disclaimerFontNote: string | null;
  metricRequired: boolean;
  placardRequired: boolean;
  placardText: string | null;
  notes: string | null;
}

export interface LabelSource {
  productName: string;
  businessName: string;
  producerName: string | null;
  producerAddress: string | null;
  /** The producer's postal address, where a state asks for it beside the production address. */
  mailingAddress: string | null;
  producerPhone: string | null;
  producerEmail: string | null;
  /**
   * A registration number the seller's own state issues so a producer need not publish their home
   * address — Tex. Health & Safety Code 437.0193(b-1) and the Arkansas and Oregon equivalents.
   * Deliberately not `permitNumber`: nobody here verifies it, because the state issued it, and a
   * cottage food operation has no licence for `permitNumber` to come from.
   */
  producerIdNumber: string | null;
  permitNumber: string | null;
  /**
   * The county of the enforcement agency that issued the registration, read off the same verified
   * licence row as `permitNumber` — California ties the two together in 114365.3(e)(4), so pairing
   * one registration's number with another's county would be worse than printing neither.
   */
  countyOfApproval: string | null;
  municipality: string | null;
  /** The producer's state, spelled out. Only used where a state asks for it beside the town. */
  stateName: string | null;
  ingredients: string[];
  netWeightValue: string | null;
  netWeightUnit: string | null;
  allergens: string[];
  /** Per-batch, entered at print time rather than stored on the product. */
  productionDate: string | null;
  lotCode: string | null;
  expirationDate: string | null;
  /** Written per product: a cheesecake and a jar of dried herbs need different words. */
  handlingInstructions: string | null;
  /** Written by the seller at print time, to satisfy a substance-only requirement. */
  sellerStatement: string | null;
}

export interface LabelLine {
  element: LabelElement;
  /** The caption printed above the value, or null where the value speaks for itself. */
  caption: string | null;
  value: string;
}

export interface MissingField {
  element: LabelElement;
  label: string;
  /**
   * Where it gets fixed. `admin` means the STATE'S RULE is incomplete in our data rather than the
   * seller's product being incomplete — nothing the seller does will resolve it.
   */
  fix: "product" | "profile" | "licence" | "print" | "admin";
}

export interface RenderedLabel {
  lines: LabelLine[];
  disclaimer: string | null;
  disclaimerMinPt: number | null;
  disclaimerAllCaps: boolean;
  missing: MissingField[];
  /** True when the state's rule itself isn't recorded — refuse to print rather than guess. */
  ruleUnknown: boolean;
  notes: string | null;
}

const ELEMENT_LABEL: Record<LabelElement, string> = {
  product_name: "Product name",
  producer_name: "Producer name",
  business_name: "Business name",
  producer_address: "Address where the food was made",
  mailing_address: "Mailing address",
  producer_phone: "Phone number",
  producer_email: "Email address",
  producer_id_number: "State identification number",
  permit_number: "Permit or registration number",
  municipality: "Town or municipality",
  municipality_state: "Town or city and state",
  county_of_approval: "County of approval",
  ingredients_desc_by_weight: "Ingredients",
  net_weight: "Net quantity",
  allergens: "Allergens",
  production_date: "Production date",
  lot_code: "Lot or batch code",
  expiration_date: "Use by",
  handling_instructions: "Handling",
  seller_statement: "Statement",
  nutrition_if_claimed: "Nutrition information",
  regulator_website: "State information website",
};

const ELEMENT_FIX: Record<LabelElement, MissingField["fix"]> = {
  product_name: "product",
  producer_name: "profile",
  business_name: "profile",
  producer_address: "profile",
  mailing_address: "profile",
  producer_phone: "profile",
  producer_email: "profile",
  producer_id_number: "profile",
  permit_number: "licence",
  municipality: "profile",
  municipality_state: "profile",
  // Off the registration, not the profile: it is the county that ISSUED the number.
  county_of_approval: "licence",
  ingredients_desc_by_weight: "product",
  net_weight: "product",
  allergens: "product",
  production_date: "print",
  lot_code: "print",
  expiration_date: "print",
  handling_instructions: "product",
  // Lives on the seller profile now (20260906390000), so the label sheet pre-fills it and the
  // storefront listing can carry it — Neb. Rev. Stat. 81-2,280(5)(c) needs it on the website.
  seller_statement: "profile",
  nutrition_if_claimed: "product",
  // Not the seller's to supply: the state prescribes this address and an admin records it.
  regulator_website: "admin",
};

/** Captions that would be noise on a small label. */
const NO_CAPTION = new Set<LabelElement>([
  "product_name",
  "business_name",
  "producer_name",
  // A statement is printed as written, the way the disclaimer is; a caption above it reads as noise.
  "seller_statement",
]);

function isElement(value: string): value is LabelElement {
  return value in ELEMENT_LABEL;
}

/**
 * `state_label_rules.element_alternatives` arrives from PostgREST as unshaped JSON. A CHECK
 * constrains it to an array of arrays, but the type system doesn't know that, and a label is not
 * the place to trust a cast — anything that isn't a group of strings is dropped rather than thrown.
 */
export function parseAlternatives(value: unknown): string[][] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((g): g is unknown[] => Array.isArray(g))
    .map((g) => g.filter((m): m is string => typeof m === "string"))
    .filter((g) => g.length > 0);
}

function valueFor(element: LabelElement, src: LabelSource, rule: LabelRule): string | null {
  switch (element) {
    case "product_name":
      return src.productName || null;
    case "business_name":
      return src.businessName || null;
    case "producer_name":
      return src.producerName || src.businessName || null;
    case "producer_address":
      return src.producerAddress;
    case "mailing_address":
      return src.mailingAddress;
    case "producer_phone":
      return src.producerPhone;
    case "producer_email":
      return src.producerEmail;
    case "producer_id_number":
      return src.producerIdNumber;
    case "permit_number":
      return src.permitNumber;
    case "municipality":
      return src.municipality;
    case "county_of_approval":
      return src.countyOfApproval;
    case "municipality_state":
      // 16 Del. Admin. Code 4458A 8.2.1 asks for `"town/city, Delaware"` as one phrase, not for a
      // town in isolation. Both halves are needed or the element is missing.
      return src.municipality && src.stateName ? `${src.municipality}, ${src.stateName}` : null;
    case "ingredients_desc_by_weight":
      return src.ingredients.length > 0 ? src.ingredients.join(", ") : null;
    case "net_weight":
      return formatNetWeight(src.netWeightValue, src.netWeightUnit, {
        metric: rule.metricRequired,
      });
    case "allergens":
      // No allergens present is a legitimate answer, not a missing field — say so on the label.
      return formatAllergens(src.allergens) ?? "None";
    case "production_date":
      return src.productionDate;
    case "lot_code":
      return src.lotCode;
    case "expiration_date":
      return src.expirationDate;
    case "handling_instructions":
      return src.handlingInstructions;
    case "seller_statement":
      return src.sellerStatement;
    case "nutrition_if_claimed":
      // Only required when the seller makes a nutritional claim, which we can't detect for them.
      return null;
    case "regulator_website":
      // Supplied by the state, not the seller. Null means an admin hasn't recorded it yet, and the
      // label is genuinely unprintable until they do.
      return rule.regulatorWebsiteUrl ?? null;
  }
}

/**
 * Build the label. Elements are emitted in the order the state's rule lists them, because that is
 * the order the rule was written in and some states care about prominence.
 */
export function renderLabel(rule: LabelRule, src: LabelSource): RenderedLabel {
  const ruleUnknown = rule.requiredElements.length === 0 && !rule.disclaimerText;

  const lines: LabelLine[] = [];
  const missing: MissingField[] = [];

  const emit = (element: LabelElement, value: string) => {
    if (lines.some((l) => l.element === element)) return;
    lines.push({
      element,
      caption: NO_CAPTION.has(element) ? null : ELEMENT_LABEL[element],
      value,
    });
  };

  for (const raw of rule.requiredElements) {
    if (!isElement(raw)) continue;
    const value = valueFor(raw, src, rule);

    if (value == null || value === "") {
      // Nutrition is conditional on a claim the seller makes; never block a label on it.
      if (raw !== "nutrition_if_claimed") {
        missing.push({ element: raw, label: ELEMENT_LABEL[raw], fix: ELEMENT_FIX[raw] });
      }
      continue;
    }

    emit(raw, value);
  }

  // "At least one of these." Missing only when every member of the group is empty — so Colorado's
  // "telephone number or electronic mail address" is satisfied by either and blocked by neither.
  for (const group of rule.elementAlternatives ?? []) {
    const members = group.filter(isElement);
    if (members.length === 0) continue;

    const present = members
      .map((element) => ({ element, value: valueFor(element, src, rule) }))
      .filter((m) => m.value != null && m.value !== "");

    if (present.length === 0) {
      // Report the first member, so the seller is pointed at one concrete field to fill.
      const [first] = members;
      missing.push({
        element: first,
        label: members.map((m) => ELEMENT_LABEL[m]).join(" or "),
        fix: ELEMENT_FIX[first],
      });
      continue;
    }

    // Print every member the seller does have; the state asked for one, more is not a defect.
    for (const m of present) emit(m.element, m.value!);
  }

  // "If applicable." Printed when there is something to print, never a blocker.
  for (const raw of rule.optionalElements ?? []) {
    if (!isElement(raw)) continue;
    const value = valueFor(raw, src, rule);
    if (value != null && value !== "") emit(raw, value);
  }

  return {
    lines,
    disclaimer: rule.disclaimerText,
    disclaimerMinPt: rule.disclaimerMinPt,
    disclaimerAllCaps: rule.disclaimerAllCaps,
    missing,
    ruleUnknown,
    notes: rule.notes,
  };
}

/** Whether this label is safe to print: the rule is known and nothing required is absent. */
export function canPrint(rendered: RenderedLabel): boolean {
  return !rendered.ruleUnknown && rendered.missing.length === 0;
}

/** Where a seller goes to close each kind of gap. */
const FIX_LABEL: Record<MissingField["fix"], string> = {
  product: "on this form",
  profile: "on your settings page",
  licence: "on your verified licence or registration",
  print: "at print time",
  admin: "by an administrator",
};

/**
 * The gaps that stop a LISTING going live, phrased for the seller.
 *
 * Per-batch elements are dropped: a production date is a fact about a jar, so no listing can carry
 * one and naming it would be an instruction the seller cannot follow. Everything else is named with
 * the place it gets fixed, because "incomplete" without an address is just a locked door.
 */
export function describeListingGaps(missing: MissingField[]): string | null {
  const actionable = missing.filter((m) => m.fix !== "print");
  if (actionable.length === 0) return null;
  return actionable.map((m) => `${m.label} (${FIX_LABEL[m.fix]})`).join("; ");
}
