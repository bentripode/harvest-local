import { describe, expect, it } from "vitest";

import { aggregateOnlineVerdict, cadence } from "@/lib/compliance/guide-format";
import { elementLabel } from "@/lib/labels/render";

/**
 * The public guide states a legal conclusion on a page anyone can read, so the two places it
 * summarises rather than quotes are worth pinning down.
 */

describe("aggregateOnlineVerdict", () => {
  it("passes a unanimous answer straight through", () => {
    expect(aggregateOnlineVerdict(["allowed"])).toBe("allowed");
    expect(aggregateOnlineVerdict(["banned", "banned"])).toBe("banned");
    expect(aggregateOnlineVerdict(["unclear", "unclear", "unclear"])).toBe("unclear");
  });

  it("is 'mixed' only when some route actually permits it — New Hampshire's shape", () => {
    // NH: the exempt route is banned, the licensed route is what online selling triggers.
    expect(aggregateOnlineVerdict(["banned", "allowed"])).toBe("mixed");
    expect(aggregateOnlineVerdict(["allowed", "unclear"])).toBe("mixed");
  });

  it("never reports 'mixed' from banned + unclear, which would imply a permission nobody gave", () => {
    expect(aggregateOnlineVerdict(["banned", "unclear"])).toBe("unclear");
  });

  it("treats a state with no programmes as unknown rather than permitted", () => {
    expect(aggregateOnlineVerdict([])).toBe("unclear");
  });
});

describe("cadence", () => {
  const fixed = (m: number, d: number) => ({
    schedule: "fixed_date",
    due_month: m,
    due_day: d,
    interval_months: null,
  });
  const every = (months: number) => ({
    schedule: "interval",
    due_month: null,
    due_day: null,
    interval_months: months,
  });

  it("renders a fixed deadline — Vermont's annual exemption filing", () => {
    expect(cadence(fixed(1, 15))).toBe("every year, by 15th January");
  });

  it("gets the ordinal right on the awkward numbers", () => {
    expect(cadence(fixed(3, 1))).toBe("every year, by 1st March");
    expect(cadence(fixed(3, 2))).toBe("every year, by 2nd March");
    expect(cadence(fixed(3, 3))).toBe("every year, by 3rd March");
    expect(cadence(fixed(3, 11))).toBe("every year, by 11th March");
    expect(cadence(fixed(3, 12))).toBe("every year, by 12th March");
    expect(cadence(fixed(3, 13))).toBe("every year, by 13th March");
    expect(cadence(fixed(3, 21))).toBe("every year, by 21st March");
    expect(cadence(fixed(12, 31))).toBe("every year, by 31st December");
  });

  it("renders intervals in the unit a person would use", () => {
    expect(cadence(every(12))).toBe("every year");
    expect(cadence(every(24))).toBe("every 2 years"); // Washington's biennial permit
    expect(cadence(every(18))).toBe("every 18 months");
  });

  it("falls back rather than inventing a date when the row is incomplete", () => {
    expect(cadence({ schedule: "fixed_date", due_month: null, due_day: null, interval_months: null })).toBe(
      "recurring",
    );
    expect(cadence({ schedule: "interval", due_month: null, due_day: null, interval_months: null })).toBe(
      "recurring",
    );
  });
});

describe("elementLabel", () => {
  it("gives the label sheet and the public guide the same words", () => {
    expect(elementLabel("producer_address")).toBe("Address where the food was made");
    expect(elementLabel("county_of_preparation")).toBe("County where prepared");
    expect(elementLabel("ingredients_desc_by_weight")).toBe("Ingredients");
  });

  it("passes an unmodelled key through so a rule naming it stays visible", () => {
    expect(elementLabel("some_future_element")).toBe("some_future_element");
  });
});
