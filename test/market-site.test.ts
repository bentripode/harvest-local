import { describe, expect, it } from "vitest";

import {
  decodeEntities,
  isSocialHost,
  openingHours,
  previewImage,
  robotsAllows,
  robotsRules,
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
  it("reads openingHoursSpecification, with schema.org day URLs", () => {
    const html = ld({
      "@type": "LocalBusiness",
      openingHoursSpecification: [
        { dayOfWeek: "https://schema.org/Saturday", opens: "08:00", closes: "12:00" },
        { dayOfWeek: ["Wednesday"], opens: "16:00:00", closes: "19:00:00" },
      ],
    });
    expect(openingHours(html, TODAY)).toEqual([
      { dayOfWeek: 3, opens: "16:00", closes: "19:00" },
      { dayOfWeek: 6, opens: "08:00", closes: "12:00" },
    ]);
  });

  it("reads openingHours strings, including ranges that wrap the weekend and split days", () => {
    expect(openingHours(ld({ "@type": "Store", openingHours: "Sa 8:00-12:00" }), TODAY)).toEqual([
      { dayOfWeek: 6, opens: "08:00", closes: "12:00" },
    ]);
    const wrap = openingHours(ld({ "@type": "Store", openingHours: ["Fr-Su 09:00-13:00"] }), TODAY);
    expect(wrap?.map((s) => s?.dayOfWeek)).toEqual([0, 5, 6]);
    const split = openingHours(
      ld({ "@type": "Store", openingHours: "Tu,Th 09:00-11:00,15:00-17:00" }),
      TODAY,
    );
    expect(split).toHaveLength(4);
  });

  it("finds hours inside an @graph", () => {
    const html = ld({
      "@graph": [
        { "@type": "WebSite" },
        { "@type": "LocalBusiness", openingHours: "Su 10:00-14:00" },
      ],
    });
    expect(openingHours(html, TODAY)).toEqual([{ dayOfWeek: 0, opens: "10:00", closes: "14:00" }]);
  });

  it("drops a season that has already ended", () => {
    const html = ld({
      "@type": "LocalBusiness",
      openingHoursSpecification: [
        { dayOfWeek: "Saturday", opens: "08:00", closes: "12:00", validThrough: "2025-10-31" },
      ],
    });
    expect(openingHours(html, TODAY)).toBeNull();
  });

  it("refuses the whole set when any part will not read", () => {
    const html = ld({
      "@type": "LocalBusiness",
      openingHoursSpecification: [
        { dayOfWeek: "Saturday", opens: "08:00", closes: "12:00" },
        { dayOfWeek: "Caturday", opens: "08:00", closes: "12:00" },
      ],
    });
    expect(openingHours(html, TODAY)).toBeNull();
    expect(openingHours(ld({ "@type": "Store", openingHours: "Sa sunrise-noon" }), TODAY)).toBeNull();
    expect(
      openingHours(ld({ "@type": "Store", openingHours: "Sa 22:00-02:00" }), TODAY),
    ).toBeNull(); // overnight: closes before it opens
  });

  it("refuses when a page carries more than one schedule — whose would it be?", () => {
    const html =
      ld({ "@type": "LocalBusiness", name: "North", openingHours: "Sa 08:00-12:00" }) +
      ld({ "@type": "LocalBusiness", name: "South", openingHours: "Su 09:00-13:00" });
    expect(openingHours(html, TODAY)).toBeNull();
  });

  it("ignores an Event's times, and malformed JSON", () => {
    expect(
      openingHours(ld({ "@type": "Event", openingHours: "Sa 08:00-12:00" }), TODAY),
    ).toBeNull();
    expect(
      openingHours('<script type="application/ld+json">{not json</script>', TODAY),
    ).toBeNull();
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

  it("decodes numeric and named entities", () => {
    expect(decodeEntities("a&amp;b&#x2F;c&#39;d")).toBe("a&b/c'd");
  });
});
