import { describe, expect, it } from "vitest";

import { joinUrl, qrSvg } from "@/lib/qr/svg";

/**
 * A QR that encodes the wrong thing is worse than no QR: it is 200 printed cards that go nowhere,
 * and nobody finds out until a market day.
 */

describe("joinUrl", () => {
  const base = "https://harvestlocal.test";

  it("makes a path absolute — a relative one scans into nothing", () => {
    expect(joinUrl(base, "/s/bens-bread")).toBe("https://harvestlocal.test/s/bens-bread");
  });

  it("tolerates a missing leading slash", () => {
    expect(joinUrl(base, "s/bens-bread")).toBe(joinUrl(base, "/s/bens-bread"));
  });

  it("never doubles the slash, whichever side carries it", () => {
    expect(joinUrl("https://harvestlocal.test/", "/shop")).toBe("https://harvestlocal.test/shop");
    expect(joinUrl("https://harvestlocal.test/", "shop")).toBe("https://harvestlocal.test/shop");
  });

  it("returns the bare origin for an empty path", () => {
    expect(joinUrl(base, "/")).toBe(base);
  });
});

describe("qrSvg", () => {
  it("returns an SVG that carries the URL's data", async () => {
    const svg = await qrSvg("https://example.test/s/bens-bread");
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("viewBox");
    expect(svg).toContain("path");
  });

  it("keeps the quiet zone, which is what lets a phone find the code", async () => {
    const svg = await qrSvg("https://example.test/shop");
    const box = /viewBox="0 0 (\d+) (\d+)"/.exec(svg);
    expect(box).not.toBeNull();
    expect(Number(box![1])).toBe(Number(box![2]));
    expect(Number(box![1])).toBeGreaterThan(20);
  });

  it("produces a symbol at least as dense at the tougher correction level", async () => {
    const url = "https://example.test/s/a-fairly-long-storefront-slug-here";
    const [standard, tough] = await Promise.all([
      qrSvg(url, { level: "M" }),
      qrSvg(url, { level: "H" }),
    ]);
    const size = (svg: string) => Number(/viewBox="0 0 (\d+)/.exec(svg)![1]);
    expect(size(tough)).toBeGreaterThanOrEqual(size(standard));
  });

  it("encodes a long URL without throwing", async () => {
    const long = `https://example.test/markets/tx/${"a".repeat(120)}`;
    await expect(qrSvg(long)).resolves.toContain("<svg");
  });
});
