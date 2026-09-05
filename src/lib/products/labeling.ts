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

/**
 * What a food listing may not go live without.
 *
 * Ingredients and net weight are the two label facts that live on the PRODUCT — everything else a
 * label needs (producer name, address, permit number, the disclaimer) comes from the seller or the
 * state rule, so a product form cannot be the place to catch them.
 *
 * This is a flat marketplace standard, not a reading of any one statute. `state_label_rules` does
 * record which programs require which elements — 55 of 69 ask for ingredients, 36 for net weight —
 * but every one of those rows is seeded unverified, and gating a seller's listing on an unchecked
 * row is the same mistake as the placeholder revenue caps. Requiring both of every food listing is
 * stricter than some states and wrong in none of them.
 *
 * Non-food listings are untouched: a candle has no ingredient panel.
 */
export function missingLabelFields(input: {
  isFoodCategory: boolean;
  status: string;
  ingredients: string[];
  netWeightValue: string | number | null | undefined;
  netWeightUnit: string | null | undefined;
  allergens?: string[];
  /** True once the seller has explicitly declared "none of the nine". */
  allergensConfirmed?: boolean;
}): string[] {
  // A draft is work in progress and an archived listing is off the storefront — neither is on sale,
  // so neither needs a complete label. This mirrors the online-sales and category gates.
  if (input.status === "draft" || input.status === "archived") return [];
  if (!input.isFoodCategory) return [];

  const missing: string[] = [];
  if (input.ingredients.length === 0) missing.push("ingredients");
  if (!formatNetWeight(input.netWeightValue, input.netWeightUnit)) missing.push("net weight");
  // Ticking an allergen is itself an answer; an empty list is only an answer once it is confirmed.
  if ((input.allergens ?? []).length === 0 && !input.allergensConfirmed) {
    missing.push("allergen answer");
  }
  return missing;
}

/**
 * Ingredient names that suggest an allergen, for the "you listed X but didn't tick Y" nudge.
 *
 * This ADVISES, it never blocks. Ingredient text is free-form English written by a baker, not a
 * controlled vocabulary, so any matcher over it is a heuristic — and a heuristic that blocked would
 * eventually refuse a legitimate listing over a word. A missed allergen is the seller's to catch;
 * this only makes it harder to miss the obvious one.
 *
 * Matched on word boundaries so "buckwheat" is not wheat and "seitan" is not "sesame".
 */
const ALLERGEN_HINTS: { allergen: AllergenValue; terms: string[] }[] = [
  {
    allergen: "milk",
    terms: ["milk", "butter", "buttermilk", "cream", "creme", "cheese", "yoghurt", "yogurt",
      "ghee", "whey", "casein", "custard", "curd", "ricotta", "mascarpone"],
  },
  { allergen: "eggs", terms: ["egg", "eggs", "albumen", "meringue", "mayonnaise", "aioli"] },
  {
    allergen: "fish",
    terms: ["fish", "anchovy", "anchovies", "cod", "salmon", "tuna", "sardine", "sardines",
      "halibut", "tilapia", "worcestershire"],
  },
  {
    allergen: "shellfish",
    terms: ["shrimp", "prawn", "prawns", "crab", "lobster", "crayfish", "langoustine"],
  },
  {
    allergen: "tree_nuts",
    // The FDA counts coconut as a tree nut, which surprises people — so it earns a nudge.
    terms: ["almond", "almonds", "walnut", "walnuts", "pecan", "pecans", "cashew", "cashews",
      "pistachio", "pistachios", "hazelnut", "hazelnuts", "macadamia", "praline", "marzipan",
      "coconut", "chestnut", "chestnuts"],
  },
  { allergen: "peanuts", terms: ["peanut", "peanuts", "groundnut", "groundnuts", "arachis"] },
  {
    allergen: "wheat",
    terms: ["wheat", "semolina", "spelt", "farro", "durum", "bulgur", "seitan", "graham",
      "couscous", "einkorn", "farina"],
  },
  {
    allergen: "soybeans",
    terms: ["soy", "soya", "soybean", "soybeans", "edamame", "tofu", "tempeh", "miso"],
  },
  { allergen: "sesame", terms: ["sesame", "tahini", "benne", "gomashio"] },
];

/** Flours that are not wheat, so a bare "flour" match doesn't cry wolf over almond flour. */
const NON_WHEAT_FLOURS = [
  "almond", "rice", "coconut", "oat", "corn", "chickpea", "garbanzo", "cassava", "tapioca",
  "buckwheat", "millet", "sorghum", "potato", "quinoa", "amaranth", "teff", "rye", "barley",
  "spelt", "gluten-free", "gluten free", "nut", "seed", "banana", "plantain",
];

function hasWord(haystack: string, word: string): boolean {
  // Escape nothing: every term above is plain letters or a hyphen/space.
  return new RegExp(`(^|[^a-z])${word.replace(/[-\s]/g, "[-\\s]")}($|[^a-z])`, "i").test(haystack);
}

export interface AllergenWarning {
  allergen: AllergenValue;
  /** The ingredient line that triggered it, so the seller can see what we read. */
  ingredient: string;
}

/**
 * Ingredients that look like an allergen the seller hasn't ticked.
 *
 * Returns one warning per (allergen, first matching ingredient). An allergen already ticked is
 * never warned about, so acting on a warning makes it go away.
 */
export function allergenWarnings(
  ingredients: string[],
  allergens: string[],
): AllergenWarning[] {
  const ticked = new Set(parseAllergens(allergens));
  const out: AllergenWarning[] = [];

  for (const { allergen, terms } of ALLERGEN_HINTS) {
    if (ticked.has(allergen)) continue;

    for (const ingredient of ingredients) {
      const text = ingredient.toLowerCase();
      let hit = terms.some((t) => hasWord(text, t));

      // "Flour" on its own usually means wheat, but not when it's qualified as something else.
      if (!hit && allergen === "wheat" && hasWord(text, "flour")) {
        hit = !NON_WHEAT_FLOURS.some((f) => hasWord(text, f));
      }

      if (hit) {
        out.push({ allergen, ingredient });
        break;
      }
    }
  }

  return out;
}

/** "Wheat flour" suggests Wheat — the nudge, phrased for the seller. */
export function describeAllergenWarning(w: AllergenWarning): string {
  return `“${w.ingredient}” suggests ${ALLERGEN_LABELS.get(w.allergen)}, which isn’t ticked.`;
}

/** The same rule as a sentence the seller can act on, or null when nothing is missing. */
export function describeMissingLabelFields(missing: string[]): string | null {
  if (missing.length === 0) return null;
  const list =
    missing.length === 1
      ? missing[0]
      : `${missing.slice(0, -1).join(", ")} and ${missing[missing.length - 1]}`;
  return (
    `A food listing needs its ${list} before it can go live — buyers have to see the label ` +
    `information before they pay. Add ${missing.length === 1 ? "it" : "them"} under Label details, ` +
    `or save this as a draft for now.`
  );
}
