import { describe, expect, it } from "vitest";

import { validateEntry } from "../scripts/lib/market-research.mjs";

const troy = {
  state: "TX",
  slug: "an-evening-market-at-troy-tx",
  checked: "2026-09-14",
  website: "https://www.cityoftroy.us/29737/farmers-market",
  facebook: "https://www.facebook.com/EveningMarketTroyTX/",
  hours: [{ day: "Fri", opens: "17:00", closes: "19:00" }],
  season: "February to November",
  hoursSourceNote: "Yelp, Nextdoor and a 2026 event listing",
  hoursSourceUrl: "https://www.yelp.com/biz/evening-market-at-troy-tx-troy",
};

describe("validateEntry", () => {
  it("accepts a complete entry and dates the source note", () => {
    const r = validateEntry(troy);
    expect(r.ok).toBe(true);
    if (!r.ok || !r.value) return;
    expect(r.value.hours).toEqual([{ dayOfWeek: 5, opens: "17:00", closes: "19:00" }]);
    expect(r.value.sourceNote).toBe("Yelp, Nextdoor and a 2026 event listing; checked Sep 2026");
    expect(r.value.season).toBe("February to November");
  });

  it("accepts an entry with no hours — a website or a Facebook page alone is worth recording", () => {
    const r = validateEntry({ ...troy, hours: null, hoursSourceNote: undefined, hoursSourceUrl: undefined });
    expect(r.ok).toBe(true);
    if (r.ok && r.value) expect(r.value.sourceNote).toBeNull();
  });

  it("refuses hours with no source — a buyer must be able to check them", () => {
    const r = validateEntry({ ...troy, hoursSourceNote: "", hoursSourceUrl: null });
    expect(r.ok).toBe(false);
  });

  it("refuses a malformed schedule rather than applying part of it", () => {
    expect(validateEntry({ ...troy, hours: [{ day: "Fri", opens: "5pm", closes: "7pm" }] }).ok).toBe(false);
    expect(validateEntry({ ...troy, hours: [{ day: "Caturday", opens: "17:00", closes: "19:00" }] }).ok).toBe(false);
    expect(validateEntry({ ...troy, hours: [{ day: "Fri", opens: "19:00", closes: "17:00" }] }).ok).toBe(false);
    expect(validateEntry({ ...troy, hours: [] }).ok).toBe(false);
  });

  it("refuses a Facebook field that is not on Facebook, and a non-web website", () => {
    expect(validateEntry({ ...troy, facebook: "https://example.org/fb" }).ok).toBe(false);
    expect(validateEntry({ ...troy, website: "javascript:alert(1)" }).ok).toBe(false);
  });

  it("refuses a bad slug, state or date", () => {
    expect(validateEntry({ ...troy, slug: "Not A Slug" }).ok).toBe(false);
    expect(validateEntry({ ...troy, state: "Texas" }).ok).toBe(false);
    expect(validateEntry({ ...troy, checked: "Sept 14" }).ok).toBe(false);
  });
});
