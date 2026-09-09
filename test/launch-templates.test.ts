import { describe, expect, it } from "vitest";

import { launchTemplates, type TemplateSource } from "@/lib/launch/templates";
import { isSafeToApply, screenCopy } from "@/lib/ai/claims";

/**
 * The templates are our words, so they are held to the bar we hold the writing assistant to. It
 * would be an odd marketplace that refuses a seller "gluten-free" and then hands them a template
 * that says it.
 */

const source = (over: Partial<TemplateSource> = {}): TemplateSource => ({
  businessName: "Ben's Baked Bread",
  storefrontUrl: "https://harvestlocal.test/s/baked-bread",
  stateName: "Texas",
  bio: "We make bread so you don't have to.",
  promoCode: null,
  promoPercent: null,
  ...over,
});

describe("every template passes the claim screen", () => {
  // The point of the whole module, asserted first.
  for (const template of launchTemplates(source())) {
    it(`"${template.title}" makes no claim a seller couldn't`, () => {
      const findings = screenCopy(`${template.body} ${template.note ?? ""}`);
      expect(isSafeToApply(findings), JSON.stringify(findings)).toBe(true);
    });
  }

  it("holds for the referral template too", () => {
    const withCode = launchTemplates(source({ promoCode: "BREAD10", promoPercent: 10 }));
    for (const t of withCode) {
      expect(isSafeToApply(screenCopy(`${t.body} ${t.note ?? ""}`)), t.title).toBe(true);
    }
  });
});

describe("templates say nothing we don't know", () => {
  it("uses the seller's own bio verbatim rather than describing them", () => {
    const bio = "Sourdough, and occasionally cinnamon buns when I have the time.";
    const friends = launchTemplates(source({ bio })).find((t) => t.id === "friends")!;
    expect(friends.body).toContain(bio);
  });

  it("leaves an obvious blank rather than inventing what they make", () => {
    // A cheerful "fresh sourdough and seasonal preserves" would be a sentence about their business
    // that nobody at their business wrote — and some sellers would send it unread.
    const friends = launchTemplates(source({ bio: null })).find((t) => t.id === "friends")!;
    expect(friends.body).toContain("[a sentence about what you make]");
  });

  it("treats a blank bio as no bio", () => {
    const friends = launchTemplates(source({ bio: "   " })).find((t) => t.id === "friends")!;
    expect(friends.body).toContain("[a sentence about what you make]");
  });

  it("never claims the food is good", () => {
    // Ours to structure, theirs to praise.
    for (const t of launchTemplates(source())) {
      expect(t.body).not.toMatch(/\b(delicious|tasty|amazing|the best|incredible|mouth-?watering)\b/i);
    }
  });

  it("carries the real storefront link in every template a buyer would receive", () => {
    const url = "https://harvestlocal.test/s/baked-bread";
    const shareable = launchTemplates(source()).filter((t) => t.id !== "first-order");
    for (const t of shareable) {
      expect(t.body, t.title).toContain(url);
    }
  });

  it("names the business rather than saying 'your business'", () => {
    const bodies = launchTemplates(source()).map((t) => t.body).join("\n");
    expect(bodies).toContain("Ben's Baked Bread");
    expect(bodies).not.toMatch(/\[business name\]|your business name/i);
  });
});

describe("the referral template", () => {
  it("is absent without a code, rather than telling them to make one up", () => {
    expect(launchTemplates(source()).find((t) => t.id === "referral")).toBeUndefined();
  });

  it("is absent when there's a code but no discount to quote", () => {
    // Quoting a percentage we don't have would be a number the buyer then doesn't get.
    expect(
      launchTemplates(source({ promoCode: "BREAD10", promoPercent: null })).find(
        (t) => t.id === "referral",
      ),
    ).toBeUndefined();
  });

  it("quotes the real code and the real percentage", () => {
    const t = launchTemplates(source({ promoCode: "BREAD10", promoPercent: 10 })).find(
      (x) => x.id === "referral",
    )!;
    expect(t.body).toContain("BREAD10");
    expect(t.body).toContain("10% off");
  });

  it("says out loud that orders stay in one state", () => {
    // Rule 1, in the one template a seller is most likely to post somewhere public.
    const t = launchTemplates(source({ promoCode: "BREAD10", promoPercent: 10 })).find(
      (x) => x.id === "referral",
    )!;
    expect(t.note).toMatch(/inside one state/i);
  });
});

describe("shape", () => {
  it("gives every template a title, a when and a body", () => {
    for (const t of launchTemplates(source())) {
      expect(t.title.length, t.id).toBeGreaterThan(0);
      expect(t.when.length, t.id).toBeGreaterThan(0);
      expect(t.body.trim().length, t.id).toBeGreaterThan(0);
    }
  });

  it("keeps ids unique, since they key the copy buttons", () => {
    const ids = launchTemplates(source({ promoCode: "X", promoPercent: 5 })).map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps each one short enough to read before sending", () => {
    for (const t of launchTemplates(source())) {
      expect(t.body.length, t.id).toBeLessThan(500);
    }
  });
});
