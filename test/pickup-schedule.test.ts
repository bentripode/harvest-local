import { describe, expect, it } from "vitest";

import {
  describePrepTime,
  ordinalList,
  summarizeSlots,
  upcomingPickups,
  type PickupSlot,
} from "@/lib/orders/pickup-schedule";

/**
 * A buyer picks a collection time from this and the seller has to be standing there when they turn
 * up, so an off-by-one week or a lead time that doesn't bite is a wasted journey for one of them.
 */

const at = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min);

const weekly = (dayOfWeek: number, opens: string, closes: string, weeks: number[] = []): PickupSlot => ({
  dayOfWeek,
  specificDate: null,
  opens,
  closes,
  weeksOfMonth: weeks,
});

const oneOff = (date: string, opens: string, closes: string): PickupSlot => ({
  dayOfWeek: null,
  specificDate: date,
  opens,
  closes,
  weeksOfMonth: [],
});

// September 2026: Tue 1st. Saturdays fall on 5, 12, 19, 26.
const SAT = weekly(6, "09:00:00", "15:00:00");

describe("upcomingPickups — weekly", () => {
  it("lists the coming Saturdays in order", () => {
    const out = upcomingPickups([SAT], { from: at(2026, 9, 8, 10), limit: 3 });
    expect(out.map((o) => o.dateKey)).toEqual(["2026-09-12", "2026-09-19", "2026-09-26"]);
    expect(out[0].label).toBe("Sat, Sep 12 · 9:00 AM – 3:00 PM");
  });

  it("still offers today's slot while it is open", () => {
    const out = upcomingPickups([SAT], { from: at(2026, 9, 12, 11), limit: 1 });
    expect(out[0].dateKey).toBe("2026-09-12");
  });

  it("drops today's slot once it has closed", () => {
    const out = upcomingPickups([SAT], { from: at(2026, 9, 12, 15, 1), limit: 1 });
    expect(out[0].dateKey).toBe("2026-09-19");
  });

  it("returns nothing when there are no slots, rather than inventing one", () => {
    expect(upcomingPickups([], { from: at(2026, 9, 8) })).toEqual([]);
  });

  it("orders two slots on the same day by opening time", () => {
    const morning = weekly(6, "08:00", "10:00");
    const out = upcomingPickups([SAT, morning], { from: at(2026, 9, 8), limit: 2 });
    expect(out.map((o) => o.opens)).toEqual(["08:00", "09:00:00"]);
  });
});

describe("upcomingPickups — 'first and third Saturday'", () => {
  const firstAndThird = weekly(6, "09:00", "15:00", [1, 3]);

  it("picks only the 1st and 3rd occurrences of that weekday", () => {
    // Sat 5th is the 1st Saturday, 12th the 2nd, 19th the 3rd, 26th the 4th.
    const out = upcomingPickups([firstAndThird], { from: at(2026, 9, 1), limit: 3 });
    expect(out.map((o) => o.dateKey)).toEqual(["2026-09-05", "2026-09-19", "2026-10-03"]);
  });

  it("counts occurrences of the weekday, not calendar weeks", () => {
    // Oct 2026: Thu 1st, so Saturdays are 3, 10, 17, 24, 31 — the 3rd is the 1st Saturday.
    const out = upcomingPickups([firstAndThird], { from: at(2026, 10, 1), limit: 2 });
    expect(out.map((o) => o.dateKey)).toEqual(["2026-10-03", "2026-10-17"]);
  });

  it("supports a 5th-occurrence slot without emitting one in months that lack it", () => {
    const fifth = weekly(6, "09:00", "15:00", [5]);
    // September 2026 has only four Saturdays; October's 5th Saturday is the 31st.
    const out = upcomingPickups([fifth], { from: at(2026, 9, 1), limit: 1 });
    expect(out[0].dateKey).toBe("2026-10-31");
  });
});

