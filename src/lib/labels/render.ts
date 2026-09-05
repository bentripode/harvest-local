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
  | "nutrition_if_claimed";

export interface LabelRule {
  requiredElements: string[];
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
  /** Where the seller fixes it. */
  fix: "product" | "profile" | "licence" | "print";
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
};

/** Captions that would be noise on a small label. */
const NO_CAPTION = new Set<LabelElement>(["product_name", "business_name", "producer_name"]);

function isElement(value: string): value is LabelElement {
  return value in ELEMENT_LABEL;
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

    lines.push({
      element: raw,
      caption: NO_CAPTION.has(raw) ? null : ELEMENT_LABEL[raw],
      value,
    });
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
