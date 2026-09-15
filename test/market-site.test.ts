import { describe, expect, it } from "vitest";

import {
  decodeEntities,
  isSocialHost,
  nodeNamesMarket,
  openingHours,
  pageVerdict,
  previewImage,
  robotsAllows,
  robotsRules,
  siteKey,
  siteUrl,
} from "../scripts/lib/market-site.mjs";

const ld = (obj: unknown) => `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;
const TODAY = "2026-09-14";

describe("previewImage", () => {
  it("takes og:image, whichever order the attributes come in", () => {
    expect(
      previewImage('<meta property="og:image" content="https://a.org/x.jpg">', "https://a.org/"),
    ).toBe("https://a.org/x.jpg");
    expect(
      previewImage('<meta content="https://a.org/y.jpg" property="og:image" />', "https://a.org/"),
    ).toBe("https://a.org/y.jpg");
  });

  it("resolves a relative address against the page and decodes entities", () => {
    expect(
      previewImage(
        '<meta property="og:image" content="/img/hero.jpg?a=1&amp;b=2">',
        "https://market.org/about/",
      ),
    ).toBe("https://market.org/img/hero.jpg?a=1&b=2");
  });

  it("prefers the secure URL, then falls back to twitter:image", () => {
    expect(
      previewImage(
        '<meta property="og:image" content="http://a.org/x.jpg"><meta property="og:image:secure_url" content="https://a.org/x.jpg">',
        "https://a.org/",
      ),
    ).toBe("https://a.org/x.jpg");
    expect(
      previewImage('<meta name="twitter:image" content="https://a.org/t.jpg">', "https://a.org/"),
    ).toBe("https://a.org/t.jpg");
  });

  it("falls back to the organisation's own image in JSON-LD, not an Event's", () => {
    expect(
      previewImage(ld({ "@type": "Organization", logo: "https://a.org/logo.png" }), "https://a.org/"),
    ).toBe("https://a.org/logo.png");
    expect(
      previewImage(ld({ "@type": "Event", image: "https://a.org/concert.jpg" }), "https://a.org/"),
    ).toBeNull();
  });

  it("never takes an image from the page body, and refuses non-web schemes", () => {
    expect(previewImage('<img src="https://a.org/sponsor.png">', "https://a.org/")).toBeNull();
    expect(
      previewImage('<meta property="og:image" content="javascript:alert(1)">', "https://a.org/"),
    ).toBeNull();
  });
});

describe("openingHours", () => {
  const M = "Dallas Farmers Market";
  const biz = (extra: Record<string, unknown>) => ({ "@type": "LocalBusiness", name: M, ...extra });

  it("reads openingHoursSpecification, with schema.org day URLs", () => {
    const html = ld(
      biz({
        openingHoursSpecification: [
          { dayOfWeek: "https://schema.org/Saturday", opens: "08:00", closes: "12:00" },
          { dayOfWeek: ["Wednesday"], opens: "16:00:00", closes: "19:00:00" },
        ],
      }),
    );
    expect(openingHours(html, M, TODAY)).toEqual([
      { dayOfWeek: 3, opens: "16:00", closes: "19:00" },
      { dayOfWeek: 6, opens: "08:00", closes: "12:00" },
    ]);
  });

  it("reads openingHours strings, including ranges that wrap the weekend and split days", () => {
    expect(openingHours(ld(biz({ openingHours: "Sa 8:00-12:00" })), M, TODAY)).toEqual([
      { dayOfWeek: 6, opens: "08:00", closes: "12:00" },
    ]);
    const wrap = openingHours(ld(biz({ openingHours: ["Fr-Su 09:00-13:00"] })), M, TODAY);
    expect(wrap?.map((s) => s?.dayOfWeek)).toEqual([0, 5, 6]);
    const split = openingHours(ld(biz({ openingHours: "Tu,Th 09:00-11:00,15:00-17:00" })), M, TODAY);
    expect(split).toHaveLength(4);
  });

  it("finds hours inside an @graph", () => {
    const html = ld({ "@graph": [{ "@type": "WebSite" }, biz({ openingHours: "Su 10:00-14:00" })] });
    expect(openingHours(html, M, TODAY)).toEqual([{ dayOfWeek: 0, opens: "10:00", closes: "14:00" }]);
  });

  it("ignores a site-wide block that names someone else — the food bank's office hours", () => {
    const html = ld({
      "@type": "Organization",
      name: "The Food Bank of the Golden Crescent",
      openingHours: ["Mo-Fr 08:00-12:00", "Mo-Fr 13:00-16:30"],
    });
    expect(openingHours(html, "Victoria Farmers' Market", TODAY)).toBeNull();
  });

  it("ignores a block with no name at all — nothing ties it to the market", () => {
    expect(openingHours(ld({ "@type": "Store", openingHours: "Sa 08:00-12:00" }), M, TODAY)).toBeNull();
  });

  it("drops a season that has already ended", () => {
    const html = ld(
      biz({
        openingHoursSpecification: [
          { dayOfWeek: "Saturday", opens: "08:00", closes: "12:00", validThrough: "2025-10-31" },
        ],
      }),
    );
    expect(openingHours(html, M, TODAY)).toBeNull();
  });

  it("refuses the whole set when any part will not read", () => {
    const html = ld(
      biz({
        openingHoursSpecification: [
          { dayOfWeek: "Saturday", opens: "08:00", closes: "12:00" },
          { dayOfWeek: "Caturday", opens: "08:00", closes: "12:00" },
        ],
      }),
    );
    expect(openingHours(html, M, TODAY)).toBeNull();
    expect(openingHours(ld(biz({ openingHours: "Sa sunrise-noon" })), M, TODAY)).toBeNull();
    expect(openingHours(ld(biz({ openingHours: "Sa 22:00-02:00" })), M, TODAY)).toBeNull(); // overnight
  });

  it("refuses when a page carries more than one matching schedule — whose would it be?", () => {
    const html = ld(biz({ openingHours: "Sa 08:00-12:00" })) + ld(biz({ openingHours: "Su 09:00-13:00" }));
    expect(openingHours(html, M, TODAY)).toBeNull();
  });

  it("ignores an Event's times, and malformed JSON", () => {
    expect(openingHours(ld({ "@type": "Event", name: M, openingHours: "Sa 08:00-12:00" }), M, TODAY)).toBeNull();
    expect(openingHours('<script type="application/ld+json">{not json</script>', M, TODAY)).toBeNull();
  });
});

describe("nodeNamesMarket", () => {
  it("matches when one set of distinctive words contains the other", () => {
    expect(nodeNamesMarket("Dallas Farmers Market", "Dallas Farmers Market")).toBe(true);
    expect(nodeNamesMarket("Texas Farmers' Market", "Texas Farmers' Market at Mueller")).toBe(true);
    expect(nodeNamesMarket("The Food Bank of the Golden Crescent", "Victoria Farmers' Market")).toBe(false);
  });

  it("cannot confirm a market whose name is only generic words", () => {
    expect(nodeNamesMarket("Downtown Farmers Market", "Downtown Farmers Market")).toBe(false);
  });
});

describe("pageVerdict", () => {
  // Real pages run to thousands of characters; a fixture of one line would read as "unreadable".
  // The filler is deliberately free of market vocabulary so it cannot make a verdict come out "ok".
  const FILLER = " <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>".repeat(10);
  const page = (title: string, body = "") =>
    `<html><head><title>${title}</title></head><body>${body}${FILLER}</body></html>`;

  it("recognises a registrar's for-sale page, by host or by wording", () => {
    expect(pageVerdict(page("x"), "https://www.hugedomains.com/domain_profile.cfm?d=katy", "Katy Farmers' Market")).toBe("parked");
    expect(pageVerdict(page("KatyFarmersMarket.com is for sale | HugeDomains", "Katy Farmers Market"), "https://katyfarmersmarket.com/", "Katy Farmers' Market")).toBe("parked");
  });

  it("recognises gambling spam on a lapsed market domain", () => {
    expect(
      pageVerdict(page("WINSTAR4D : Akses Resmi Situs Toto Togel Online"), "https://winstar4d-blue.com/", "For Oak Cliff Farmers Market"),
    ).toBe("taken_over");
    expect(
      pageVerdict(page("HOKI123 - Slot Deposit 1000 Gacor"), "https://thebeverlylounge.com/", "Hutto Silos Farmers Market"),
    ).toBe("taken_over");
  });

  it("calls a page unrelated when it mentions neither the market nor a farmers market", () => {
    expect(
      pageVerdict(page("Sweetmagnoliamarket - Asphalte, cylindres et pulsations mécaniques", "actualité automobile"), "https://sweetmagnoliamarket.com/", "Sweet Magnolia Market"),
    ).toBe("unrelated");
    expect(pageVerdict(page("Welcome to focfarmersmarket.org"), "https://x.org/", "For Oak Cliff Farmers Market")).toBe("unrelated");
  });

  it("is not fooled when the domain's new owner keeps the market's name as their brand", () => {
    const carBlog = page(
      "Sweetmagnoliamarket - Asphalte, cylindres et pulsations mécaniques",
      "Sweet Magnolia Market vous propose des analyses approfondies, des essais et comparatifs. Pourquoi consulter Sweet Magnolia Market ? Voiture, sécurité.",
    );
    expect(pageVerdict(carBlog, "https://sweetmagnoliamarket.com/", "Sweet Magnolia Market")).toBe("unrelated");
    const keptName = page("For Oak Cliff Farmers Market", "Best online deals on electronics");
    expect(pageVerdict(keptName, "https://focfarmersmarket.org/", "For Oak Cliff Farmers Market")).toBe("unrelated");
  });

  it("gives no verdict on a page it cannot read, rather than calling it someone else's", () => {
    const empty = "<html><head></head><body><div id=\"root\"></div><script>render()</script></body></html>";
    expect(pageVerdict(empty, "https://www.austinfarmersmarket.org/", "Austin Farmers Market Association I")).toBe(
      "unreadable",
    );
    // …but spam and for-sale pages are still recognised however short they are.
    expect(pageVerdict(page("Togel online"), "https://x.site/", "X Market")).toBe("taken_over");
  });

  it("accepts a page that says farmers market, or names the market and says market", () => {
    expect(pageVerdict(page("Barton Creek Farmers Market - Austin&#039;s Original Farmers Market"), "https://bartoncreekfarmersmarket.org/", "Barton Creek Farmers Market")).toBe("ok");
    expect(pageVerdict(page("Amarillo Community Market", "Handmade. Homegrown."), "https://amarillocommunitymarket.weebly.com/", "Amarillo Community Market")).toBe("ok");
    expect(pageVerdict(page("Farmers’ market every Saturday"), "https://x.org/", "Anything")).toBe("ok");
  });

  it("does not let a vendor slot or a market report read as spam", () => {
    expect(pageVerdict(page("Book a vendor slot", "Farmers market, Saturdays"), "https://x.org/", "X Farmers Market")).toBe("ok");
  });
});

describe("robots.txt", () => {
  const txt = `
