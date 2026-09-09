import { describe, expect, it } from "vitest";

import {
  CLAIM_INSTRUCTIONS,
  isSafeToApply,
  screenCopy,
  type ClaimFinding,
} from "@/lib/ai/claims";

/**
 * The screen is what makes generated copy safe to offer at all, so it is tested from both ends:
 * that it catches the sentence that could hurt someone, and — just as important — that it does not
 * cry wolf on ordinary food writing. A screen with false positives gets ignored, and an ignored
 * screen protects nobody.
 */

const cats = (findings: ClaimFinding[]) => findings.map((f) => f.category);
const matches = (findings: ClaimFinding[]) => findings.map((f) => f.match.toLowerCase());

function blocks(text: string): boolean {
  return !isSafeToApply(screenCopy(text));
}

describe("absence claims — the ones that can hurt someone", () => {
  it("blocks a dietary guarantee a home kitchen cannot make", () => {
    for (const text of [
      "Our gluten-free sourdough loaf.",
      "A dairy free treat for everyone.",
      "Completely nut-free, we promise.",
      "This jam is sugar free.",
    ]) {
      expect(blocks(text), text).toBe(true);
    }
  });

  it("blocks the roundabout phrasings too", () => {
    expect(blocks("Free from artificial colours.")).toBe(true);
    expect(blocks("Contains no preservatives.")).toBe(true);
    expect(blocks("Made without any additives.")).toBe(true);
  });

  it("blocks vegan, which is a cross-contact claim in a shared kitchen", () => {
    expect(blocks("A vegan chocolate cake.")).toBe(true);
    expect(cats(screenCopy("A vegan chocolate cake."))).toContain("absence");
  });

  it("explains itself in the seller's terms", () => {
    const [finding] = screenCopy("Our gluten-free bread.");
    expect(finding.why).toMatch(/cross-contact/i);
    expect(finding.match.toLowerCase()).toBe("gluten-free");
  });
});

describe("health claims", () => {
  it("blocks the classic ones", () => {
    for (const text of [
      "Boosts your immunity through winter.",
      "A natural detox.",
      "Anti-inflammatory turmeric blend.",
      "This superfood granola.",
      "Great for weight loss.",
      "Aids digestion after a heavy meal.",
    ]) {
      expect(blocks(text), text).toBe(true);
    }
  });

  it("blocks a medical effect even when softly phrased", () => {
    expect(blocks("Treats the common cold.")).toBe(true);
    expect(blocks("Helps prevent illness.")).toBe(true);
  });

  it("blocks dietary-suitability claims that would need a lab", () => {
    expect(blocks("Diabetic-friendly shortbread.")).toBe(true);
    expect(blocks("A heart-healthy loaf.")).toBe(true);
  });
});

describe("regulatory status", () => {
  it("blocks anything implying inspection or approval", () => {
    for (const text of [
      "Made with organic flour.",
      "Baked in a licensed kitchen.",
      "Certified by us.",
      "FDA approved.",
      "Lab tested for purity.",
      "Kosher chicken soup.",
    ]) {
      expect(blocks(text), text).toBe(true);
    }
  });

  it("says why, which is the part a seller needs", () => {
    const [finding] = screenCopy("Made with organic flour.");
    expect(finding.why).toMatch(/label on the jar has to say the opposite/i);
  });
});

describe("fabricated facts", () => {
  it("blocks an award nobody entered", () => {
    expect(blocks("Our award-winning jam.")).toBe(true);
    expect(blocks("World-famous cinnamon rolls.")).toBe(true);
  });

  it("blocks a shelf-life claim, which is a food-safety statement", () => {
    expect(blocks("Shelf stable for up to a year.")).toBe(true);
    expect(blocks("Lasts for six months in the pantry.")).toBe(true);
    expect(blocks("Never spoils.")).toBe(true);
  });
});

