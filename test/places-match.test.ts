import { describe, expect, it } from "vitest";

import {
  distinctiveTokens,
  judgeCandidate,
  metresBetween,
  nameScore,
  pickPlace,
} from "../scripts/lib/places-match.mjs";

/** Salisbury, NC — our row, and two candidates a text search actually returns near it. */
const ourMarket = {
  name: "Salisbury Rowan Farmers Market",
  lat: 35.669,
  lng: -80.4722,
};
/** A candidate stands somewhere, and is a market unless a test says otherwise. */
const near = (dLat: number, dLng: number) => ({
  lat: ourMarket.lat + dLat,
  lng: ourMarket.lng + dLng,
  primaryType: "farmers_market",
  types: ["farmers_market", "market", "point_of_interest"],
});

describe("distinctiveTokens", () => {
  it("drops the words every market shares", () => {
    expect([...distinctiveTokens("Salisbury Rowan Farmers Market")].sort()).toEqual([
      "rowan",
      "salisbury",
    ]);
    expect([...distinctiveTokens("Downtown Community Farmers' Market")]).toEqual([]);
  });
});

describe("nameScore", () => {
  it("treats a short form as a match, not a mismatch", () => {
    // Google often holds a shorter name than the directory does.
    expect(nameScore("Salisbury Rowan Farmers Market", "Salisbury Farmers' Market")).toBe(1);
  });

  it("scores two different markets in the same town well below the bar", () => {
    expect(nameScore("Elmhurst Farmers Market", "Wheaton French Market")).toBe(0);
  });

  it("treats a qualifier only one side carries as a different place, not a short form", () => {
    // "North Salem" is the next town along, not an abbreviation of "Salem" — and that pair really
    // appeared in the source data, a North Salem website filed under a Salem heading.
    expect(nameScore("North Salem Farmers Market", "Salem Farmers Market")).toBe(0);
    expect(nameScore("West Seattle Farmers Market", "Seattle Farmers Market")).toBe(0);
    expect(nameScore("Old Town Farmers Market", "Town Farmers Market")).toBe(0);
    // ...but a qualifier both sides carry is just part of the name.
    expect(nameScore("North Salem Farmers Market", "North Salem Market")).toBe(1);
  });

  it("is 0 when either name carries no identifying word at all", () => {
    expect(nameScore("The Farmers Market", "Salisbury Farmers Market")).toBe(0);
  });
});

describe("metresBetween", () => {
  it("measures a short hop about right", () => {
    // ~0.009° of latitude is roughly a kilometre.
    const m = metresBetween({ lat: 35.669, lng: -80.4722 }, { lat: 35.678, lng: -80.4722 });
    expect(m).toBeGreaterThan(950);
    expect(m).toBeLessThan(1050);
  });

  it("is null when either side has no coordinates", () => {
    expect(metresBetween({ lat: 1, lng: 1 }, { lat: null, lng: null })).toBeNull();
    expect(metresBetween(null, { lat: 1, lng: 1 })).toBeNull();
  });
});

describe("judgeCandidate", () => {
  it("accepts the same market a street away", () => {
    const r = judgeCandidate(ourMarket, { name: "Salisbury Farmers' Market", ...near(0.001, 0) });
    expect(r.ok).toBe(true);
  });

  it("refuses a same-named market in the next town", () => {
    const r = judgeCandidate(ourMarket, { name: "Salisbury Farmers' Market", ...near(0.2, 0.2) });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/away/);
  });

  it("refuses a different market at the same spot", () => {
    const r = judgeCandidate(ourMarket, { name: "Bell Tower Green Craft Fair", ...near(0, 0) });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/name too different/);
  });

  it("refuses anything Google does not call a market", () => {
    // The town name is the one word our name and a neighbour's usually share, so without this the
    // name test alone scored a perfect 1.00 for "Peacham Farmers Market" against "Peacham Café".
    for (const [type, name] of [
      ["cafe", "Salisbury Café"],
      ["park", "Salisbury Central Park"],
      ["grocery_store", "Salisbury Grocery"],
      ["gas_station", "Salisbury Fuel"],
      ["local_government_office", "Salisbury Town Clerk"],
    ]) {
      const r = judgeCandidate(ourMarket, {
        name,
        ...near(0, 0),
        primaryType: type,
        types: [type, "point_of_interest", "establishment"],
      });
      expect(r.ok).toBe(false);
      expect(r.reason).toBe(`not a market (Google calls it ${type})`);
    }
  });

  it("accepts a plain market as well as a farmers_market", () => {
    const r = judgeCandidate(ourMarket, {
      name: "Salisbury Market Hall",
      ...near(0, 0),
      primaryType: "market",
      types: ["market", "point_of_interest"],
    });
    expect(r.ok).toBe(true);
  });

  it("refuses on the name alone when we have no coordinates to check", () => {
    // Several markets share one town; a name match by itself is not evidence.
    const r = judgeCandidate(
      { name: "Salisbury Rowan Farmers Market", lat: null, lng: null },
      { name: "Salisbury Farmers' Market", ...near(0, 0) },
    );
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/no coordinates/);
  });
});

describe("pickPlace", () => {
  it("takes the best passing candidate and reports how it was judged", () => {
    const r = pickPlace(ourMarket, [
      { name: "Bell Tower Green Craft Fair", ...near(0, 0) },
      { name: "Salisbury Rowan Farmers Market", ...near(0.0005, 0) },
      { name: "Salisbury Farmers' Market", ...near(0.002, 0) },
    ]);
    expect(r.place?.name).toBe("Salisbury Rowan Farmers Market");
    expect(r.metres).toBeLessThan(200);
  });

  it("prefers a farmers_market over a generic market, whatever order Google returned them", () => {
    // Google does not answer best-first: asking for Brandon's market put "Wood's Market Garden"
    // ahead of "Brandon Farmers Market".
    const r = pickPlace(ourMarket, [
      { name: "Salisbury Market", ...near(0, 0), primaryType: "market", types: ["market"] },
      { name: "Salisbury Market", ...near(0.001, 0) },
    ]);
    expect(r.place?.primaryType).toBe("farmers_market");
  });

  it("returns no place, and why, when nothing qualifies", () => {
    const r = pickPlace(ourMarket, [{ name: "Salisbury Farmers' Market", ...near(0.5, 0.5) }]);
    expect(r.place).toBeNull();
    expect(r.reason).toMatch(/away/);
  });

  it("says so rather than throwing when the search returned nothing", () => {
    expect(pickPlace(ourMarket, []).place).toBeNull();
    expect(pickPlace(ourMarket, []).reason).toBe("no candidates");
  });
});
