import { describe, expect, it } from "vitest";

import {
  cleanAuthor,
  distinctiveTokens,
  isPhotograph,
  licenceAllows,
  pickCommonsPhoto,
  placeAgrees,
  titleMatchesMarket,
} from "../scripts/lib/commons-match.mjs";

/** Madison, WI — where the Dane County market actually is. */
const daneCounty = {
  name: "Dane County Farmers Market",
  city: "Madison",
  lat: 43.0747,
  lng: -89.3844,
};

const file = (over: Record<string, unknown> = {}) => ({
  title: "File:Dane county farmers market.JPG",
  licence: "CC BY-SA 3.0",
  author: "A Photographer",
  descriptionUrl: "https://commons.wikimedia.org/wiki/File:Dane_county_farmers_market.JPG",
  width: 2048,
  height: 1536,
  lat: 43.0748,
  lng: -89.3845,
  ...over,
});

describe("licenceAllows", () => {
  it("accepts the free licences Commons actually uses", () => {
    for (const l of [
      "CC0",
      "CC BY 2.0",
      "CC BY-SA 3.0",
      "CC BY-SA 4.0",
      "Public domain",
      "PD-US",
    ]) {
      expect(licenceAllows(l)).toBe(true);
    }
  });

  it("refuses anything a commercial marketplace may not use", () => {
    // A marketplace is a commercial use, so NC does not cover us; ND forbids the crop we make.
    for (const l of [
      "CC BY-NC 4.0",
      "CC BY-NC-SA 3.0",
      "CC BY-ND 4.0",
      "Fair use",
      "Copyrighted",
      "",
    ]) {
      expect(licenceAllows(l)).toBe(false);
    }
    expect(licenceAllows(null)).toBe(false);
  });
});

describe("titleMatchesMarket", () => {
  it("accepts a title carrying every identifying word plus 'market'", () => {
    expect(
      titleMatchesMarket("Dane County Farmers Market", "File:Dane county farmers market.JPG"),
    ).toBe(true);
    expect(
      titleMatchesMarket("Ann Arbor Farmers Market", "File:Ann Arbor 2013 (Farmer's Market).jpg"),
    ).toBe(true);
  });

  it("refuses the book scan that merely contains the words", () => {
    // A real result for "Brattleboro Farmers Market".
    expect(
      titleMatchesMarket(
        "Brattleboro Farmers Market",
        "File:Illustrated Catalogue of Cottage Organs (Brattleboro).jpg",
      ),
    ).toBe(false);
  });

  it("refuses a picture of the place that is not of its market", () => {
    // Without the "market" test this passes, and we publish a courthouse.
    expect(
      titleMatchesMarket("Dane County Farmers Market", "File:Dane County Courthouse.jpg"),
    ).toBe(false);
  });

  it("refuses a market in a different town", () => {
    expect(titleMatchesMarket("Dorset Farmers Market", "File:Portland farmers market.jpg")).toBe(
      false,
    );
  });

  it("refuses when the market's name carries no identifying word at all", () => {
    expect(titleMatchesMarket("The Farmers Market", "File:A farmers market.jpg")).toBe(false);
  });
});

describe("isPhotograph", () => {
  it("takes raster images only", () => {
    expect(isPhotograph("File:X market.jpg")).toBe(true);
    expect(isPhotograph("File:X market.png")).toBe(true);
    expect(isPhotograph("File:X market logo.svg")).toBe(false);
    expect(isPhotograph("File:X market plan.pdf")).toBe(false);
  });
});

