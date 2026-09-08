import { describe, expect, it } from "vitest";

import {
  buildIndex as buildIndexUntyped,
  clean,
  detectDelimiter,
  num,
  parseDelimited,
  slugify,
  uniqueSlug,
} from "../scripts/lib/usda-format.mjs";

/** The helper is plain .mjs so `scripts/import-markets.mjs` can import it without a TS loader. */
type FieldIndex = Record<
  "id" | "name" | "address" | "city" | "state" | "zip" | "lat" | "lng" | "season" | "hours" | "website" | "phone" | "updated",
  number
>;
const buildIndex = buildIndexUntyped as (header: string[]) => FieldIndex;

/**
 * The importer writes thousands of rows in one pass, so a reader that quietly drops a row or a
 * slug rule that collides corrupts the directory invisibly. These cover the parts that fail
 * silently.
 */

describe("detectDelimiter", () => {
  it("picks pipe for the directory's own export", () => {
    expect(detectDelimiter("listing_id|listing_name|location_city\n1|A|B")).toBe("|");
  });

  it("falls back to comma", () => {
    expect(detectDelimiter("listing_id,listing_name,location_city\n1,A,B")).toBe(",");
  });
});

describe("parseDelimited", () => {
  it("keeps a delimiter that appears inside a quoted field", () => {
    const rows = parseDelimited('a|b|c\n1|"Smith|Jones"|3', "|");
    expect(rows[1]).toEqual(["1", "Smith|Jones", "3"]);
  });

  it("handles escaped quotes", () => {
    const rows = parseDelimited('a\n"He said ""hi"""', ",");
    expect(rows[1]).toEqual(['He said "hi"']);
  });

  it("keeps a newline inside a quoted field as part of the value", () => {
    const rows = parseDelimited('a|b\n1|"line one\nline two"', "|");
    expect(rows).toHaveLength(2);
    expect(rows[1][1]).toBe("line one\nline two");
  });

  it("tolerates CRLF and a missing trailing newline", () => {
    const rows = parseDelimited("a|b\r\n1|2\r\n3|4", "|");
    expect(rows).toEqual([
      ["a", "b"],
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("drops blank lines rather than emitting empty rows", () => {
    const rows = parseDelimited("a|b\n1|2\n\n3|4\n", "|");
    expect(rows).toHaveLength(3);
  });
});

describe("buildIndex", () => {
  it("maps the current column names", () => {
    const i = buildIndex(["listing_id", "listing_name", "location_state", "location_x"]);
    expect(i.id).toBe(0);
    expect(i.name).toBe(1);
    expect(i.state).toBe(2);
    expect(i.lng).toBe(3);
  });

  it("maps the older names the directory has also shipped", () => {
    const i = buildIndex(["FMID", "MarketName", "State", "y", "x"]);
    expect(i.id).toBe(0);
    expect(i.name).toBe(1);
    expect(i.state).toBe(2);
    expect(i.lat).toBe(3);
    expect(i.lng).toBe(4);
  });

  it("reports -1 for a field the header doesn't carry, so the caller can fail loudly", () => {
    expect(buildIndex(["listing_id", "listing_name"]).state).toBe(-1);
  });
});

describe("clean / num", () => {
  it("treats blank and the literal string 'null' as absent", () => {
    expect(clean("  ")).toBeNull();
    expect(clean("null")).toBeNull();
    expect(clean("NULL")).toBeNull();
    expect(clean(" Austin ")).toBe("Austin");
  });

  it("rejects non-numeric coordinates instead of writing NaN", () => {
    expect(num("30.2671")).toBeCloseTo(30.2671);
    expect(num("")).toBeNull();
    expect(num("n/a")).toBeNull();
  });
});

describe("slugify", () => {
  it("makes a URL-safe slug matching the markets_slug_format CHECK", () => {
    expect(slugify("Little Elm Farmers Market")).toBe("little-elm-farmers-market");
    expect(slugify("Pike Place Market & Co.")).toBe("pike-place-market-and-co");
    expect(slugify("  Downtown   Market  ")).toBe("downtown-market");
  });

  it("never leaves a leading or trailing hyphen, including after truncation", () => {
    const long = slugify("A".repeat(60) + " " + "B".repeat(60));
    expect(long.startsWith("-")).toBe(false);
    expect(long.endsWith("-")).toBe(false);
    expect(long.length).toBeLessThanOrEqual(80);
  });

  it("returns empty for a name with nothing sluggable, so the caller can skip the row", () => {
    expect(slugify("!!!")).toBe("");
  });
});

describe("uniqueSlug", () => {
  it("disambiguates a duplicate name with the city, then a counter", () => {
    const taken = new Set<string>();
    expect(uniqueSlug("Downtown Farmers Market", "Austin", taken)).toBe("downtown-farmers-market");
    expect(uniqueSlug("Downtown Farmers Market", "Dallas", taken)).toBe(
      "downtown-farmers-market-dallas",
    );
    expect(uniqueSlug("Downtown Farmers Market", "Dallas", taken)).toBe(
      "downtown-farmers-market-dallas-2",
    );
  });

  it("is deterministic, so re-importing an unchanged file keeps published URLs stable", () => {
    const run = () => {
      const taken = new Set<string>();
      return [
        uniqueSlug("Market", "Austin", taken),
        uniqueSlug("Market", "Dallas", taken),
        uniqueSlug("Market", "Dallas", taken),
      ];
    };
    expect(run()).toEqual(run());
  });

  it("returns null when there is nothing to slugify", () => {
    expect(uniqueSlug("???", null, new Set())).toBeNull();
  });
});
