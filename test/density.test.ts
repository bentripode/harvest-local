import { describe, expect, it } from "vitest";

import {
  classify,
  deliversTo,
  describeDensity,
  LOCAL_MILES,
  REGIONAL_MILES,
} from "@/lib/geo/density";
import type { NearbySeller } from "@/lib/geo/nearby-format";

/**
 * The bug this module exists to prevent is a page that keeps working while becoming useless: a
 * distance-sorted list whose first result is 84 miles away, presented exactly like one 2 miles away.
 * So the tests are mostly about what the page SAYS, not what it contains.
 */

const seller = (over: Partial<NearbySeller> = {}): NearbySeller => ({
  sellerId: "s1",
  businessName: "Ben's Baked Bread",
  storefrontSlug: "baked-bread",
  avgRating: null,
  distanceMiles: 4,
  lng: null,
  lat: null,
  locationLabel: "Austin",
  isMarket: false,
  deliveryEnabled: false,
  deliveryRadiusMiles: null,
  ...over,
});

describe("deliversTo", () => {
  it("is true when the buyer is inside the stated radius", () => {
    expect(deliversTo(seller({ deliveryEnabled: true, deliveryRadiusMiles: 50 }), 40)).toBe(true);
  });

  it("is false past the radius", () => {
    expect(deliversTo(seller({ deliveryEnabled: true, deliveryRadiusMiles: 20 }), 40)).toBe(false);
  });

  it("does NOT assume a radius from delivery being switched on", () => {
    // `delivery_enabled` with no radius means they haven't said how far. Guessing would walk a
    // buyer through checkout to be refused by `quoteDelivery`, which actually knows.
    expect(deliversTo(seller({ deliveryEnabled: true, deliveryRadiusMiles: null }), 5)).toBe(false);
  });

  it("is false when we don't know how far away the buyer is", () => {
    expect(deliversTo(seller({ deliveryEnabled: true, deliveryRadiusMiles: 50 }), null)).toBe(false);
  });
});

describe("classify", () => {
  it("bands by distance", () => {
    expect(classify(seller({ distanceMiles: 3 }))).toBe("local");
    expect(classify(seller({ distanceMiles: LOCAL_MILES }))).toBe("local");
    expect(classify(seller({ distanceMiles: LOCAL_MILES + 1 }))).toBe("regional");
    expect(classify(seller({ distanceMiles: REGIONAL_MILES }))).toBe("regional");
    expect(classify(seller({ distanceMiles: REGIONAL_MILES + 1 }))).toBe("distant");
  });

  it("counts a far seller who delivers to you as reachable", () => {
    // The whole point of pulling delivery into this: 90 miles away is out of reach for pickup and
    // perfectly fine if they're driving it to you.
    const far = seller({ distanceMiles: 90, deliveryEnabled: true, deliveryRadiusMiles: 100 });
    expect(classify(far)).toBe("delivers");
  });

  it("still calls a far seller distant when their radius doesn't reach", () => {
    const far = seller({ distanceMiles: 90, deliveryEnabled: true, deliveryRadiusMiles: 20 });
    expect(classify(far)).toBe("distant");
  });

  it("makes no claim without an origin", () => {
    expect(classify(seller({ distanceMiles: null }))).toBe("unknown");
  });
});

describe("describeDensity — the thin-state case", () => {
  it("says nobody is near, instead of ranking a 200-mile seller first", () => {
    const view = describeDensity(
      [seller({ distanceMiles: 200, locationLabel: "Amarillo" })],
      "Texas",
    );
    expect(view.reachable).toHaveLength(0);
    expect(view.headline).toBe("Nobody within 75 miles of you.");
    expect(view.detail).toContain("Amarillo");
    expect(view.detail).toContain("200 mi away");
  });

  it("keeps the distant sellers in their own list rather than dropping them", () => {
    // A buyer deciding whether to come back next month is better served by "there are four here,
    // all a long way off" than by a page that looks empty — and a new seller deserves to appear.
    const view = describeDensity(
      [seller({ distanceMiles: 200 }), seller({ sellerId: "s2", distanceMiles: 300 })],
      "Texas",
    );
    expect(view.distant).toHaveLength(2);
    expect(view.reachable).toHaveLength(0);
  });

  it("is plainly empty when the state really is", () => {
    const view = describeDensity([], "Wyoming");
    expect(view.headline).toBe("No sellers in Wyoming yet.");
    expect(view.detail).toBeNull();
  });
});

describe("describeDensity — the ordinary case", () => {
  it("leads with how many are genuinely local", () => {
    const view = describeDensity(
      [seller({ distanceMiles: 2 }), seller({ sellerId: "s2", distanceMiles: 8 })],
      "Texas",
    );
    expect(view.headline).toBe("2 sellers within 25 miles.");
    expect(view.detail).toBeNull();
  });

  it("gets the singular right", () => {
    expect(describeDensity([seller({ distanceMiles: 2 })], "Texas").headline).toBe(
      "1 seller within 25 miles.",
    );
  });

  it("mentions the ones further out and the ones who deliver", () => {
    const view = describeDensity(
      [
        seller({ distanceMiles: 2 }),
        seller({ sellerId: "s2", distanceMiles: 40 }),
        seller({
          sellerId: "s3",
          distanceMiles: 90,
          deliveryEnabled: true,
          deliveryRadiusMiles: 100,
        }),
        seller({ sellerId: "s4", distanceMiles: 400 }),
      ],
      "Texas",
    );
    expect(view.headline).toBe("1 seller within 25 miles.");
    expect(view.detail).toBe("2 more a bit further out, 1 of them delivers to you and 1 elsewhere in Texas.");
  });

  it("falls back to 'within reach' when nothing is properly local", () => {
    const view = describeDensity([seller({ distanceMiles: 40 })], "Texas");
    expect(view.headline).toBe("1 seller within reach.");
  });
});

describe("describeDensity — no origin", () => {
  it("makes no distance claim at all and asks for a ZIP", () => {
    const view = describeDensity(
      [seller({ distanceMiles: null }), seller({ sellerId: "s2", distanceMiles: null })],
      "Texas",
    );
    expect(view.unmeasured).toBe(true);
    expect(view.headline).toBe("2 sellers in Texas.");
    expect(view.detail).toMatch(/Add a ZIP code/);
    // Everything is still listed — we just aren't ordering it by a distance we don't have.
    expect(view.reachable).toHaveLength(2);
    expect(view.distant).toHaveLength(0);
  });

  it("is not 'unmeasured' when only some distances are missing", () => {
    const view = describeDensity(
      [seller({ distanceMiles: 3 }), seller({ sellerId: "s2", distanceMiles: null })],
      "Texas",
    );
    expect(view.unmeasured).toBe(false);
  });
});

describe("it never leaves the state", () => {
  it("takes the state name it is given and never suggests another", () => {
    // Filling an empty page with the sellers over the border is the obvious move and the one rule 1
    // forbids at the discovery layer — every one would be a dead end we had advertised.
    const view = describeDensity([], "Wyoming");
    expect(view.headline).toContain("Wyoming");
    expect(`${view.headline} ${view.detail ?? ""}`).not.toMatch(/nearby state|other states|border/i);
  });
});