describe("DOES NOT cry wolf on ordinary food writing", () => {
  // Every one of these is a sentence a real seller might reasonably write. A screen that flags them
  // trains sellers to click past it, and then it protects nobody.
  const fine = [
    "Slow-cured bacon from a local farm.",
    "A lovely treat with afternoon tea.",
    "Cured over applewood for a deep, smoky flavour.",
    "Sourdough loaf, baked Saturday morning.",
    "Made with butter, flour, sugar and eggs.",
    "Sharp and a little sweet — good on toast.",
    "We use raspberries from the garden when they're in season.",
    "Comes in a 15 oz jar.",
    "Free delivery on orders over $30.",
    "Pick up at the Denton market on Saturdays.",
    "The recipe came from my grandmother.",
    "Nut butter cookies, soft in the middle.",
  ];

  for (const text of fine) {
    it(`leaves alone: ${text}`, () => {
      expect(blocks(text)).toBe(false);
    });
  }

  it("does not read 'cured' as 'cures'", () => {
    // The single most likely false positive in food copy.
    expect(blocks("Home-cured salmon.")).toBe(false);
    expect(blocks("This cures a cold.")).toBe(true);
  });

  it("does not read 'a treat' as medical treatment", () => {
    expect(blocks("A weekend treat.")).toBe(false);
    expect(blocks("Treats your cold symptoms.")).toBe(true);
  });

  it("does not flag 'free delivery', which is about postage", () => {
    expect(screenCopy("Free delivery on Saturdays.")).toHaveLength(0);
  });
});

describe("puffery is warned about, not blocked", () => {
  it("lets advertising language through with a note", () => {
    const findings = screenCopy("The best jam in Texas, all-natural and amazing.");
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.every((f) => f.severity === "warn")).toBe(true);
    expect(isSafeToApply(findings)).toBe(true);
  });

  it("still blocks when a real claim sits alongside puffery", () => {
    const findings = screenCopy("The best gluten-free bread you'll ever eat.");
    expect(isSafeToApply(findings)).toBe(false);
  });
});

describe("output shape", () => {
  it("puts blocks before warnings, because that is the reading order", () => {
    const findings = screenCopy("Our best organic, award-winning, all-natural jam.");
    const firstWarn = findings.findIndex((f) => f.severity === "warn");
    const lastBlock = findings.map((f) => f.severity).lastIndexOf("block");
    expect(lastBlock).toBeLessThan(firstWarn);
  });

  it("reports a repeated phrase once", () => {
    const findings = screenCopy("Organic flour, organic sugar, organic butter.");
    expect(matches(findings).filter((m) => m === "organic")).toHaveLength(1);
  });

  it("is empty for copy with nothing wrong with it", () => {
    expect(screenCopy("Sourdough loaf. Flour, water, salt, starter. 24 oz.")).toEqual([]);
    expect(isSafeToApply([])).toBe(true);
  });

  it("is case-insensitive, so shouting doesn't get through", () => {
    expect(blocks("GLUTEN FREE!")).toBe(true);
    expect(blocks("Certified Organic")).toBe(true);
  });
});

describe("the prompt instructions and the screen come from one place", () => {
  it("tells the model about every category the screen blocks", () => {
    const instructions = CLAIM_INSTRUCTIONS.join(" ").toLowerCase();
    for (const word of ["gluten-free", "immunity", "organic", "shelf stable", "invent"]) {
      expect(instructions).toContain(word);
    }
  });
});

describe("the medical-verb pattern stays narrow", () => {
  it("blocks the verb governing an ailment", () => {
    expect(blocks("Treats the common cold.")).toBe(true);
    expect(blocks("Prevents illness.")).toBe(true);
    expect(blocks("Relieves flu symptoms.")).toBe(true);
  });

  it("leaves the noun alone, even next to the word cold", () => {
    // "treats" followed by a preposition is a plate of biscuits, not a therapy.
    expect(blocks("Treats for cold winter mornings.")).toBe(false);
    expect(blocks("Treats with a cup of tea.")).toBe(false);
    expect(blocks("Warm treats on a cold day.")).toBe(false);
  });
});
