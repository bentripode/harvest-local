import { describe, expect, it } from "vitest";

import { formatDistance } from "@/lib/geo/nearby-format";

/**
 * Distance is the primary sort signal in a local marketplace, and it is rendered from a coordinate
 * that has been deliberately blurred to about a kilometre. The formatter's job is to not claim more
 * precision than that.
 */
describe("formatDistance", () => {
  it("says nothing when there is no origin to measure from", () => {
    expect(formatDistance(null)).toBeNull();
  });

  it("does not report tenths inside a mile, where the rounding makes them meaningless", () => {
    expect(formatDistance(0)).toBe("under a mile");
    expect(formatDistance(0.4)).toBe("under a mile");
    expect(formatDistance(0.99)).toBe("under a mile");
  });

  it("keeps one decimal in the range where it helps", () => {
    expect(formatDistance(1)).toBe("1.0 mi");
    expect(formatDistance(3.4)).toBe("3.4 mi");
    expect(formatDistance(9.9)).toBe("9.9 mi");
  });

  it("drops to whole miles once tenths stop mattering", () => {
    expect(formatDistance(10)).toBe("10 mi");
    expect(formatDistance(12.4)).toBe("12 mi");
    expect(formatDistance(806.2)).toBe("806 mi");
  });

  it("refuses nonsense rather than rendering it", () => {
    expect(formatDistance(Number.NaN)).toBeNull();
    expect(formatDistance(Number.POSITIVE_INFINITY)).toBeNull();
    expect(formatDistance(-3)).toBeNull();
  });
});
