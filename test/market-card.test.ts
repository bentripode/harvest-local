import { describe, expect, it } from "vitest";

import {
  inSeason,
  marketInitials,
  parseSeason,
  tileMotif,
  tileTone,
  todayLabel,
  todayStatus,
  type Season,
} from "@/lib/markets/card";
import type { MarketHour } from "@/lib/markets/schedule";

/** Local-time constructor — every assertion here is wall-clock, never UTC. */
const at = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min);

/** The `months` shape, so a change to it does not rewrite every expectation below. */
const range = (
  from: number,
  to: number,
  fromDay: number | null = null,
  toDay: number | null = null,
): Season => ({ kind: "months", from, to, fromDay, toDay });

const sat9to1: MarketHour = {
  dayOfWeek: 6,
  opens: "09:00:00",
  closes: "13:00:00",
};
const wed16to19: MarketHour = {
  dayOfWeek: 3,
  opens: "16:00:00",
  closes: "19:00:00",
};

// 2026-09-19 is a Saturday; 2026-01-17 a Saturday in winter.
const satMorning = at(2026, 9, 19, 10, 30);
const satBefore = at(2026, 9, 19, 7, 0);
const satAfter = at(2026, 9, 19, 18, 0);
const winterSat = at(2026, 1, 17, 10, 30);

describe("parseSeason", () => {
  it("reads the year-round phrasings the directory actually uses", () => {
    for (const note of [
      "Year-round",
      "Year-round, rain or shine",
      "year round produce market",
      "Indoor vendor market, open daily",
      "Open every day of the year at 344 Finley Ave W, Birmingham",
      "Year-round, except two weeks over Christmas and New Year",
    ]) {
      expect(parseSeason(note)).toEqual({ kind: "year_round" });
    }
  });

  it("reads a two-month range, long or abbreviated", () => {
    expect(parseSeason("May to October")).toEqual(range(4, 9));
    expect(parseSeason("May through September")).toEqual(range(4, 8));
    expect(parseSeason("June to September")).toEqual(range(5, 8));
  });

  it("keeps the day of the month when the note gives one", () => {
    expect(parseSeason("May 1 to October 31, 2026, 5178 NYS Route 41 Homer")).toEqual(
      range(4, 9, 1, 31),
    );
    expect(parseSeason("Jun 3 to Sep 30, 2026, Currier Park")).toEqual(range(5, 8, 3, 30));
    expect(parseSeason("Late May to Sep 10, 2026")).toEqual(range(4, 8, null, 10));
  });

  it("does not read a year as a day of the month", () => {
    expect(parseSeason("May to Oct 2026")).toEqual(range(4, 9));
  });

  it("keeps a range that wraps the new year", () => {
    expect(parseSeason("October to July")).toEqual(range(9, 6));
  });

  it("refuses a note describing more than one arrangement", () => {
    // Four month names: we cannot tell which schedule the hours we hold belong to.
    expect(parseSeason("Weekly April to December; 2nd and 4th Saturdays January to March")).toEqual(
      {
        kind: "unknown",
      },
    );
  });

  it("refuses prose that names no month, and a bare pair with no range word", () => {
    expect(parseSeason("Spring through fall (wholesale hours)")).toEqual({
      kind: "unknown",
    });
    expect(parseSeason("Closed May, reopening October")).toEqual({
      kind: "unknown",
    });
    expect(parseSeason(null)).toEqual({ kind: "unknown" });
    expect(parseSeason("")).toEqual({ kind: "unknown" });
  });

  it("does not mistake a word that merely starts like a month", () => {
    expect(parseSeason("Marching band plays; Augusta Commons")).toEqual({
      kind: "unknown",
    });
  });
});

