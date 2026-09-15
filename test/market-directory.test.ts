import { describe, expect, it } from "vitest";

import {
  directoryHref,
  facebookToShow,
  filterMarkets,
  matchesMarket,
  parseQuery,
  parseView,
  safeWebsiteUrl,
  websiteLabel,
  websiteToShow,
} from "@/lib/markets/directory";

const market = (over: Partial<Parameters<typeof matchesMarket>[0]> = {}) => ({
  name: "Downtown Farmers Market",
  city: "Austin",
  postalCode: "78701",
  addressText: "422 Guadalupe St",
  ...over,
});

describe("matchesMarket", () => {
  it("matches everything on an empty or blank query", () => {
    expect(matchesMarket(market(), "")).toBe(true);
    expect(matchesMarket(market(), "   ")).toBe(true);
  });

  it("needs every word, across name, city, ZIP and address", () => {
    expect(matchesMarket(market(), "downtown austin")).toBe(true);
    expect(matchesMarket(market(), "downtown dallas")).toBe(false);
    expect(matchesMarket(market(), "78701")).toBe(true);
    expect(matchesMarket(market(), "guadalupe")).toBe(true);
  });

  it("ignores case, accents and punctuation", () => {
    expect(matchesMarket(market({ name: "Café Market" }), "cafe")).toBe(true);
    expect(matchesMarket(market({ name: "Farmers' Market" }), "farmers market")).toBe(true);
    expect(matchesMarket(market({ name: "Tri-County Market" }), "tri county")).toBe(true);
  });

  it("treats query characters as text, not a pattern", () => {
    expect(matchesMarket(market(), "%")).toBe(true); // punctuation-only is an empty query
    expect(matchesMarket(market(), ".*")).toBe(true);
    expect(matchesMarket(market(), "austin %")).toBe(true);
  });

  it("copes with missing city, ZIP and address", () => {
    expect(
      matchesMarket(market({ city: null, postalCode: null, addressText: null }), "downtown"),
    ).toBe(true);
  });
});

describe("filterMarkets", () => {
  it("keeps order and filters", () => {
    const list = [market({ name: "A Market" }), market({ name: "B Market", city: "Waco" })];
    expect(filterMarkets(list, "waco").map((m) => m.name)).toEqual(["B Market"]);
  });
});

describe("parseView / parseQuery", () => {
  it("defaults to the list and an empty query", () => {
    expect(parseView(undefined)).toBe("list");
    expect(parseView("map")).toBe("map");
    expect(parseView(["map"])).toBe("list");
    expect(parseQuery(undefined)).toBe("");
    expect(parseQuery("x".repeat(500))).toHaveLength(100);
  });
});

describe("directoryHref", () => {
  it("drops defaults", () => {
    expect(directoryHref("/markets/tx", { view: "list", query: "" })).toBe("/markets/tx");
  });

  it("encodes the query and keeps the view", () => {
    expect(directoryHref("/markets/tx", { view: "map", query: " sunset valley " })).toBe(
      "/markets/tx?view=map&q=sunset+valley",
    );
  });
});

describe("safeWebsiteUrl", () => {
  it("passes http(s) through", () => {
    expect(safeWebsiteUrl("https://example.org/market")).toBe("https://example.org/market");
    expect(safeWebsiteUrl("http://example.org")).toBe("http://example.org/");
  });

  it("gives a bare host http://, which the site can upgrade", () => {
    expect(safeWebsiteUrl("www.example.org")).toBe("http://www.example.org/");
  });

  it("refuses anything that is not a web page", () => {
    expect(safeWebsiteUrl("javascript:alert(1)")).toBeNull();
    expect(safeWebsiteUrl("JavaScript:alert(1)")).toBeNull();
    expect(safeWebsiteUrl("data:text/html,hi")).toBeNull();
    expect(safeWebsiteUrl("mailto:market@example.org")).toBeNull();
    expect(safeWebsiteUrl("not a url")).toBeNull();
    expect(safeWebsiteUrl("localhost")).toBeNull();
    expect(safeWebsiteUrl("")).toBeNull();
    expect(safeWebsiteUrl(null)).toBeNull();
  });
});

describe("websiteToShow", () => {
  it("links when the site is fine or nobody has decided", () => {
    expect(websiteToShow("https://market.org", "ok")).toBe("https://market.org/");
    expect(websiteToShow("https://market.org", null)).toBe("https://market.org/");
  });

  it("stops linking to a site that is gone or no longer the market's", () => {
    for (const status of ["unreachable", "parked", "taken_over", "unrelated"]) {
      expect(websiteToShow("https://market.org", status)).toBeNull();
    }
  });

  it("still refuses an unsafe address whatever the status", () => {
    expect(websiteToShow("javascript:alert(1)", "ok")).toBeNull();
  });
});

describe("facebookToShow", () => {
  it("links a Facebook page, with or without a scheme", () => {
    expect(facebookToShow("https://www.facebook.com/EveningMarketTroyTX/")).toBe(
      "https://www.facebook.com/EveningMarketTroyTX/",
    );
    expect(facebookToShow("www.facebook.com/foroakcliff")).toBe("http://www.facebook.com/foroakcliff");
  });

  it("refuses anything that is not on Facebook, or not a web link", () => {
    expect(facebookToShow("https://facebook.com.evil.example/x")).toBeNull();
    expect(facebookToShow("https://example.org/facebook")).toBeNull();
    expect(facebookToShow("javascript:alert(1)")).toBeNull();
    expect(facebookToShow(null)).toBeNull();
  });
});

describe("websiteLabel", () => {
  it("shows the host, without www, plus any path", () => {
    expect(websiteLabel("https://www.example.org/")).toBe("example.org");
    expect(websiteLabel("https://example.org/markets/downtown/")).toBe("example.org/markets/downtown");
  });

  it("shortens a long one", () => {
    expect(websiteLabel(`https://example.org/${"a".repeat(80)}`).endsWith("…")).toBe(true);
  });
});
