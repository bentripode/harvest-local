import { describe, expect, it } from "vitest";

import { MAX_WINDOWS, MAX_WINDOW_LEN, parseWindows } from "@/lib/orders/delivery-windows";

describe("parseWindows", () => {
  it("trims lines, collapses inner whitespace, and drops blanks", () => {
    expect(parseWindows("  Saturdays 9am–12pm \n\n\tSundays   10am–1pm  \n")).toEqual([
      "Saturdays 9am–12pm",
      "Sundays 10am–1pm",
    ]);
  });

  it("dedupes case-insensitively, keeping the first spelling", () => {
    expect(parseWindows("Saturdays 9–12\nsaturdays 9–12\nSATURDAYS 9–12")).toEqual([
      "Saturdays 9–12",
    ]);
  });

  it("caps the list at MAX_WINDOWS", () => {
    const many = Array.from({ length: MAX_WINDOWS + 5 }, (_, i) => `Window ${i}`).join("\n");
    expect(parseWindows(many)).toHaveLength(MAX_WINDOWS);
  });

  it("truncates an over-long label", () => {
    const out = parseWindows("x".repeat(MAX_WINDOW_LEN + 40));
    expect(out[0]).toHaveLength(MAX_WINDOW_LEN);
  });

  it("is empty for empty input", () => {
    expect(parseWindows("")).toEqual([]);
    expect(parseWindows("   \n  \n")).toEqual([]);
  });
});
