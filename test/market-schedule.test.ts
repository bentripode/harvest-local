import { describe, expect, it } from "vitest";

import {
  formatOccurrence,
  formatTime,
  nextOccurrence,
  shortSummary,
  summarizeHours,
  toMinutes,
  type MarketHour,
} from "@/lib/markets/schedule";

const sat9to3: MarketHour = { dayOfWeek: 6, opens: "09:00:00", closes: "15:00:00" };
const wed4to7: MarketHour = { dayOfWeek: 3, opens: "16:00:00", closes: "19:00:00" };

/** Local-time constructor — these are wall-clock assertions, never UTC. */
const at = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min);

describe("toMinutes", () => {
  it("parses both stored shapes", () => {
    expect(toMinutes("09:00")).toBe(540);
    expect(toMinutes("09:00:00")).toBe(540);
    expect(toMinutes("00:00")).toBe(0);
    expect(toMinutes("23:59")).toBe(1439);
  });

  it("rejects nonsense rather than coercing it", () => {
    expect(toMinutes("")).toBeNull();
    expect(toMinutes("9am")).toBeNull();
    expect(toMinutes("24:00")).toBeNull();
    expect(toMinutes("09:60")).toBeNull();
  });
});

describe("formatTime", () => {
  it("renders 12-hour clock with the noon/midnight edges right", () => {
    expect(formatTime("09:00:00")).toBe("9:00 AM");
    expect(formatTime("12:00:00")).toBe("12:00 PM");
    expect(formatTime("00:00:00")).toBe("12:00 AM");
    expect(formatTime("13:30:00")).toBe("1:30 PM");
    expect(formatTime("23:05:00")).toBe("11:05 PM");
  });

  it("passes an unparseable value through untouched", () => {
    expect(formatTime("dawn")).toBe("dawn");
  });
});

describe("summarizeHours", () => {
  it("orders by day then opening time", () => {
    expect(summarizeHours([sat9to3, wed4to7])).toEqual([
      "Wednesday · 4:00 PM – 7:00 PM",
      "Saturday · 9:00 AM – 3:00 PM",
    ]);
  });

  it("is empty when nobody has recorded a schedule", () => {
    expect(summarizeHours([])).toEqual([]);
  });
});

describe("shortSummary", () => {
  it("returns null with no hours, so callers can say 'unknown' instead of 'closed'", () => {
    expect(shortSummary([])).toBeNull();
  });

  it("counts the overflow rather than truncating silently", () => {
    const hours: MarketHour[] = [
      sat9to3,
      wed4to7,
      { dayOfWeek: 1, opens: "08:00", closes: "12:00" },
    ];
    expect(shortSummary(hours, 2)).toBe("Mon · 8:00 AM – 12:00 PM, Wed · 4:00 PM – 7:00 PM +1 more");
  });
});

describe("nextOccurrence", () => {
  it("returns null when there are no hours", () => {
    expect(nextOccurrence([], at(2026, 9, 8))).toBeNull();
  });

  it("finds the coming Saturday from a Tuesday", () => {
    // 2026-09-08 is a Tuesday.
    const occ = nextOccurrence([sat9to3], at(2026, 9, 8, 10));
    expect(occ).not.toBeNull();
    expect(occ!.date.getDay()).toBe(6);
    expect(occ!.date.getDate()).toBe(12);
    expect(occ!.openNow).toBe(false);
    expect(formatOccurrence(occ!)).toBe("Sat, Sep 12 · 9:00 AM – 3:00 PM");
  });

  it("reports open-now while inside the slot", () => {
    const occ = nextOccurrence([sat9to3], at(2026, 9, 12, 11, 30));
    expect(occ!.openNow).toBe(true);
    expect(occ!.date.getDate()).toBe(12);
    expect(formatOccurrence(occ!)).toBe("Open now · until 3:00 PM");
  });

  it("still points at today when the market opens later today", () => {
    const occ = nextOccurrence([sat9to3], at(2026, 9, 12, 7));
    expect(occ!.openNow).toBe(false);
    expect(occ!.date.getDate()).toBe(12);
  });

  it("rolls to next week once today's session has closed", () => {
    const occ = nextOccurrence([sat9to3], at(2026, 9, 12, 15, 1));
    expect(occ!.date.getDate()).toBe(19);
    expect(occ!.openNow).toBe(false);
  });

  it("picks the soonest of several days", () => {
    const occ = nextOccurrence([sat9to3, wed4to7], at(2026, 9, 8, 10)); // Tuesday
    expect(occ!.date.getDay()).toBe(3); // Wednesday comes first
    expect(occ!.date.getDate()).toBe(9);
  });

  it("prefers the earlier slot when two fall on the same day", () => {
    const early: MarketHour = { dayOfWeek: 6, opens: "07:00", closes: "08:00" };
    const occ = nextOccurrence([sat9to3, early], at(2026, 9, 8, 10));
    expect(occ!.hour.opens).toBe("07:00");
  });

  it("crosses a month boundary correctly", () => {
    // 2026-09-30 is a Wednesday; the next Saturday is 3 October.
    const occ = nextOccurrence([sat9to3], at(2026, 9, 30, 20));
    expect(occ!.date.getMonth()).toBe(9); // October, zero-indexed
    expect(occ!.date.getDate()).toBe(3);
    expect(formatOccurrence(occ!)).toBe("Sat, Oct 3 · 9:00 AM – 3:00 PM");
  });

  it("skips rows with unparseable times instead of throwing", () => {
    const broken: MarketHour = { dayOfWeek: 1, opens: "noon", closes: "later" };
    const occ = nextOccurrence([broken, sat9to3], at(2026, 9, 8, 10));
    expect(occ!.hour).toBe(sat9to3);
  });
});
