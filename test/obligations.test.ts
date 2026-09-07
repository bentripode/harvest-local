import { describe, expect, it } from "vitest";

import {
  nextDue,
  reminderDue,
  REMINDER_DAYS,
  type ObligationRule,
} from "@/lib/compliance/obligations";

/**
 * The date arithmetic behind the recurring-deadline reminders.
 *
 * This is the part that can be wrong in a way nobody notices: a reminder on the wrong day is worse
 * than no reminder, because a seller who learns the dates are unreliable stops reading them.
 */

const fixed: ObligationRule = {
  id: "o1",
  kind: "annual_filing",
  label: "Licensing exemption filing",
  detail: "Vermont wants a filing every year.",
  citation: null,
  sourceUrl: null,
  schedule: "fixed_date",
  dueMonth: 1,
  dueDay: 15,
  intervalMonths: null,
};

const interval: ObligationRule = {
  ...fixed,
  id: "o2",
  kind: "permit_renewal",
  schedule: "interval",
  dueMonth: null,
  dueDay: null,
  intervalMonths: 24,
};

describe("nextDue — a fixed calendar deadline", () => {
  it("points at this year's date while it is still ahead", () => {
    const out = nextDue(fixed, "2026-11-20", null, "2024-03-01");
    expect(out?.dueDate).toBe("2027-01-15");
    expect(out?.periodKey).toBe("2027");
  });

  it("rolls to next year once the date has passed", () => {
    const out = nextDue(fixed, "2027-02-01", null, "2024-03-01");
    expect(out?.dueDate).toBe("2028-01-15");
  });

  it("rolls forward once this year's filing is recorded", () => {
    // Filed on 2 January for the 15 January deadline.
    const out = nextDue(fixed, "2027-01-03", "2027-01-02", "2024-03-01");
    expect(out?.dueDate).toBe("2028-01-15");
  });

  /**
   * A filing made in December is for the January deadline that is coming, not the one ten months
   * gone — which is exactly when a diligent seller does it, and the case that would otherwise nag
   * them all through the holidays.
   */
  it("credits a December filing to the January that follows it", () => {
    const out = nextDue(fixed, "2026-12-20", "2026-12-18", "2024-03-01");
    expect(out?.dueDate).toBe("2028-01-15");
  });

  it("counts the days remaining", () => {
    const out = nextDue(fixed, "2027-01-05", null, "2024-03-01");
    expect(out?.daysOut).toBe(10);
  });
});

describe("nextDue — an interval clock", () => {
  it("counts from the storefront start when nothing has been done yet", () => {
    const out = nextDue(interval, "2026-09-07", null, "2025-06-10");
    expect(out?.dueDate).toBe("2027-06-10");
    expect(out?.periodKey).toBe("2025-06-10");
  });

  it("restarts from the last completion", () => {
    const out = nextDue(interval, "2026-09-07", "2026-02-01", "2020-01-01");
    expect(out?.dueDate).toBe("2028-02-01");
    expect(out?.periodKey).toBe("2026-02-01");
  });

  it("clamps onto the last day of a shorter month rather than wrapping", () => {
    const monthly: ObligationRule = { ...interval, intervalMonths: 1 };
    const out = nextDue(monthly, "2027-01-31", "2027-01-31", "2020-01-01");
    // Not 3 March.
    expect(out?.dueDate).toBe("2027-02-28");
  });

  it("reports a negative daysOut once it is overdue", () => {
    const out = nextDue(interval, "2027-07-10", null, "2025-06-10");
    expect(out!.daysOut).toBeLessThan(0);
  });
});

describe("reminderDue", () => {
  it("sends the furthest-out band first", () => {
    expect(reminderDue(30, [])).toBe(30);
    expect(reminderDue(25, [])).toBe(30);
  });

  it("moves down the bands as each is sent", () => {
    expect(reminderDue(25, [30])).toBe(null);
    expect(reminderDue(10, [30])).toBe(10);
    expect(reminderDue(1, [30, 10])).toBe(1);
    expect(reminderDue(1, [30, 10, 1])).toBe(null);
  });

  /**
   * The bands are inclusive downwards on purpose: a scan that misses a day — a deploy, an outage —
   * still sends the 10-day notice at 9 days rather than skipping it silently.
   */
  it("catches up after a missed day rather than skipping a band", () => {
    expect(reminderDue(9, [30])).toBe(10);
    expect(reminderDue(0, [30, 10])).toBe(1);
  });

  it("says nothing once the date has passed", () => {
    expect(reminderDue(-1, [])).toBe(null);
  });

  it("has its bands in descending order, which the walk depends on", () => {
    expect([...REMINDER_DAYS]).toEqual([...REMINDER_DAYS].sort((a, b) => b - a));
  });
});
