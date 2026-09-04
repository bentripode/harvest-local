/**
 * The product data a compliant cottage-food label needs, and the rules for shaping it.
 *
 * Nearly every state requires the same three things a product row could not previously express:
 * the ingredients **in descending order of predominance by weight**, the **net weight or volume**,
 * and the **major allergens**. A free-text description cannot produce any of them, which is why
 * these are structured fields rather than prose.
 *
 * Pure — shared by the product form, the product actions and (later) the label generator.
 */

/**
 * The nine major allergens under US federal labelling law. Sesame joined the list under the FASTER
 * Act in 2023, and several states name this set explicitly in their own labelling rules.
 */
export const MAJOR_ALLERGENS = [
  { value: "milk", label: "Milk" },
  { value: "eggs", label: "Eggs" },
  { value: "fish", label: "Fish" },
  { value: "shellfish", label: "Crustacean shellfish" },
  { value: "tree_nuts", label: "Tree nuts" },
  { value: "peanuts", label: "Peanuts" },
  { value: "wheat", label: "Wheat" },
  { value: "soybeans", label: "Soybeans" },
  { value: "sesame", label: "Sesame" },
] as const;

export type AllergenValue = (typeof MAJOR_ALLERGENS)[number]["value"];

const ALLERGEN_VALUES = new Set<string>(MAJOR_ALLERGENS.map((a) => a.value));
const ALLERGEN_LABELS = new Map<string, string>(MAJOR_ALLERGENS.map((a) => [a.value, a.label]));

export function isAllergenValue(value: string): value is AllergenValue {
  return ALLERGEN_VALUES.has(value);
}

/** Keeps only known allergens, deduped, in the canonical order the labels are read in. */
export function parseAllergens(values: string[]): AllergenValue[] {
  const chosen = new Set(values.filter(isAllergenValue));
  return MAJOR_ALLERGENS.map((a) => a.value).filter((v) => chosen.has(v));
}

/** "Contains: Milk, Wheat" — the phrasing most state rules and the FDA use. */
export function formatAllergens(values: string[]): string | null {
  const list = parseAllergens(values).map((v) => ALLERGEN_LABELS.get(v)!);
  return list.length > 0 ? list.join(", ") : null;
}

// ---------------------------------------------------------------------------
// Ingredients
// ---------------------------------------------------------------------------

export const MAX_INGREDIENTS = 60;
export const MAX_INGREDIENT_LEN = 120;

/**
 * A textarea → an ordered ingredient list. One per line, or comma-separated on a single line for
 * someone who pastes an existing list.
 *
 * Order is preserved and meaningful: states require descending order of predominance by weight, so
 * the seller's order IS the label's order. Deduped case-insensitively; nothing is re-sorted.
 */
export function parseIngredients(raw: string): string[] {
  const lines = raw.includes("\n") ? raw.split(/\r?\n/) : raw.split(",");
  const seen = new Set<string>();
  const out: string[] = [];

  for (const line of lines) {
    const ingredient = line.trim().replace(/\s+/g, " ").slice(0, MAX_INGREDIENT_LEN);
    if (!ingredient) continue;
    const key = ingredient.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ingredient);
    if (out.length >= MAX_INGREDIENTS) break;
  }
  return out;
}

/** Back to a textarea, one per line, so an edit round-trips without reordering. */
export function ingredientsToText(ingredients: string[]): string {
  return ingredients.join("\n");
}

// ---------------------------------------------------------------------------
// Net weight
// ---------------------------------------------------------------------------

export const NET_WEIGHT_UNITS = [
  { value: "oz", label: "ounces (oz)", metric: { factor: 28.349523125, unit: "g" } },
  { value: "lb", label: "pounds (lb)", metric: { factor: 453.59237, unit: "g" } },
  { value: "g", label: "grams (g)", metric: null },
  { value: "kg", label: "kilograms (kg)", metric: null },
  { value: "fl_oz", label: "fluid ounces (fl oz)", metric: { factor: 29.5735295625, unit: "mL" } },
  { value: "ml", label: "millilitres (mL)", metric: null },
  { value: "count", label: "count (items per package)", metric: null },
] as const;

export type NetWeightUnit = (typeof NET_WEIGHT_UNITS)[number]["value"];

const UNIT_BY_VALUE = new Map(NET_WEIGHT_UNITS.map((u) => [u.value, u]));

export function isNetWeightUnit(value: string): value is NetWeightUnit {
  return UNIT_BY_VALUE.has(value as NetWeightUnit);
}

/** How the unit is written on a label — short form, not the dropdown's wording. */
const DISPLAY_UNIT: Record<NetWeightUnit, string> = {
  oz: "oz",
  lb: "lb",
  g: "g",
  kg: "kg",
  fl_oz: "fl oz",
  ml: "mL",
  count: "ct",
};

/**
 * "24 oz (680 g)".
 *
 * North Carolina, Tennessee and Connecticut require both imperial and metric on the label, so the
 * metric equivalent is derived rather than asked for — one less thing to get wrong, and one less
 * field on the form. Pass `metric: false` where a state doesn't ask for it.
 */
export function formatNetWeight(
  value: number | string | null | undefined,
  unit: string | null | undefined,
  opts: { metric?: boolean } = {},
): string | null {
  if (value == null || value === "" || !unit || !isNetWeightUnit(unit)) return null;

  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const spec = UNIT_BY_VALUE.get(unit)!;
  const primary = `${trimNumber(amount)} ${DISPLAY_UNIT[unit]}`;

  if (opts.metric === false || !spec.metric) return primary;

  const converted = amount * spec.metric.factor;
  // Whole numbers past 10 g/mL; anything smaller keeps a decimal so it isn't rounded to nothing.
  const rounded = converted >= 10 ? Math.round(converted) : Math.round(converted * 10) / 10;
  return `${primary} (${trimNumber(rounded)} ${spec.metric.unit})`;
}

function trimNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
}
