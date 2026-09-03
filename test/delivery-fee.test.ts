import { describe, expect, it } from "vitest";

import { deliveryFeeCents } from "@/lib/orders/delivery-fee";

describe("deliveryFeeCents — fee = base + per_mile * ceil(miles), min 1 mile", () => {
  it("rounds the mileage up before billing", () => {
    expect(deliveryFeeCents("4.00", "1.50", 3.1)).toBe(400 + 150 * 4);
    expect(deliveryFeeCents("4.00", "1.50", 4.0)).toBe(400 + 150 * 4);
  });

  it("bills a minimum of one mile", () => {
    expect(deliveryFeeCents("4.00", "1.50", 0)).toBe(550);
    expect(deliveryFeeCents("4.00", "1.50", 0.2)).toBe(550);
  });

  it("treats missing base / per-mile values as zero", () => {
    expect(deliveryFeeCents(null, null, 5)).toBe(0);
    expect(deliveryFeeCents("4.00", undefined, 5)).toBe(400);
  });

  it("accepts numeric as well as string dollar inputs", () => {
    expect(deliveryFeeCents(4, 1.5, 2)).toBe(700);
  });

  it("returns integer cents with no float drift", () => {
    const fee = deliveryFeeCents("0.10", "0.10", 3);
    expect(fee).toBe(40);
    expect(Number.isInteger(fee)).toBe(true);
  });
});