describe("upcomingPickups — one-off dates", () => {
  it("offers a specific date and nothing after it", () => {
    const out = upcomingPickups([oneOff("2026-12-14", "10:00", "16:00")], {
      from: at(2026, 9, 8),
      limit: 5,
      horizonDays: 120,
    });
    expect(out).toHaveLength(1);
    expect(out[0].dateKey).toBe("2026-12-14");
    expect(out[0].label).toBe("Mon, Dec 14 · 10:00 AM – 4:00 PM");
  });

  it("does not shift the date across a time-zone boundary", () => {
    // Parsed as local, not UTC — `new Date("2026-12-14")` would be the 13th west of Greenwich.
    const out = upcomingPickups([oneOff("2026-12-14", "10:00", "16:00")], {
      from: at(2026, 12, 14, 9),
      limit: 1,
    });
    expect(out[0].date.getDate()).toBe(14);
  });

  it("drops a one-off that has already passed", () => {
    const out = upcomingPickups([oneOff("2026-09-01", "10:00", "16:00")], {
      from: at(2026, 9, 8),
      limit: 5,
    });
    expect(out).toEqual([]);
  });

  it("interleaves one-offs with the weekly pattern in date order", () => {
    const out = upcomingPickups([SAT, oneOff("2026-09-16", "10:00", "16:00")], {
      from: at(2026, 9, 14),
      limit: 3,
    });
    expect(out.map((o) => o.dateKey)).toEqual(["2026-09-16", "2026-09-19", "2026-09-26"]);
  });
});

describe("upcomingPickups — lead time", () => {
  it("skips a slot that closes before the seller's notice has elapsed", () => {
    // Saturday 8am with 48 hours' notice: the 12th is out, the 19th is the first that works.
    const out = upcomingPickups([SAT], { from: at(2026, 9, 11, 8), prepHours: 48, limit: 1 });
    expect(out[0].dateKey).toBe("2026-09-19");
  });

  it("keeps a slot that is still open when the notice elapses", () => {
    // Friday 8am + 24h = Saturday 8am; the 9am–3pm slot is still ahead.
    const out = upcomingPickups([SAT], { from: at(2026, 9, 11, 8), prepHours: 24, limit: 1 });
    expect(out[0].dateKey).toBe("2026-09-12");
  });

  it("with no lead time behaves as before", () => {
    const out = upcomingPickups([SAT], { from: at(2026, 9, 11, 8), prepHours: 0, limit: 1 });
    expect(out[0].dateKey).toBe("2026-09-12");
  });
});

describe("summarizeSlots", () => {
  it("describes a weekly slot", () => {
    expect(summarizeSlots([SAT])).toEqual(["Every Saturday · 9:00 AM – 3:00 PM"]);
  });

  it("describes a non-weekly cadence in the words a seller would use", () => {
    expect(summarizeSlots([weekly(6, "09:00", "15:00", [1, 3])])).toEqual([
      "1st & 3rd Saturday · 9:00 AM – 3:00 PM",
    ]);
  });

  it("lists one-off dates after the pattern", () => {
    expect(summarizeSlots([SAT, oneOff("2026-12-14", "10:00", "16:00")])).toEqual([
      "Every Saturday · 9:00 AM – 3:00 PM",
      "Mon, Dec 14 · 10:00 AM – 4:00 PM",
    ]);
  });

  it("orders weekly slots by day then time", () => {
    expect(summarizeSlots([SAT, weekly(3, "16:00", "19:00")])).toEqual([
      "Every Wednesday · 4:00 PM – 7:00 PM",
      "Every Saturday · 9:00 AM – 3:00 PM",
    ]);
  });
});

describe("ordinalList", () => {
  it("joins ordinals the way a person writes them", () => {
    expect(ordinalList([1])).toBe("1st");
    expect(ordinalList([1, 3])).toBe("1st & 3rd");
    expect(ordinalList([1, 2, 4])).toBe("1st, 2nd & 4th");
  });

  it("sorts and dedupes", () => {
    expect(ordinalList([3, 1, 3])).toBe("1st & 3rd");
  });
});

describe("describePrepTime", () => {
  it("says nothing when no notice is needed", () => {
    expect(describePrepTime(0)).toBeNull();
  });

  it("uses hours below a day and days above", () => {
    expect(describePrepTime(1)).toBe("1 hour notice");
    expect(describePrepTime(6)).toBe("6 hours notice");
    expect(describePrepTime(24)).toBe("1 day notice");
    expect(describePrepTime(72)).toBe("3 days notice");
  });
});
