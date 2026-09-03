import { describe, expect, it } from "vitest";

import {
  addCents,
  cents,
  formatUsd,
  percentOff,
  toCents,
  toDecimalString,
} from "@/lib/money";

describe("cents", () => {
  it("accepts integers", () => {
    expect(cents(0)).toBe(0);
    expect(cents(1250)).toBe(1250);
  });

  it("rejects non-integers — the guard against float cents leaking in", () => {
    expect(() => cents(12.5)).toThrow(/integer/);
    expect(() => cents(0.1 + 0.2)).toThrow(/integer/);
  });
});

describe("toCents", () => {
  it("converts decimal dollar strings from Postgres numeric", () => {
    expect(toCents("12.50")).toBe(1250);
    expect(toCents("0.00")).toBe(0);
    expect(toCents("1")).toBe(100);
  });

  it("rounds to the nearest cent without float drift", () => {
    expect(toCents("0.1")).toBe(10);
    expect(toCents(0.1 + 0.2)).toBe(30); // 0.30000000000000004 -> 30
    expect(toCents("19.999")).toBe(2000);
  });

  it("rejects negative and non-finite input", () => {
    expect(() => toCents("-1")).toThrow(/non-negative/);
    expect(() => toCents(Number.NaN)).toThrow(/non-negative/);
    expect(() => toCents("abc")).toThrow(/non-negative/);
  });
});

describe("toDecimalString", () => {
  it("round-trips with toCents", () => {
    for (const s of ["0.00", "12.50", "1999.99", "5.05"]) {
      expect(toDecimalString(toCents(s))).toBe(s);
    }
  });

  it("always keeps two decimal places", () => {
    expect(toDecimalString(cents(5))).toBe("0.05");
    expect(toDecimalString(cents(200))).toBe("2.00");
  });
});

describe("addCents", () => {
  it("sums line totals exactly", () => {
    expect(addCents(cents(1050), cents(1050), cents(399))).toBe(2499);
  });

  it("is zero for no arguments", () => {
    expect(addCents()).toBe(0);
  });
});

describe("percentOff", () => {
  it("rounds the discount to the nearest cent", () => {
    expect(percentOff(cents(1000), 10)).toBe(100);
    expect(percentOff(cents(999), 10)).toBe(100); // 99.9 -> 100
    expect(percentOff(cents(1), 10)).toBe(0); // 0.1 -> 0
  });

  it("never exceeds the base", () => {
    expect(percentOff(cents(500), 150)).toBe(500);
    expect(percentOff(cents(500), 100)).toBe(500);
  });
});

describe("formatUsd", () => {
  it("formats cents as US currency", () => {
    expect(formatUsd(cents(1250))).toBe("$12.50");
    expect(formatUsd(0)).toBe("$0.00");
  });
});
