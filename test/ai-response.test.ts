import { describe, expect, it } from "vitest";

import { stripWrapping } from "@/lib/ai/response";

/**
 * A model told "return the text only" wraps it anyway often enough to be worth handling. The rule
 * here is conservative: strip only what we are sure of, because mangling a seller's copy is worse
 * than leaving them a stray quote to delete.
 */

describe("stripWrapping", () => {
  it("leaves clean copy exactly alone", () => {
    const text = "Sourdough loaf, baked Saturday morning. Flour, water, salt and our starter.";
    expect(stripWrapping(text)).toBe(text);
  });

  it("removes a markdown fence", () => {
    expect(stripWrapping("```\nSourdough loaf.\n```")).toBe("Sourdough loaf.");
    expect(stripWrapping("```text\nSourdough loaf.\n```")).toBe("Sourdough loaf.");
  });

  it("removes an announcing preamble line", () => {
    expect(stripWrapping("Here's a description:\n\nSourdough loaf.")).toBe("Sourdough loaf.");
  });

  it("removes matching quotes around the whole thing", () => {
    expect(stripWrapping('"Sourdough loaf."')).toBe("Sourdough loaf.");
    expect(stripWrapping("\u201CSourdough loaf.\u201D")).toBe("Sourdough loaf.");
  });

  it("does NOT strip quotes that are part of the copy", () => {
    // Half-stripping this would leave broken punctuation in a seller's listing.
    const text = 'Grandma called it "the good jam" and the name stuck.';
    expect(stripWrapping(text)).toBe(text);
  });

  it("does not eat a first sentence that merely contains a colon", () => {
    // The preamble rule only fires on a short line ENDING in a colon with a break after it.
    const text = "One rule: butter, and plenty of it.\nBaked every Saturday.";
    expect(stripWrapping(text)).toBe(text);
  });

  it("keeps internal line breaks", () => {
    expect(stripWrapping("First line.\nSecond line.")).toBe("First line.\nSecond line.");
  });

  it("is empty for empty input", () => {
    expect(stripWrapping("")).toBe("");
    expect(stripWrapping("   \n  ")).toBe("");
  });
});
