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
  | "producer_phone"
  | "producer_email"
  | "permit_number"
  | "municipality"
  | "ingredients_desc_by_weight"
  | "net_weight"
  | "allergens"
  | "production_date"
  | "lot_code"
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
  producerPhone: string | null;
  producerEmail: string | null;
  permitNumber: string | null;
  municipality: string | null;
  ingredients: string[];
  netWeightValue: string | null;
  netWeightUnit: string | null;
  allergens: string[];
  /** Per-batch, entered at print time rather than stored on the product. */
  productionDate: string | null;
  lotCode: string | null;
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
  producer_phone: "Phone number",
  producer_email: "Email address",
  permit_number: "Permit or registration number",
  municipality: "Town or municipality",
  ingredients_desc_by_weight: "Ingredients",
  net_weight: "Net quantity",
  allergens: "Allergens",
  production_date: "Production date",
  lot_code: "Lot or batch code",
  nutrition_if_claimed: "Nutrition information",
  regulator_website: "State information website",
};

const ELEMENT_FIX: Record<LabelElement, MissingField["fix"]> = {
  product_name: "product",
  producer_name: "profile",
  business_name: "profile",
  producer_address: "profile",
  producer_phone: "profile",
  producer_email: "profile",
  permit_number: "licence",
  municipality: "profile",
  ingredients_desc_by_weight: "product",
  net_weight: "product",
  allergens: "product",
  production_date: "print",
  lot_code: "print",
  nutrition_if_claimed: "product",
  // Not the seller's to supply: the state prescribes this address and an admin records it.
  regulator_website: "admin",
};

/** Captions that would be noise on a small label. */
const NO_CAPTION = new Set<LabelElement>(["product_name", "business_name", "producer_name"]);

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
    case "producer_phone":
      return src.producerPhone;
    case "producer_email":
      return src.producerEmail;
    case "permit_number":
      return src.permitNumber;
    case "municipality":
      return src.municipality;
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
