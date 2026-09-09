/**
 * Screening generated copy for claims a cottage-food seller must not make.
 *
 * ===========================================================================
 * THIS IS THE FEATURE. THE MODEL IS THE CONVENIENCE.
 * ===========================================================================
 * Everything else in this codebase is arranged so a seller cannot accidentally say something untrue
 * about food: allergens are a CHECK-enforced federal-nine vocabulary, disclaimers are quoted statute
 * stored verbatim, and a label refuses to print rather than print a blank. Handing a language model
 * a text box that writes the listing copy runs directly at all of that, because the failure mode of
 * a fluent model is a plausible sentence nobody entered.
 *
 * Four kinds of sentence are the problem, and only the first is obvious:
 *
 *   1. An ABSENCE claim — "gluten-free", "nut-free", "vegan". A home kitchen has no cross-contact
 *      controls and no testing. This is the one that can hurt somebody, and a model will write it
 *      cheerfully from an ingredient list that merely lacks wheat.
 *   2. A HEALTH claim — "boosts immunity", "aids digestion". FDA/FTC territory, and a cottage-food
 *      operation is the least equipped party in the country to defend one.
 *   3. A REGULATORY-STATUS claim — "organic", "certified", "inspected", "FDA approved". Rules 5 to 7
 *      exist to stop a listing implying inspection, and in most states the label printed on the jar
 *      says the literal opposite ("not subject to governmental licensing or inspection").
 *   4. A FABRICATED FACT — "award-winning", "aged 48 hours", "shelf stable for a year". Plausible,
 *      unverifiable, and the seller may not notice it is wrong in their own listing.
 *
 * So the model's output is screened by this module — deterministic, pure, and tested — before a
 * seller can apply it. The screen is not advice: a `block` finding disables the button. The seller
 * can still edit the text, and editing re-screens, which is the point: the guardrail teaches what
 * cannot be said rather than silently deleting it.
 *
 * On false positives. Food writing is full of words that look like claims. "Cured bacon" is not a
 * medical claim, "a lovely treat" is not a course of treatment, and "natural" is nearly meaningless
 * rather than forbidden. Every pattern below is scoped to avoid those, and the ones that are merely
 * unwise rather than unlawful are `warn`, which informs without blocking.
 */

export type ClaimSeverity = "block" | "warn";

export interface ClaimFinding {
  /** The exact text that matched, so the seller can find it. */
  match: string;
  severity: ClaimSeverity;
  category: "absence" | "health" | "regulatory" | "fabricated" | "puffery";
  /** Said to the seller, in their terms. */
  why: string;
}

interface Rule {
  pattern: RegExp;
  severity: ClaimSeverity;
  category: ClaimFinding["category"];
  why: string;
}

const ABSENCE_WHY =
  "A home kitchen can't rule out cross-contact, and this reads as a guarantee to someone with an allergy. Say what's in it, not what isn't.";