describe("inSeason", () => {
  it("closes on the day the note gives, not at the end of that month", () => {
    // A real Vermont note. On 16 September a month-only reading called this market open; its
    // season had ended six days earlier.
    const season = parseSeason("Late May to Sep 10, 2026, St. Rose of Lima Church");
    expect(inSeason(season, at(2026, 9, 9))).toBe(true);
    expect(inSeason(season, at(2026, 9, 10))).toBe(true);
    expect(inSeason(season, at(2026, 9, 16))).toBe(false);
  });

  it("opens on the day the note gives", () => {
    const season = parseSeason("Jun 3 to Sep 30, 2026, Currier Park");
    expect(inSeason(season, at(2026, 6, 2))).toBe(false);
    expect(inSeason(season, at(2026, 6, 3))).toBe(true);
    expect(inSeason(season, at(2026, 9, 30))).toBe(true);
  });

  it("reads a month with no day generously at both ends", () => {
    const season = parseSeason("May to October");
    expect(inSeason(season, at(2026, 5, 1))).toBe(true);
    expect(inSeason(season, at(2026, 10, 31))).toBe(true);
    expect(inSeason(season, at(2026, 4, 30))).toBe(false);
  });

  it("handles a range that wraps the new year", () => {
    const winter = parseSeason("October to July");
    expect(inSeason(winter, at(2026, 1, 15))).toBe(true);
    expect(inSeason(winter, at(2026, 11, 15))).toBe(true);
    expect(inSeason(winter, at(2026, 8, 15))).toBe(false);
  });

  it("treats an unknown season as not confirmed, never as a yes", () => {
    expect(inSeason({ kind: "unknown" }, satMorning)).toBe(false);
  });
});

describe("todayStatus", () => {
  it("says open now inside the slot, and nothing once it has closed", () => {
    expect(todayStatus([sat9to1], satMorning, "Year-round")).toEqual({
      kind: "open_now",
      until: "1:00 PM",
      confirmed: true,
    });
    expect(todayStatus([sat9to1], satAfter, "Year-round")).toBeNull();
  });

  it("says open later before the slot opens", () => {
    expect(todayStatus([sat9to1], satBefore, "Year-round")).toEqual({
      kind: "open_later",
      span: "9:00 AM – 1:00 PM",
      confirmed: true,
    });
  });

  it("ignores slots on other days", () => {
    expect(todayStatus([wed16to19], satMorning, "Year-round")).toBeNull();
  });

  it("makes no claim at all when the season we can read excludes today", () => {
    // The whole point: a May-October market must not be badged on a January Saturday.
    expect(todayStatus([sat9to1], winterSat, "May to October")).toBeNull();
  });

  it("makes no claim once a dated season has ended", () => {
    expect(todayStatus([sat9to1], at(2026, 9, 19, 10, 0), "Jun 3 to Sep 10, 2026")).toBeNull();
    expect(todayStatus([sat9to1], at(2026, 9, 5, 10, 0), "Jun 3 to Sep 10, 2026")?.confirmed).toBe(
      true,
    );
  });

  it("downgrades rather than drops the claim when the season is unreadable", () => {
    const status = todayStatus([sat9to1], satMorning, "Spring through fall");
    expect(status).toEqual({
      kind: "open_now",
      until: "1:00 PM",
      confirmed: false,
    });
    expect(todayLabel(status!)).toBe("Probably open now · until 1:00 PM");
  });

  it("downgrades on a winter Saturday too, since an unreadable season may have ended", () => {
    const status = todayStatus([sat9to1], at(2026, 1, 17, 7, 0), null);
    expect(status?.confirmed).toBe(false);
    expect(todayLabel(status!)).toBe("Usually open today · 9:00 AM – 1:00 PM");
  });

  it("makes no claim when nobody has recorded any hours", () => {
    expect(todayStatus([], satMorning, "Year-round")).toBeNull();
  });

  it("picks the earliest of several slots still to come today", () => {
    const evening: MarketHour = {
      dayOfWeek: 6,
      opens: "17:00",
      closes: "20:00",
    };
    const status = todayStatus([evening, sat9to1], satBefore, "Year-round");
    expect(status).toEqual({
      kind: "open_later",
      span: "9:00 AM – 1:00 PM",
      confirmed: true,
    });
  });

  it("falls back to the note carried on the hours themselves", () => {
    const seasonal: MarketHour = { ...sat9to1, note: "May to October" };
    expect(todayStatus([seasonal], winterSat)).toBeNull();
    expect(todayStatus([seasonal], satMorning)?.confirmed).toBe(true);
  });
});