User-agent: *
Disallow: /private/
Allow: /private/ok.html
Disallow: /*.pdf$

User-agent: HarvestLocalBot
Disallow: /nobots/
`;

  it("uses our own group when one names us, instead of *", () => {
    const rules = robotsRules(txt, "HarvestLocalBot/1.0");
    expect(robotsAllows(rules, "/private/x")).toBe(true);
    expect(robotsAllows(rules, "/nobots/x")).toBe(false);
  });

  it("applies * with longest-match, Allow winning ties, wildcards and $", () => {
    const rules = robotsRules(txt, "SomeOtherBot");
    expect(robotsAllows(rules, "/")).toBe(true);
    expect(robotsAllows(rules, "/private/x")).toBe(false);
    expect(robotsAllows(rules, "/private/ok.html")).toBe(true);
    expect(robotsAllows(rules, "/docs/a.pdf")).toBe(false);
    expect(robotsAllows(rules, "/docs/a.pdf?x=1")).toBe(true);
  });

  it("treats Disallow: / as everything, and an empty Disallow as nothing", () => {
    expect(robotsAllows(robotsRules("User-agent: *\nDisallow: /", "x"), "/")).toBe(false);
    expect(robotsAllows(robotsRules("User-agent: *\nDisallow:", "x"), "/")).toBe(true);
  });

  it("matches our product token exactly, not as a substring", () => {
    const rules = robotsRules("User-agent: bot\nDisallow: /\n\nUser-agent: *\nAllow: /", "HarvestLocalBot/1.0 (+https://x)");
    expect(robotsAllows(rules, "/")).toBe(true);
  });

  it("lets consecutive User-agent lines share one group", () => {
    const rules = robotsRules("User-agent: a\nUser-agent: harvestlocalbot\nDisallow: /", "HarvestLocalBot");
    expect(robotsAllows(rules, "/")).toBe(false);
  });
});

describe("site selection", () => {
  it("skips social platforms", () => {
    expect(isSocialHost("www.facebook.com")).toBe(true);
    expect(isSocialHost("m.facebook.com")).toBe(true);
    expect(isSocialHost("instagram.com")).toBe(true);
    expect(isSocialHost("facebookmarketfarm.org")).toBe(false);
  });

  it("reads a website value the way the directory card does", () => {
    expect(siteUrl("www.market.org")?.toString()).toBe("http://www.market.org/");
    expect(siteUrl("javascript:alert(1)")).toBeNull();
    expect(siteUrl("")).toBeNull();
  });

  it("keys a site so the same page is recognised however it was typed", () => {
    expect(siteKey("http://www.GoodLocalMarkets.org/")).toBe("goodlocalmarkets.org");
    expect(siteKey("goodlocalmarkets.org")).toBe("goodlocalmarkets.org");
    expect(siteKey("https://example.org/markets/north/")).toBe("example.org/markets/north");
    expect(siteKey("https://example.org/markets/north")).not.toBe(siteKey("https://example.org/markets/south"));
    expect(siteKey("javascript:x")).toBeNull();
  });

  it("decodes numeric and named entities", () => {
    expect(decodeEntities("a&amp;b&#x2F;c&#39;d")).toBe("a&b/c'd");
  });
});