const RULES: Rule[] = [
  // --- 1. Absence and dietary guarantees --------------------------------
  {
    pattern: /\b(gluten|dairy|nut|peanut|soy|egg|lactose|sugar|fat|allergen|grain)[-\s]?free\b/gi,
    severity: "block",
    category: "absence",
    why: ABSENCE_WHY,
  },
  {
    pattern: /\b(free\s+from|free\s+of|contains\s+no|without\s+any)\b/gi,
    severity: "block",
    category: "absence",
    why: ABSENCE_WHY,
  },
  {
    pattern: /\b(vegan|hypoallergenic|non[-\s]?gmo)\b/gi,
    severity: "block",
    category: "absence",
    why: ABSENCE_WHY,
  },
  {
    pattern: /\b(kosher|halal)\b/gi,
    severity: "block",
    category: "regulatory",
    why: "That's a certification granted by a certifying body. Only claim it if you hold it, and then say who certified you.",
  },

  // --- 2. Health and medical --------------------------------------------
  {
    // "cures" the verb, never "cured" the curing process — cured bacon is a food, not a claim.
    pattern:
      /\b(boosts?\s+(your\s+)?immun\w*|immune[-\s]boosting|detox\w*|cleanses?\b|cures?\b|heals?\b|healing|medicinal|therapeutic|anti[-\s]?inflammator\w*|superfood|lowers?\s+cholesterol|weight[-\s]loss|aids?\s+digestion|good\s+for\s+your\s+\w+)\b/gi,
    severity: "block",
    category: "health",
    why: "A health claim about food is regulated by the FDA and FTC, and a cottage-food producer is the worst-placed person to have to defend one.",
  },
  {
    // The verb directly governing an ailment: "treats the common cold", "prevents illness".
    // The negative lookahead is what keeps "treats for cold winter mornings" out of it — a
    // preposition after the word means it is the noun, and a plate of treats is not a therapy.
    pattern:
      /\b(treats?|prevents?|relieves?)\s+(?!for\b|with\b|on\b|in\b|at\b|from\b|to\b)(?:(?:your|the|a)\s+)?(?:\w+\s+){0,2}(colds?|flu|illness|disease|condition|symptoms?|ailment)\w*/gi,
    severity: "block",
    category: "health",
    why: "That describes a medical effect. Food sold this way is legally a drug.",
  },
  {
    pattern: /\b(diabetic[-\s]friendly|keto[-\s]?friendly|heart[-\s]healthy|low[-\s]glycemic)\b/gi,
    severity: "block",
    category: "health",
    why: "A dietary-suitability claim needs nutritional analysis you'd have to pay a lab for.",
  },

  // --- 3. Regulatory status ---------------------------------------------
  {
    pattern:
      /\b(organic|certified|inspected|FDA[-\s]approved|USDA[-\s]?(approved|certified|inspected)?|lab[-\s]tested|food[-\s]safety[-\s]certified|licensed\s+kitchen|commercial\s+kitchen|grade\s+A)\b/gi,
    severity: "block",
    category: "regulatory",
    why: "This implies an approval or inspection you don't have — and in most states the label on the jar has to say the opposite.",
  },

  // --- 4. Fabricated facts ----------------------------------------------
  {
    pattern: /\b(award[-\s]winning|prize[-\s]winning|world[-\s]famous|voted\s+best|#\s?1\b|number\s+one)\b/gi,
    severity: "block",
    category: "fabricated",
    why: "Nothing you entered says this. If it's true, say which award — otherwise it's a made-up fact in your own listing.",
  },
  {
    pattern: /\b(shelf[-\s]stable|never\s+spoils?|stays\s+fresh\s+for|lasts?\s+(for\s+)?\w+\s+(days?|weeks?|months?|years?))\b/gi,
    severity: "block",
    category: "fabricated",
    why: "A shelf-life or stability claim is a food-safety statement. It needs to come from you, not from a guess.",
  },

  // --- 5. Puffery — unwise rather than unlawful --------------------------
  {
    pattern: /\b(best|finest|greatest|unbeatable|perfect|amazing|incredible)\b/gi,
    severity: "warn",
    category: "puffery",
    why: "Reads like advertising rather than like you. Buyers on a local marketplace tend to trust the plainer sentence.",
  },
  {
    pattern: /\b(all[-\s]natural|100%\s+natural|farm[-\s]fresh|artisanal)\b/gi,
    severity: "warn",
    category: "puffery",
    why: "These words are close to meaningless and a few states police them. Something specific about how you make it lands better.",
  },
];

/**
 * Screen a piece of generated (or edited) copy.
 *
 * Deduplicated by matched text so a word used three times is one finding, and ordered blocks first —
 * the seller should read what stops them before what merely nags.
 */
export function screenCopy(text: string): ClaimFinding[] {
  const found = new Map<string, ClaimFinding>();

  for (const rule of RULES) {
    // `matchAll` needs the /g flag, which every rule has; `lastIndex` is not shared because a new
    // iterator is created each time.
    for (const m of text.matchAll(rule.pattern)) {
      const match = m[0].trim();
      const key = `${rule.category}:${match.toLowerCase()}`;
      if (!found.has(key)) {
        found.set(key, { match, severity: rule.severity, category: rule.category, why: rule.why });
      }
    }
  }

  return [...found.values()].sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "block" ? -1 : 1;
    return a.match.localeCompare(b.match);
  });
}

/** Whether this copy may be applied to a listing as it stands. */
export function isSafeToApply(findings: ClaimFinding[]): boolean {
  return !findings.some((f) => f.severity === "block");
}

/**
 * The rules, as a list of sentences for the prompt.
 *
 * Deliberately derived from the same array the screen uses, so the instruction given to the model
 * and the check applied to its answer cannot drift apart. Telling a model "don't say X" is not a
 * guarantee — that is what `screenCopy` is for — but it makes a clean first attempt much likelier.
 */
export const CLAIM_INSTRUCTIONS: string[] = [
  "Never claim the absence of an ingredient or allergen. No \"gluten-free\", \"dairy-free\", \"nut-free\", \"vegan\", \"free from\", \"contains no\".",
  "Never make a health, medical or nutritional claim. No \"boosts immunity\", \"aids digestion\", \"anti-inflammatory\", \"heart-healthy\", \"keto-friendly\".",
  "Never imply inspection, certification or approval. No \"organic\", \"certified\", \"inspected\", \"FDA\", \"USDA\", \"lab tested\", \"commercial kitchen\", \"kosher\", \"halal\".",
  "Never state a shelf life, a stability claim, or an award. No \"shelf stable\", \"lasts six months\", \"award-winning\".",
  "Never invent an ingredient, a process, a time, a temperature, an origin or a person. Use only the facts given to you.",
  "Avoid \"best\", \"finest\", \"all-natural\", \"artisanal\" and similar advertising words.",
];
