import { describe, expect, it } from "vitest";

import {
  buildPrompt,
  factsBlock,
  hasEnoughToGenerate,
  type CopySource,
} from "@/lib/ai/prompt";

/**
 * The prompt is the other half of keeping the model honest: the screen catches what gets through,
 * grounding is what stops most of it being written in the first place. So these assert that the
 * prompt contains the seller's facts, ALL of the prohibitions, and nothing invented.
 */

const source = (over: Partial<CopySource> = {}): CopySource => ({
  title: "Sourdough loaf",
  categoryName: "Baked goods",
  existingDescription: null,
  ingredients: ["Flour", "Water", "Salt", "Starter"],
  allergens: ["wheat"],
  netWeightValue: "24",
  netWeightUnit: "oz",
  handlingInstructions: "Keep in a paper bag; best within three days.",
  businessName: "Ben's Baked Bread",
  stateName: "Texas",
  sellerBio: "We make bread so you don't have to.",
  ...over,
});

describe("factsBlock", () => {
  it("carries every entered fact", () => {
    const block = factsBlock(source());
    expect(block).toContain("Sourdough loaf");
    expect(block).toContain("Flour, Water, Salt, Starter");
    expect(block).toContain("Wheat");
    expect(block).toContain("24 oz");
    expect(block).toContain("paper bag");
    expect(block).toContain("Ben's Baked Bread");
    expect(block).toContain("Texas");
  });

  it("keeps the ingredient order the seller entered", () => {
    // Descending predominance by weight is meaningful and is never re-sorted — here or anywhere.
    const block = factsBlock(source({ ingredients: ["Sugar", "Blackberries", "Milk"] }));
    expect(block).toContain("Sugar, Blackberries, Milk");
    expect(block).not.toContain("Blackberries, Milk, Sugar");
  });

  it("omits a fact the seller hasn't given rather than inventing a placeholder", () => {
    const block = factsBlock(
      source({
        ingredients: [],
        allergens: [],
        netWeightValue: null,
        netWeightUnit: null,
        handlingInstructions: null,
        sellerBio: null,
      }),
    );
    expect(block).not.toMatch(/Ingredients/);
    expect(block).not.toMatch(/allergens/i);
    expect(block).not.toMatch(/Net weight/);
    expect(block).not.toMatch(/undefined|null/);
  });

  it("passes the seller's existing words in as voice, not as something to replace", () => {
    const block = factsBlock(source({ existingDescription: "Baked Saturday mornings." }));
    expect(block).toContain("has written about this product so far");
    expect(block).toContain("Baked Saturday mornings.");
  });

  it("names the producer as a home producer, which is the honest framing", () => {
    expect(factsBlock(source())).toContain("a home producer in Texas");
  });
});

describe("buildPrompt", () => {
  it("tells the model the facts are the only material", () => {
    const prompt = buildPrompt("description", source());
    expect(prompt).toMatch(/Use ONLY the facts listed below/);
    expect(prompt).toMatch(/it does not exist and must not appear/);
  });

  it("carries every prohibition the screen enforces", () => {
    const prompt = buildPrompt("description", source()).toLowerCase();
    for (const forbidden of [
      "gluten-free",
      "immunity",
      "organic",
      "certified",
      "shelf stable",
      "award-winning",
      "invent",
    ]) {
      expect(prompt, forbidden).toContain(forbidden);
    }
  });

  it("asks for the text alone, so nothing has to be unwrapped", () => {
    expect(buildPrompt("description", source())).toMatch(/Return the text only/);
  });

  it("keeps the marketplace out of the copy", () => {
    // Price and pickup are the marketplace's job to render, and change independently of the words.
    expect(buildPrompt("description", source())).toMatch(/Do not mention the marketplace/);
  });

  it("asks for a short description for a listing", () => {
    expect(buildPrompt("description", source())).toMatch(/two or three short sentences/);
  });

  it("asks for one post within a length a social network accepts", () => {
    const prompt = buildPrompt("social", source());
    expect(prompt).toMatch(/280 characters/);
    expect(prompt).toMatch(/at most two/);
  });

  it("includes the facts block itself", () => {
    expect(buildPrompt("social", source())).toContain(factsBlock(source()));
  });
});

describe("hasEnoughToGenerate", () => {
  it("is happy once there are ingredients", () => {
    expect(hasEnoughToGenerate(source())).toBe(true);
  });

  it("refuses on a bare title, because there is nothing to ground on", () => {
    // A model given only "Sourdough loaf" writes a 48-hour cold ferment and a heritage starter,
    // because that is what sourdough copy sounds like. None of it would be true.
    expect(
      hasEnoughToGenerate(
        source({ ingredients: [], existingDescription: null, categoryName: null }),
      ),
    ).toBe(false);
  });

  it("accepts a category or an existing description as grounding", () => {
    expect(
      hasEnoughToGenerate(source({ ingredients: [], existingDescription: "Baked Saturdays." })),
    ).toBe(true);
    expect(
      hasEnoughToGenerate(source({ ingredients: [], existingDescription: null })),
    ).toBe(true);
  });
});
