/**
 * Display names for `seller_licenses.license_type`. Pure — imported by the seller's upload form,
 * the seller compliance list, and the admin review queue, so the wording lives in one place.
 */

export const LICENSE_TYPES = [
  { value: "id", label: "Government-issued ID" },
  { value: "tax_id", label: "Tax ID" },
  { value: "cottage_food", label: "Cottage food permit" },
  { value: "food_handler", label: "Food handler card" },
  { value: "business_license", label: "Business license" },
  { value: "other", label: "Other" },
] as const;

const BY_VALUE: Record<string, string> = Object.fromEntries(
  LICENSE_TYPES.map((t) => [t.value, t.label]),
);

export function licenseTypeLabel(type: string): string {
  return BY_VALUE[type] ?? type;
}