describe("placeAgrees", () => {
  it("accepts a photograph taken at the market", () => {
    expect(placeAgrees(daneCounty, file()).ok).toBe(true);
  });

  it("refuses the same-named market on another continent", () => {
    // "East Town Market" in Milwaukee matched "Downham Market - Town Hall - east side", Norfolk.
    const norfolk = file({ lat: 52.6, lng: 0.38 });
    const r = placeAgrees(daneCounty, norfolk);
    expect(r.ok).toBe(false);
    expect(r.how).toMatch(/away/);
  });

  it("refuses a file with no coordinates, however well the town name matches", () => {
    // The town-name fallback produced every bad match in the first national sample: a market in
    // Petersburg, ALASKA took a photo of Petersburg, VIRGINIA, and "Arab Farmers' Market" in Arab,
    // Alabama took a photo of Arab farmers near Tel Aviv. A town name is not a location.
    const r = placeAgrees(
      daneCounty,
      file({ lat: null, lng: null, title: "File:Madison market.jpg" }),
    );
    expect(r.ok).toBe(false);
    expect(r.how).toMatch(/no coordinates/);
  });

  it("refuses a different market across the same town", () => {
    // "HoneySuckle Market, Dothan" was taken as the picture for another Dothan market 1.6km away.
    const r = placeAgrees(daneCounty, file({ lat: 43.0892, lng: -89.3844 }));
    expect(r.ok).toBe(false);
  });
});

describe("pickCommonsPhoto", () => {
  it("takes the largest publishable candidate", () => {
    const r = pickCommonsPhoto(daneCounty, [
      file({ width: 800, height: 600 }),
      file({ title: "File:Dane county farmers market 2.jpg", width: 3000, height: 2000 }),
    ]);
    expect(r.photo?.title).toBe("File:Dane county farmers market 2.jpg");
    expect(r.photo?.how).toMatch(/m away/);
  });

  it("refuses an unusable licence and says so", () => {
    const r = pickCommonsPhoto(daneCounty, [file({ licence: "CC BY-NC 4.0" })]);
    expect(r.photo).toBeNull();
    expect(r.reason).toMatch(/licence/);
  });

  it("refuses a file with no author, because the credit is the licence", () => {
    const r = pickCommonsPhoto(daneCounty, [file({ author: null })]);
    expect(r.photo).toBeNull();
    expect(r.reason).toMatch(/author/);
  });

  it("refuses something too small to be a card image", () => {
    const r = pickCommonsPhoto(daneCounty, [file({ width: 200, height: 150 })]);
    expect(r.photo).toBeNull();
    expect(r.reason).toMatch(/small/);
  });

  it("refuses a title that is not this market", () => {
    const r = pickCommonsPhoto({ ...daneCounty, name: "Glover Farmers Market" }, [file()]);
    expect(r.photo).toBeNull();
    expect(r.reason).toMatch(/not this market/);
  });

  it("refuses a title that matches but a place that does not", () => {
    // The whole reason placeAgrees exists: one common word matches the world.
    const r = pickCommonsPhoto(
      { name: "East Town Market", city: "Milwaukee", lat: 43.0389, lng: -87.9065 },
      [file({ title: "File:Downham Market - Town Hall - east side.jpg", lat: 52.6, lng: 0.38 })],
    );
    expect(r.photo).toBeNull();
    expect(r.reason).toMatch(/wrong place/);
  });

  it("says so rather than throwing when the search found nothing", () => {
    expect(pickCommonsPhoto(daneCounty, []).photo).toBeNull();
    expect(pickCommonsPhoto(daneCounty, []).reason).toBe("no candidates");
  });
});

describe("cleanAuthor", () => {
  it("unwraps the link Commons stores the author inside", () => {
    expect(
      cleanAuthor('<a href="//commons.wikimedia.org/wiki/User:Bob" title="User:Bob">Bob</a>'),
    ).toBe("Bob");
  });

  it("decodes entities and collapses whitespace", () => {
    expect(cleanAuthor("Jo &amp;  Sam\n Smith")).toBe("Jo & Sam Smith");
  });

  it("is null when there is no author to credit", () => {
    expect(cleanAuthor("")).toBeNull();
    expect(cleanAuthor(null)).toBeNull();
  });
});

describe("distinctiveTokens", () => {
  it("drops the words every market shares", () => {
    expect([...distinctiveTokens("Dane County Farmers Market")]).toEqual(["dane"]);
    expect([...distinctiveTokens("Downtown Community Farmers' Market")]).toEqual([]);
  });
});
