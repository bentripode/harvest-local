import { CLAIM_INSTRUCTIONS } from "@/lib/ai/claims";
import { formatAllergens, formatNetWeight } from "@/lib/products/labeling";

/**
 * Building the prompt — pure, so what the model is told is inspectable and testable.
 *
 * The governing idea is GROUNDING: the model is given the seller's own entered facts and nothing
 * else, and is told in as many words that those facts are all it may use. A model asked to "write a
 * description of a sourdough loaf" will happily produce a 48-hour cold ferment and a heritage
 * starter, because that is what sourdough copy sounds like. A model given "title: Sourdough loaf;
 * ingredients: flour, water, salt, starter; 24 oz" has much less room to invent, and what it does
 * invent, `screenCopy` catches.
 *
 * The seller's own words matter more than ours, so anything they have already written — a existing
 * description, their storefront bio — goes in as voice to match rather than text to replace.
 */

export type CopyKind = "description" | "social";

export interface CopySource {
  title: string;
  categoryName: string | null;
  /** What the seller has already written, if anything. Used as voice, not as filler. */
  existingDescription: string | null;
  ingredients: string[];
  allergens: string[];
  netWeightValue: string | null;
  netWeightUnit: string | null;
  handlingInstructions: string | null;
  businessName: string;
  stateName: string;
  /** Their storefront bio — the best available sample of how this seller actually talks. */
  sellerBio: string | null;
}

/** The facts, as a block the model can only draw from. */
export function factsBlock(source: CopySource): string {
  const lines: string[] = [`Product name: ${source.title}`];

  if (source.categoryName) lines.push(`Category: ${source.categoryName}`);
  if (source.ingredients.length > 0) {
    // Order is meaningful (descending predominance by weight) and is never re-sorted, here or
    // anywhere else — see products/labeling.ts.
    lines.push(`Ingredients, in the order the maker listed them: ${source.ingredients.join(", ")}`);
  }

  const allergens = formatAllergens(source.allergens);
  if (allergens) lines.push(`Declared allergens: ${allergens}`);

  const weight = formatNetWeight(source.netWeightValue, source.netWeightUnit, { metric: false });
  if (weight) lines.push(`Net weight: ${weight}`);

  if (source.handlingInstructions) {
    lines.push(`Storage and handling, in the maker's words: ${source.handlingInstructions}`);
  }

  lines.push(`Made by: ${source.businessName}, a home producer in ${source.stateName}`);
  if (source.sellerBio) lines.push(`How the maker describes their business: ${source.sellerBio}`);
  if (source.existingDescription) {
    lines.push(`What the maker has written about this product so far: ${source.existingDescription}`);
  }

  return lines.join("\n");
}

const SHARED_RULES = [
  "Use ONLY the facts listed below. If a fact is not there, it does not exist and must not appear.",
  ...CLAIM_INSTRUCTIONS,
  "Write in the maker's own register — plain, specific and first-person plural where it fits. This is a neighbour selling food, not a brand.",
  "Do not mention the marketplace, delivery, pickup, prices or ordering.",
  "Return the text only. No preamble, no quotation marks, no options to choose between.",
];

const KIND_RULES: Record<CopyKind, string[]> = {
  description: [
    "Write a product description of two or three short sentences.",
    "Lead with what it is and what it tastes or feels like. If the ingredients suggest something specific, say that thing plainly.",
  ],
  social: [
    "Write a single social post of at most 280 characters.",
    "One concrete detail beats three adjectives. No hashtag spam — at most two, and only if they are obviously useful.",
    "Do not use emoji unless the maker's own bio uses them.",
  ],
};

export function buildPrompt(kind: CopyKind, source: CopySource): string {
  const rules = [...KIND_RULES[kind], ...SHARED_RULES].map((r, i) => `${i + 1}. ${r}`).join("\n");

  return [
    "You are helping a home food producer write copy for one of their own listings on a local marketplace.",
    "",
    "Rules:",
    rules,
    "",
    "The facts you may use:",
    factsBlock(source),
  ].join("\n");
}

/**
 * Whether there is enough here to be worth asking.
 *
 * With only a title, a model has nothing to ground on and will invent to fill the space — which is
 * the failure this whole module is arranged against. Better to tell the seller to write down what
 * is in it first, which they need for the label anyway.
 */
export function hasEnoughToGenerate(source: CopySource): boolean {
  return source.ingredients.length > 0 || !!source.existingDescription || !!source.categoryName;
}

export const NOT_ENOUGH_MESSAGE =
  "Add the ingredients first (you need them for the label anyway). With just a name there's nothing to work from, and anything written would be guesswork.";
