import { describe, expect, it } from "vitest";

import { lastPage, parseListings, splitAddress, strip } from "../scripts/lib/homesteading.mjs";

/** A listing card in the shape the directory actually emits, trimmed to the parts we read. */
const listing = ({
  name = "Salisbury Rowan Farmers Market",
  slug = "salisbury-rowan-farmers-market-2",
  address = "115 S. Jackson St. Salisbury, NC 28144",
  phone = "980-643-8863",
  zip = "28144",
  website = "http://salisburyfarmersmarket.com",
}: Partial<Record<string, string | null>> = {}) => `
<h2 class="directorist-listing-title"><a href="https://homesteading.com/directory/farmers-markets/${slug}/">${name}</a></h2>
<ul class="directorist-listing-single__info__list">
${address === null ? "" : `<li class="directorist-listing-card-address"><i class="directorist-icon-mask"></i>            Address :         ${address}</li>`}
${website === null ? "" : `<li class="directorist-listing-card-website"><i class="x"></i><a href="${website}" target="_blank">Website</a></li>`}
${zip === null ? "" : `<li class="directorist-listing-card-zip"><i class="x"></i>Zip/Post Code : ${zip}</li>`}
${phone === null ? "" : `<li class="directorist-listing-card-phone"><i class="x"></i>${phone}</li>`}
</ul>`;

describe("splitAddress", () => {
  it("reads the US postal form and recovers the town from the street", () => {
    expect(splitAddress("115 S. Jackson St. Salisbury, NC 28144")).toEqual({
      addressText: "115 S. Jackson St. Salisbury, NC 28144",
      street: "115 S. Jackson St.",
      city: "Salisbury",
      state: "NC",
      postalCode: "28144",
    });
  });

  it("reads the comma-delimited form Google hands back, with no ZIP", () => {
    expect(splitAddress("1225 3rd Street Northeast, Washington, DC, USA")).toEqual({
      addressText: "1225 3rd Street Northeast, Washington, DC",
      street: "1225 3rd Street Northeast",
      city: "Washington",
      state: "DC",
      postalCode: null,
    });
  });

  it("cuts the listing's prose off after the ZIP", () => {
    // The description is concatenated onto the address in the same element.
    const r = splitAddress(
      "115 S. Jackson St. Salisbury, NC 28144 Join us at our location across from the library!",
    );
    expect(r.addressText).toBe("115 S. Jackson St. Salisbury, NC 28144");
    expect(r.city).toBe("Salisbury");
  });

  it("does not let a direction suffix bleed into the town", () => {
    // "707 1st Ave NW, Pine City" was yielding a town of "NW, Pine City".
    expect(splitAddress("707 1st Ave NW, Pine City, MN 55063")).toMatchObject({
      city: "Pine City",
      state: "MN",
    });
  });

  it("keeps a multi-word town", () => {
    expect(splitAddress("5914 Riverdale Avenue, The Bronx, NY, USA")).toMatchObject({
      city: "The Bronx",
      state: "NY",
    });
  });

  it("strips the field's own label", () => {
    expect(splitAddress("Address : 105 E. Vallette Street Elmhurst, IL 60126")).toMatchObject({
      street: "105 E. Vallette Street",
      city: "Elmhurst",
    });
  });

  it("returns nulls rather than a guess when there is no state to be sure of", () => {
    // A lead filed under the wrong state is worse than a lead with no state.
    expect(splitAddress("Behind the old mill, by the green")).toEqual({
      addressText: "Behind the old mill, by the green",
      street: null,
      city: null,
      state: null,
      postalCode: null,
    });
    expect(splitAddress("")).toMatchObject({ state: null, addressText: null });
  });
});

describe("parseListings", () => {
  it("reads every listing on a page", () => {
    const rows = parseListings(listing() + listing({ name: "Second Market", slug: "second" }));
    expect(rows).toHaveLength(2);
    expect(rows[1].name).toBe("Second Market");
    expect(rows[1].sourceUrl).toBe("https://homesteading.com/directory/farmers-markets/second/");
  });

  it("reads the facts we came for", () => {
    const [row] = parseListings(listing());
    expect(row).toMatchObject({
      name: "Salisbury Rowan Farmers Market",
      city: "Salisbury",
      state: "NC",
      postalCode: "28144",
      phone: "980-643-8863",
      website: "http://salisburyfarmersmarket.com",
    });
  });

  it("keeps the opening bracket of a phone number", () => {
    const [row] = parseListings(listing({ phone: "(786) 620-5672" }));
    expect(row.phone).toBe("(786) 620-5672");
  });

  it("does not mistake a five-digit street number for a ZIP", () => {
    // "11000 Red Road" was being filed as ZIP 11000.
    const [row] = parseListings(
      listing({ address: "11000 Red Road, Pinecrest, FL, USA", zip: "11000" }),
    );
    expect(row.postalCode).toBeNull();
    expect(row.city).toBe("Pinecrest");
  });

  it("never returns a link back into the directory as the market's website", () => {
    const [row] = parseListings(
      listing({ website: "https://homesteading.com/directory/farmers-markets/x/" }),
    );
    expect(row.website).toBeNull();
  });

  it("survives a listing with nothing but a name", () => {
    const [row] = parseListings(listing({ address: null, phone: null, zip: null, website: null }));
    expect(row).toMatchObject({ name: "Salisbury Rowan Farmers Market", state: null, phone: null });
  });

  it("decodes the entities the directory emits", () => {
    const [row] = parseListings(listing({ name: "Cravings &#038; Crafts Farmers Market" }));
    expect(row.name).toBe("Cravings & Crafts Farmers Market");
  });

  it("takes no picture, whatever the card offers", () => {
    const withPhoto = listing().replace(
      "<ul",
      '<img src="https://homesteading.com/wp-content/uploads/2026/05/photo-4834.jpg" /><ul',
    );
    const [row] = parseListings(withPhoto);
    expect(Object.keys(row)).not.toContain("image");
    expect(JSON.stringify(row)).not.toContain("photo-4834");
  });
});

describe("lastPage", () => {
  it("takes the directory's own highest page number", () => {
    const html = `
      <a href="/farmers-markets/page/2/?x">2</a>
      <a href="/farmers-markets/page/1030/?x">Last</a>`;
    expect(lastPage(html)).toBe(1030);
  });

  it("is 1 when there is no pagination", () => {
    expect(lastPage("<p>one page</p>")).toBe(1);
  });
});

describe("strip", () => {
  it("removes tags, decodes entities and collapses whitespace", () => {
    expect(strip("<i class='x'></i>   Address :\n  Pine City&#8217;s   Market ")).toBe(
      "Address : Pine City’s Market",
    );
  });
});
