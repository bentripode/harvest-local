import { describe, expect, it } from "vitest";

import {
  addDays,
  eventDayLabel,
  formatEventDate,
  formatEventTime,
  formatEventWhen,
  groupByDay,
  isPast,
  isWithin,
  localToday,
  summarizeEvent,
  upcomingEvents,
  type EventLike,
} from "@/lib/events/schedule";

/**
 * The thing that breaks a calendar is a date that means one thing to the server and another to the
 * reader. `event_date` is a wall-clock day at the venue and the reader's "today" is their own, so
 * most of these are about the two never being confused.
 */

const TODAY = "2026-12-12";

const event = (over: Partial<EventLike> = {}): EventLike => ({
  id: "e1",
  title: "Denton Community Market",
  eventDate: "2026-12-14",
  startsAt: "09:00:00",
  endsAt: "13:00:00",
  status: "published",
  cancelledNote: null,
  ...over,
});

describe("date arithmetic stays in string space", () => {
  it("adds days without going through an instant", () => {
    expect(addDays("2026-12-12", 1)).toBe("2026-12-13");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("crosses a leap day correctly", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2028-02-29", 1)).toBe("2028-03-01");
  });

  it("orders correctly by plain string comparison, which is what the module relies on", () => {
    expect("2026-12-09" < "2026-12-10").toBe(true);
    expect("2026-12-31" < "2027-01-01").toBe(true);
  });

  it("reads localToday off the reader's own clock, not UTC", () => {
    // 8pm on 12 December in a US zone is already 13 December in UTC. `localToday` must say the
    // 12th, or every "Today" heading is wrong for half the evening.
    const evening = new Date(2026, 11, 12, 20, 30);
    expect(localToday(evening)).toBe("2026-12-12");
  });
});

describe("formatting", () => {
  it("names the day without needing a time zone", () => {
    expect(formatEventDate("2026-12-14")).toBe("Monday 14 Dec");
  });

  it("reads a date column as the day the seller typed", () => {
    // `new Date("2026-12-14")` is midnight UTC — the 13th anywhere west of Greenwich.
    expect(formatEventDate("2026-12-14")).toContain("14");
  });

  it("gives a span when both ends are known", () => {
    expect(formatEventTime(event())).toBe("9:00 AM – 1:00 PM");
  });

  it("says 'from' rather than inventing an end time", () => {
    // A seller who gave only a start is saying when they arrive, not when they leave.
    expect(formatEventTime(event({ endsAt: null }))).toBe("from 9:00 AM");
  });

  it("is null when no time was given at all", () => {
    expect(formatEventTime(event({ startsAt: null, endsAt: null }))).toBeNull();
    expect(formatEventWhen(event({ startsAt: null, endsAt: null }))).toBe("Monday 14 Dec");
  });
});

describe("eventDayLabel", () => {
  it("says Today and Tomorrow, which are the labels worth having", () => {
    expect(eventDayLabel(event({ eventDate: TODAY }), TODAY)).toBe("Today");
    expect(eventDayLabel(event({ eventDate: "2026-12-13" }), TODAY)).toBe("Tomorrow");
  });

  it("falls back to the date further out", () => {
    expect(eventDayLabel(event({ eventDate: "2026-12-14" }), TODAY)).toBe("Monday 14 Dec");
  });

  it("takes the reader's day as an argument rather than asking a clock", () => {
    // The same event is "Today" or "Tomorrow" depending only on who is looking. Nothing in this
    // module may decide that for itself.
    const e = event({ eventDate: "2026-12-13" });
    expect(eventDayLabel(e, "2026-12-13")).toBe("Today");
    expect(eventDayLabel(e, "2026-12-12")).toBe("Tomorrow");
  });
});

describe("upcomingEvents", () => {
  const past = event({ id: "past", eventDate: "2026-12-01" });
  const today = event({ id: "today", eventDate: TODAY, startsAt: "14:00:00" });
  const earlyToday = event({ id: "early", eventDate: TODAY, startsAt: "08:00:00" });
  const soon = event({ id: "soon", eventDate: "2026-12-14" });
  const hidden = event({ id: "hidden", eventDate: "2026-12-15", status: "hidden" });
  const cancelled = event({ id: "cancelled", eventDate: "2026-12-13", status: "cancelled" });

  it("drops what has already happened and what was never published", () => {
    const out = upcomingEvents([past, soon, hidden], TODAY).map((e) => e.id);
    expect(out).toEqual(["soon"]);
  });

  it("KEEPS a cancelled event until its date passes", () => {
    // Someone planned around it. Removing the row silently tells them nothing; it has to sit where
    // they will look for it, saying it is off.
    const out = upcomingEvents([soon, cancelled], TODAY).map((e) => e.id);
    expect(out).toEqual(["cancelled", "soon"]);
  });

  it("keeps today's events, including one whose start time has passed", () => {
    // The module compares days, not instants, on purpose: it has no idea what time it is where the
    // reader is, and hiding a market at 9:01am because UTC thinks so is the bug it exists to avoid.
    expect(upcomingEvents([earlyToday], TODAY).map((e) => e.id)).toEqual(["early"]);
  });

  it("sorts by day then by start time", () => {
    const out = upcomingEvents([soon, today, earlyToday], TODAY).map((e) => e.id);
    expect(out).toEqual(["early", "today", "soon"]);
  });

  it("caps the list when asked", () => {
    expect(upcomingEvents([earlyToday, today, soon], TODAY, 2)).toHaveLength(2);
  });
});

describe("isPast / isWithin", () => {
  it("is past only once the day itself has gone", () => {
    expect(isPast(event({ eventDate: TODAY }), TODAY)).toBe(false);
    expect(isPast(event({ eventDate: "2026-12-11" }), TODAY)).toBe(true);
  });

  it("counts a window inclusive of today and of the last day", () => {
    expect(isWithin(event({ eventDate: TODAY }), TODAY, 7)).toBe(true);
    expect(isWithin(event({ eventDate: "2026-12-19" }), TODAY, 7)).toBe(true);
    expect(isWithin(event({ eventDate: "2026-12-20" }), TODAY, 7)).toBe(false);
  });
});

describe("groupByDay", () => {
  it("puts one heading on each day, in order", () => {
    const groups = groupByDay(
      [
        event({ id: "b", eventDate: "2026-12-14" }),
        event({ id: "a1", eventDate: TODAY, startsAt: "08:00:00" }),
        event({ id: "a2", eventDate: TODAY, startsAt: "15:00:00" }),
      ],
      TODAY,
    );

    expect(groups.map((g) => g.label)).toEqual(["Today", "Monday 14 Dec"]);
    expect(groups[0].events.map((e) => e.id)).toEqual(["a1", "a2"]);
    expect(groups[1].events.map((e) => e.id)).toEqual(["b"]);
  });

  it("is empty rather than throwing when there is nothing on", () => {
    expect(groupByDay([], TODAY)).toEqual([]);
  });
});

describe("summarizeEvent", () => {
  it("leads with the day a reader cares about", () => {
    expect(summarizeEvent(event({ eventDate: TODAY }), TODAY)).toBe("Today · 9:00 AM – 1:00 PM");
    expect(summarizeEvent(event(), TODAY)).toBe("Mon 14 Dec · 9:00 AM – 1:00 PM");
  });

  it("says outright when it is off", () => {
    expect(summarizeEvent(event({ status: "cancelled" }), TODAY)).toBe(
      "Mon 14 Dec · 9:00 AM – 1:00 PM — cancelled",
    );
  });
});