describe("marketInitials", () => {
  it("skips the words nearly every market shares", () => {
    expect(marketInitials("Haven Farmers Market")).toBe("H");
    expect(marketInitials("Colwich Farmers Market")).toBe("C");
    expect(marketInitials("Kingman Farmers Market @ The Binyard")).toBe("KB");
    expect(marketInitials("Denton Community Market")).toBe("DC");
  });

  it("falls back rather than returning nothing when every word is skipped", () => {
    expect(marketInitials("The Farmers Market")).toBe("TF");
  });

  it("skips a street number, which is not an initial", () => {
    // "6701 Burnet Road Market" was rendering a tile reading "6B".
    expect(marketInitials("6701 Burnet Road Market")).toBe("BR");
    expect(marketInitials("4th Street Market")).toBe("4S");
  });

  it("treats a hyphenated name as the one word it is", () => {
    // "Winston-Salem" is a place, not two; "WS" would read as two unrelated initials.
    expect(marketInitials("Winston-Salem Farmers Market")).toBe("W");
  });

  it("survives punctuation, accents and extra spacing", () => {
    expect(marketInitials("  Café  Bergen  Market ")).toBe("CB");
    expect(marketInitials("St. Paul's Growers Market")).toBe("SP");
  });
});

describe("tileTone", () => {
  it("is stable for a slug and inside the range", () => {
    for (const slug of ["ada-farmers-market", "aitkin-farmers-market", "zzz"]) {
      const tone = tileTone(slug, 4);
      expect(tone).toBe(tileTone(slug, 4));
      expect(tone).toBeGreaterThanOrEqual(0);
      expect(tone).toBeLessThan(4);
    }
  });

  it("spreads similar neighbouring slugs across the tones", () => {
    // The stories rotation shipped a bug where short similar ids clustered; assert it is not back.
    const slugs = Array.from({ length: 60 }, (_, i) => `city-${i}-farmers-market`);
    const used = new Set(slugs.map((s) => tileTone(s, 4)));
    expect(used.size).toBe(4);
  });

  it("is unchanged by an empty salt, so the existing tones do not all shuffle", () => {
    expect(tileTone("ada-farmers-market", 4)).toBe(tileTone("ada-farmers-market", 4, ""));
  });
});

describe("tileMotif", () => {
  it("is stable for a slug and inside the range", () => {
    for (const slug of ["ada-farmers-market", "dorset-farmers-market", "zzz"]) {
      const m = tileMotif(slug, 5);
      expect(m).toBe(tileMotif(slug, 5));
      expect(m).toBeGreaterThanOrEqual(0);
      expect(m).toBeLessThan(5);
    }
  });

  it("does not track the tone, so a page reads as 20 tiles rather than 5", () => {
    // Salted apart on purpose. If motif were a function of tone, every amber tile would carry the
    // same drawing and the grid would look like five cards repeated.
    const slugs = Array.from({ length: 400 }, (_, i) => `market-${i}-farmers-market`);
    const pairs = new Set(slugs.map((s) => `${tileTone(s, 4)}:${tileMotif(s, 5)}`));
    expect(pairs.size).toBe(20);
  });

  it("puts the salt where FNV can still see it", () => {
    // Appending the salt barely moves an FNV accumulator — the bug stories/select.ts records — so
    // a salted index must actually differ from the unsalted one for most inputs.
    const slugs = Array.from({ length: 200 }, (_, i) => `market-${i}`);
    const differing = slugs.filter((s) => tileTone(s, 5) !== tileMotif(s, 5)).length;
    expect(differing).toBeGreaterThan(120);
  });
});
